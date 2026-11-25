"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required, optDate } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { activity, audit } from "@/lib/audit";
import { emit } from "@/lib/automations";
import { assertLimit } from "@/lib/services/workspace";
import { invitePortal } from "@/lib/services/portal";
import { startOnboarding } from "@/lib/services/onboarding";
import { toCents } from "@/lib/format";
import { generate } from "@/lib/ai";
import { STAGES } from "@/lib/constants";

const STATUSES = ["LEAD", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export const createClientAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  await assertLimit(ctx.workspaceId, "clients", "clientes");
  const name = required(fd, "name", "el nombre del cliente");
  const email = optStr(fd, "email")?.toLowerCase() ?? null;
  const client = await db.client.create({
    data: {
      workspaceId: ctx.workspaceId,
      name,
      kind: str(fd, "kind") === "PERSON" ? "PERSON" : "COMPANY",
      email,
      phone: optStr(fd, "phone"),
      website: optStr(fd, "website"),
      industry: optStr(fd, "industry"),
      source: optStr(fd, "source"),
      status: STATUSES.includes(str(fd, "status") as (typeof STATUSES)[number]) ? (str(fd, "status") as (typeof STATUSES)[number]) : "LEAD",
      ownerId: ctx.user.id,
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean),
    },
  });
  const contactName = optStr(fd, "contactName");
  if (contactName || email) {
    await db.contact.create({
      data: { workspaceId: ctx.workspaceId, clientId: client.id, name: contactName ?? name, email, phone: optStr(fd, "phone"), position: optStr(fd, "position"), isPrimary: true },
    });
  }
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, content: `Cliente ${name} creado`, userId: ctx.user.id });
  await emit(ctx.workspaceId, "client.created", { clientId: client.id, userId: ctx.user.id });
  return { message: "Cliente creado", data: { href: `/app/clientes/${client.id}` } };
}, "/app/clientes");

export const updateClientAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "id"));
  const status = str(fd, "status");
  await db.client.update({
    where: { id: client.id },
    data: {
      name: required(fd, "name", "el nombre del cliente"),
      kind: str(fd, "kind") === "PERSON" ? "PERSON" : "COMPANY",
      email: optStr(fd, "email")?.toLowerCase() ?? null,
      phone: optStr(fd, "phone"),
      website: optStr(fd, "website"),
      industry: optStr(fd, "industry"),
      taxId: optStr(fd, "taxId"),
      address: optStr(fd, "address"),
      source: optStr(fd, "source"),
      notes: optStr(fd, "notes"),
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean),
      status: STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as (typeof STATUSES)[number]) : client.status,
    },
  });
  return "Cliente actualizado";
}, "/app/clientes");

export const setClientStatusAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "id"));
  const status = str(fd, "status") as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) throw new Error("Estado no válido");
  await db.client.update({ where: { id: client.id }, data: { status } });
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, content: `Estado cambiado a ${status}`, userId: ctx.user.id });
  return "Estado actualizado";
}, "/app/clientes");

export const deleteClientAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "id"));
  if (ctx.membership.role !== "OWNER" && ctx.membership.role !== "ADMIN") throw new Error("Solo un administrador puede eliminar clientes.");
  await db.client.delete({ where: { id: client.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "client.deleted", entityId: client.id, meta: { name: client.name } });
  return { message: "Cliente eliminado", data: { href: "/app/clientes" } };
}, "/app/clientes");

export const addContactAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  const isPrimary = str(fd, "isPrimary") === "on";
  if (isPrimary) await db.contact.updateMany({ where: { clientId: client.id }, data: { isPrimary: false } });
  await db.contact.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: client.id,
      name: required(fd, "name", "el nombre del contacto"),
      email: optStr(fd, "email")?.toLowerCase() ?? null,
      phone: optStr(fd, "phone"),
      position: optStr(fd, "position"),
      isPrimary: isPrimary || (await db.contact.count({ where: { clientId: client.id } })) === 0,
    },
  });
  return "Contacto añadido";
}, "/app/clientes");

export const deleteContactAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  await db.contact.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Contacto eliminado";
}, "/app/clientes");

export const addNoteAction = action(async (fd) => {
  const ctx = await actionContext("clients.view");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  const type = ["NOTE", "CALL", "EMAIL", "MEETING"].includes(str(fd, "type")) ? str(fd, "type") : "NOTE";
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, type, content: required(fd, "content", "la nota"), userId: ctx.user.id });
  return "Registrado en el historial";
}, "/app/clientes");

export const invitePortalAction = action(async (fd) => {
  const ctx = await actionContext("portal.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  const email = required(fd, "email", "el correo de la persona a invitar");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Escribe un correo válido con @.");
  const r = await invitePortal(ctx.workspaceId, client.id, email, optStr(fd, "name") ?? undefined);
  return { message: r.emailed ? `Invitación enviada a ${email}` : "Invitación creada. El correo no está configurado: copia el enlace.", data: { inviteUrl: r.url } };
}, "/app/clientes");

