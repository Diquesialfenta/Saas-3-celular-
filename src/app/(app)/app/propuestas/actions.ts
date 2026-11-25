"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { activity, nextNumber } from "@/lib/audit";
import { appUrl } from "@/lib/config";
import { emailLayout, sendEmail } from "@/lib/email";
import { generate } from "@/lib/ai";
import type { ProposalTemplate } from "@/lib/templates";
import { invoicesFromProposal } from "@/lib/services/billing";
import { createContract } from "@/lib/services/contracts";

export const createProposalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const templateId = optStr(fd, "templateId");
  const tplRow = templateId ? await db.template.findFirst({ where: { id: templateId, workspaceId: ctx.workspaceId, type: "PROPOSAL" } }) : null;
  const tpl = tplRow?.content as ProposalTemplate | undefined;
  const dealId = optStr(fd, "dealId");
  const number = await nextNumber(ctx.workspaceId, "proposal");
  const p = await db.proposal.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: client.id,
      dealId: dealId && (await db.deal.findFirst({ where: { id: dealId, workspaceId: ctx.workspaceId } })) ? dealId : null,
      number,
      title: optStr(fd, "title") ?? tpl?.title ?? `Propuesta para ${client.name}`,
      summary: tpl?.summary ?? null,
      sections: (tpl?.sections ?? []).map((s, i) => ({ id: `s${i}`, ...s })),
      currency: ctx.workspace.currency,
      taxRate: ctx.workspace.taxRate,
      depositPercent: tpl?.depositPercent ?? 50,
      validUntil: new Date(Date.now() + (tpl?.validDays ?? 15) * 86400_000),
      createdById: ctx.user.id,
      items: { create: (tpl?.items ?? []).map((it, i) => ({ ...it, sortOrder: i, recurring: it.recurring ?? "NONE", isOptional: !!it.isOptional })) },
    },
  });
  return { data: { href: `/app/propuestas/${p.id}` } };
}, "/app/propuestas");

const saveSchema = z.object({
  title: z.string().min(2, "Escribe el título de la propuesta."),
  summary: z.string().nullable(),
  sections: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })),
  items: z.array(
    z.object({
      name: z.string().min(1, "Cada concepto necesita un nombre."),
      description: z.string().nullable().optional(),
      quantity: z.number().positive("La cantidad debe ser mayor que cero."),
      unitPrice: z.number().int().min(0),
      recurring: z.enum(["NONE", "MONTHLY", "YEARLY"]),
      isOptional: z.boolean(),
      isSelected: z.boolean(),
    }),
  ),
  taxRate: z.number().min(0).max(100),
  discount: z.number().int().min(0),
  depositPercent: z.number().int().min(0).max(100),
  installments: z.number().int().min(1).max(36),
  validUntil: z.string().nullable(),
});

export const saveProposalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.status === "ACCEPTED") throw new Error("La propuesta ya fue aceptada y no se puede modificar.");
  const data = saveSchema.parse(JSON.parse(str(fd, "payload")));
  await db.$transaction([
    db.proposalItem.deleteMany({ where: { proposalId: p.id } }),
    db.proposal.update({
      where: { id: p.id },
      data: {
        title: data.title,
        summary: data.summary,
        sections: data.sections,
        taxRate: data.taxRate,
        discount: data.discount,
        depositPercent: data.depositPercent,
        installments: data.installments,
        validUntil: data.validUntil ? new Date(`${data.validUntil}T23:59:00`) : null,
        items: { create: data.items.map((it, i) => ({ ...it, description: it.description ?? null, sortOrder: i })) },
      },
    }),
  ]);
  return "Propuesta guardada";
}, "/app/propuestas");

export const sendProposalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { client: { include: { contacts: true } }, items: true } });
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.items.length === 0) throw new Error("Añade al menos un concepto con precio antes de enviar.");
  const to = optStr(fd, "email") ?? p.client.contacts.find((c) => c.isPrimary)?.email ?? p.client.email;
  const url = appUrl(`/p/${p.publicToken}`);
  let emailed = false;
  if (to) {
    const r = await sendEmail({
      workspaceId: ctx.workspaceId,
      to,
      subject: `${ctx.workspace.name}: ${p.title}`,
      html: emailLayout(
        ctx.workspace,
        p.title,
        `Hola ${p.client.name},\n\n${optStr(fd, "message") ?? "Te enviamos nuestra propuesta. Puedes revisarla, elegir las opciones que te interesen y aceptarla en línea."}`,
        { label: "Ver la propuesta", url },
      ),
    });
    emailed = r.ok;
  }
  await db.proposal.update({ where: { id: p.id }, data: { status: p.status === "DRAFT" ? "SENT" : p.status, sentAt: new Date() } });
  if (p.dealId) await db.deal.update({ where: { id: p.dealId }, data: { stage: "PROPOSAL", probability: 60 } });
  await activity({ workspaceId: ctx.workspaceId, clientId: p.clientId, content: `Propuesta ${p.number} enviada${to ? ` a ${to}` : ""}`, userId: ctx.user.id });
  return { message: emailed ? `Propuesta enviada a ${to}` : "Propuesta marcada como enviada. Copia el enlace para compartirla.", data: { url } };
}, "/app/propuestas");

