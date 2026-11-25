"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { action, optStr, str, required, optDate } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { activity } from "@/lib/audit";
import { createInvoice, recordPayment, sendInvoice, computeTotals } from "@/lib/services/billing";
import { toCents } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";

const lineSchema = z.array(z.object({ description: z.string().min(1, "Cada línea necesita una descripción."), quantity: z.number().positive(), unitPrice: z.number().int().min(0) })).min(1, "Añade al menos una línea.");

export const createInvoiceAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const items = lineSchema.parse(JSON.parse(str(fd, "items") || "[]"));
  const due = optDate(fd, "dueDate") ?? new Date(Date.now() + 15 * 86400_000);
  const projectId = optStr(fd, "projectId");
  const inv = await createInvoice({
    workspaceId: ctx.workspaceId,
    clientId: client.id,
    items,
    dueDate: due,
    currency: str(fd, "currency") || ctx.workspace.currency,
    taxRate: Number(str(fd, "taxRate")) || 0,
    discount: toCents(str(fd, "discount")),
    title: optStr(fd, "title"),
    notes: optStr(fd, "notes"),
    projectId: projectId && (await db.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } })) ? projectId : null,
  });
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, content: `Factura ${inv.number} creada`, userId: ctx.user.id });
  if (str(fd, "send") === "1") await sendInvoice(ctx.workspaceId, inv.id);
  return { message: str(fd, "send") === "1" ? "Factura creada y enviada" : "Factura creada", data: { href: `/app/facturacion/${inv.id}` } };
}, "/app/facturacion");

export const sendInvoiceAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const r = await sendInvoice(ctx.workspaceId, str(fd, "id"));
  return { message: r.email?.ok ? "Factura enviada por correo" : "Factura marcada como enviada. Copia el enlace para compartirla.", data: { url: r.url } };
}, "/app/facturacion");

export const recordPaymentAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const method = str(fd, "method");
  if (!(method in PAYMENT_METHODS)) throw new Error("Método de pago no válido");
  const amount = toCents(str(fd, "amount"));
  const r = await recordPayment({
    workspaceId: ctx.workspaceId,
    invoiceId: str(fd, "id"),
    amount,
    method,
    reference: optStr(fd, "reference"),
    notes: optStr(fd, "notes"),
    paidAt: optDate(fd, "paidAt") ?? new Date(),
    recordedById: ctx.user.id,
  });
  if (r.duplicated) return "Ese pago ya estaba registrado";
  return r.invoice.status === "PAID" ? "Pago registrado: factura pagada" : "Pago parcial registrado";
}, "/app/facturacion");

export const deletePaymentAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const p = await db.payment.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { invoice: true } });
  if (!p) throw new Error("Pago no encontrado");
  await db.payment.delete({ where: { id: p.id } });
  const amountPaid = Math.max(0, p.invoice.amountPaid - p.amount);
  await db.invoice.update({
    where: { id: p.invoiceId },
    data: { amountPaid, status: amountPaid === 0 ? (p.invoice.dueDate < new Date() ? "OVERDUE" : "SENT") : "PARTIAL", paidAt: null },
  });
  return "Pago eliminado";
}, "/app/facturacion");

export const voidInvoiceAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const inv = await db.invoice.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.amountPaid > 0) throw new Error("La factura tiene pagos registrados. Elimínalos antes de anularla.");
  await db.invoice.update({ where: { id: inv.id }, data: { status: "VOID" } });
  await activity({ workspaceId: ctx.workspaceId, clientId: inv.clientId, content: `Factura ${inv.number} anulada`, userId: ctx.user.id });
  return "Factura anulada";
}, "/app/facturacion");

export const updateDraftInvoiceAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const inv = await db.invoice.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.status !== "DRAFT") throw new Error("Solo se pueden editar facturas en borrador.");
  const items = lineSchema.parse(JSON.parse(str(fd, "items") || "[]"));
  const taxRate = Number(str(fd, "taxRate")) || 0;
  const discount = toCents(str(fd, "discount"));
  await db.$transaction([
    db.invoiceItem.deleteMany({ where: { invoiceId: inv.id } }),
    db.invoice.update({
      where: { id: inv.id },
      data: {
        title: optStr(fd, "title"),
        notes: optStr(fd, "notes"),
        dueDate: optDate(fd, "dueDate") ?? inv.dueDate,
        taxRate,
        discount,
        ...computeTotals(items, taxRate, discount),
        items: { create: items.map((i, k) => ({ ...i, sortOrder: k })) },
      },
    }),
  ]);
  return "Factura actualizada";
}, "/app/facturacion");

export const createRecurringAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const amount = toCents(str(fd, "amount"));
  if (amount <= 0) throw new Error("Escribe el importe de cada periodo.");
  const interval = ["WEEK", "MONTH", "QUARTER", "YEAR"].includes(str(fd, "interval")) ? str(fd, "interval") : "MONTH";
  const name = required(fd, "name", "el concepto");
  await db.recurringPlan.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: client.id,
      name,
      currency: ctx.workspace.currency,
      items: [{ description: name, quantity: 1, unitPrice: amount }],
      taxRate: Number(str(fd, "taxRate")) || 0,
      interval,
      nextRunAt: optDate(fd, "startDate") ?? new Date(),
      endsAt: optDate(fd, "endsAt"),
      autoSend: str(fd, "autoSend") === "on",
    },
  });
  return "Cobro recurrente programado";
}, "/app/facturacion");

export const setRecurringStatusAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const status = str(fd, "status");
  if (!["ACTIVE", "PAUSED", "CANCELED"].includes(status)) throw new Error("Estado no válido");
  await db.recurringPlan.updateMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, data: { status } });
  return status === "ACTIVE" ? "Cobro reactivado" : status === "PAUSED" ? "Cobro en pausa" : "Cobro cancelado";
}, "/app/facturacion");