export const revokePortalAction = action(async (fd) => {
  const ctx = await actionContext("portal.manage");
  await db.portalAccess.updateMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, data: { isActive: false } });
  return "Acceso al portal revocado";
}, "/app/clientes");

export const startOnboardingAction = action(async (fd) => {
  const ctx = await actionContext("portal.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  await startOnboarding({ workspaceId: ctx.workspaceId, clientId: client.id, templateId: optStr(fd, "templateId"), userId: ctx.user.id });
  return "Onboarding completado: portal, bienvenida, formulario, proyecto y agenda listos";
}, "/app/clientes");

// ───────── Oportunidades ─────────


export const createDealAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const deal = await db.deal.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: client.id,
      title: required(fd, "title", "el título de la oportunidad"),
      value: toCents(str(fd, "value")),
      currency: ctx.workspace.currency,
      source: optStr(fd, "source"),
      expectedCloseDate: optDate(fd, "expectedCloseDate"),
      ownerId: ctx.user.id,
    },
  });
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, dealId: deal.id, content: `Oportunidad "${deal.title}" creada`, userId: ctx.user.id });
  return "Oportunidad creada";
}, ["/app/oportunidades", "/app/clientes"]);

export const moveDealAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const stage = STAGES.find((s) => s.id === str(fd, "stage"));
  if (!stage) throw new Error("Etapa no válida");
  const deal = await db.deal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!deal) throw new Error("Oportunidad no encontrada");
  const status = stage.id === "WON" ? "WON" : stage.id === "LOST" ? "LOST" : "OPEN";
  await db.deal.update({
    where: { id: deal.id },
    data: { stage: stage.id, probability: stage.probability, status, closedAt: status === "OPEN" ? null : new Date(), lostReason: status === "LOST" ? optStr(fd, "lostReason") : null },
  });
  if (deal.stage !== stage.id) {
    await activity({ workspaceId: ctx.workspaceId, clientId: deal.clientId, dealId: deal.id, content: `"${deal.title}" pasó a ${stage.label}`, userId: ctx.user.id });
    if (status === "WON") await db.client.update({ where: { id: deal.clientId }, data: { status: "ACTIVE" } });
  }
  return status === "WON" ? "¡Oportunidad ganada!" : undefined;
}, "/app/oportunidades");

export const updateDealAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const deal = await db.deal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!deal) throw new Error("Oportunidad no encontrada");
  await db.deal.update({
    where: { id: deal.id },
    data: {
      title: required(fd, "title", "el título"),
      value: toCents(str(fd, "value")),
      probability: Math.max(0, Math.min(100, Number(str(fd, "probability")) || deal.probability)),
      expectedCloseDate: optDate(fd, "expectedCloseDate"),
      source: optStr(fd, "source"),
    },
  });
  return "Oportunidad actualizada";
}, "/app/oportunidades");

export const deleteDealAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  await db.deal.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Oportunidad eliminada";
}, "/app/oportunidades");

export const clientSummaryAction = action(async (fd) => {
  const ctx = await actionContext("ai.use");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  const [acts, projects, invoices, deals] = await Promise.all([
    db.activity.findMany({ where: { workspaceId: ctx.workspaceId, clientId: client.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.project.findMany({ where: { workspaceId: ctx.workspaceId, clientId: client.id } }),
    db.invoice.findMany({ where: { workspaceId: ctx.workspaceId, clientId: client.id } }),
    db.deal.findMany({ where: { workspaceId: ctx.workspaceId, clientId: client.id } }),
  ]);
  const context = [
    `Cliente: ${client.name} (${client.status}) ${client.industry ?? ""}`,
    `Notas: ${client.notes ?? "-"}`,
    `Proyectos: ${projects.map((p) => `${p.name} [${p.status}]`).join("; ") || "-"}`,
    `Facturas: ${invoices.map((i) => `${i.number} ${i.status} ${(i.total / 100).toFixed(2)} ${i.currency}`).join("; ") || "-"}`,
    `Oportunidades: ${deals.map((d) => `${d.title} [${d.stage}]`).join("; ") || "-"}`,
    `Historial:`,
    ...acts.map((a) => `- ${a.createdAt.toISOString().slice(0, 10)} ${a.type}: ${a.content}`),
  ].join("\n");
  const text = await generate({
    workspaceId: ctx.workspaceId,
    userId: ctx.user.id,
    feature: "client.summary",
    context,
    instructions: "Resume en 5 viñetas el estado de la relación con este cliente y termina con 2 acciones concretas recomendadas (seguimiento, cobro, venta adicional o riesgo).",
    effort: "low",
  });
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, type: "NOTE", content: `Resumen IA:\n${text}`, userId: ctx.user.id });
  return "Resumen generado y guardado en el historial";
}, "/app/clientes");