export const duplicateProposalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { items: true } });
  if (!p) throw new Error("Propuesta no encontrada");
  const number = await nextNumber(ctx.workspaceId, "proposal");
  const copy = await db.proposal.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: p.clientId,
      dealId: p.dealId,
      number,
      title: `${p.title} (copia)`,
      summary: p.summary,
      sections: p.sections as object,
      currency: p.currency,
      taxRate: p.taxRate,
      discount: p.discount,
      depositPercent: p.depositPercent,
      installments: p.installments,
      validUntil: new Date(Date.now() + 15 * 86400_000),
      createdById: ctx.user.id,
      items: { create: p.items.map(({ id: _id, proposalId: _pid, ...it }) => it) },
    },
  });
  return { message: "Propuesta duplicada", data: { href: `/app/propuestas/${copy.id}` } };
}, "/app/propuestas");

export const deleteProposalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.status === "ACCEPTED") throw new Error("No se puede eliminar una propuesta aceptada.");
  await db.proposal.delete({ where: { id: p.id } });
  return { message: "Propuesta eliminada", data: { href: "/app/propuestas" } };
}, "/app/propuestas");

export const proposalToContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!p) throw new Error("Propuesta no encontrada");
  const existing = await db.contract.findFirst({ where: { workspaceId: ctx.workspaceId, proposalId: p.id } });
  if (existing) return { data: { href: `/app/contratos/${existing.id}` } };
  const tpl = optStr(fd, "templateId") ?? (await db.template.findFirst({ where: { workspaceId: ctx.workspaceId, type: "CONTRACT" } }))?.id;
  const c = await createContract({ workspaceId: ctx.workspaceId, clientId: p.clientId, proposalId: p.id, templateId: tpl, providerName: ctx.user.name, providerEmail: ctx.user.email });
  return { message: "Contrato generado", data: { href: `/app/contratos/${c.id}` } };
}, ["/app/propuestas", "/app/contratos"]);

export const proposalToInvoicesAction = action(async (fd) => {
  const ctx = await actionContext("billing.manage");
  const p = await db.proposal.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!p) throw new Error("Propuesta no encontrada");
  const created = await invoicesFromProposal(ctx.workspaceId, p.id);
  return created.length ? `${created.length} factura(s) creadas en borrador` : "Las facturas de esta propuesta ya existen";
}, ["/app/propuestas", "/app/facturacion"]);

/** IA: redacta la propuesta a partir de un brief. Devuelve JSON para el editor. */
export async function draftProposalWithAI(id: string, brief: string): Promise<{ error?: string; summary?: string; sections?: { title: string; body: string }[]; items?: { name: string; description: string; quantity: number }[] }> {
  try {
    const ctx = await actionContext("ai.use");
    const p = await db.proposal.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { client: true } });
    if (!p) return { error: "Propuesta no encontrada" };
    const services = await db.service.findMany({ where: { workspaceId: ctx.workspaceId, isActive: true } });
    const text = await generate({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      feature: "proposal.draft",
      effort: "medium",
      context: [
        `Proveedor: ${ctx.workspace.name}`,
        `Cliente: ${p.client.name}${p.client.industry ? ` (${p.client.industry})` : ""}`,
        `Título de la propuesta: ${p.title}`,
        `Servicios del catálogo: ${services.map((s) => s.name).join(", ") || "no definidos"}`,
        `Brief del usuario: ${brief}`,
      ].join("\n"),
      instructions: `Redacta una propuesta comercial persuasiva y concreta. Responde SOLO con JSON válido con esta forma:
{"summary": "resumen ejecutivo de 2-3 frases", "sections": [{"title": "...", "body": "..."}], "items": [{"name": "...", "description": "...", "quantity": 1}]}
Incluye 4 a 6 secciones (contexto y objetivos, enfoque, alcance, entregables, calendario, condiciones). En "items" propone los conceptos a presupuestar SIN precios.`,
    });
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return { summary: parsed.summary, sections: parsed.sections, items: parsed.items };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo generar." };
  }
}
