"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { activity } from "@/lib/audit";
import { createContract, sendContract } from "@/lib/services/contracts";
import { generate } from "@/lib/ai";
import { appUrl } from "@/lib/config";

export const createContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const proposalId = optStr(fd, "proposalId");
  if (proposalId && !(await db.proposal.findFirst({ where: { id: proposalId, workspaceId: ctx.workspaceId, clientId: client.id } }))) throw new Error("La propuesta no pertenece a ese cliente.");
  const c = await createContract({
    workspaceId: ctx.workspaceId,
    clientId: client.id,
    proposalId,
    templateId: optStr(fd, "templateId"),
    providerName: ctx.user.name,
    providerEmail: ctx.user.email,
  });
  return { data: { href: `/app/contratos/${c.id}` } };
}, "/app/contratos");

export const updateContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const c = await db.contract.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { signers: true } });
  if (!c) throw new Error("Contrato no encontrado");
  if (c.signers.some((s) => s.signedAt)) throw new Error("El contrato ya tiene firmas: no se puede modificar. Anúlalo y crea uno nuevo.");
  await db.contract.update({ where: { id: c.id }, data: { title: required(fd, "title", "el título"), body: required(fd, "body", "el texto del contrato"), contentHash: null } });
  return "Contrato guardado";
}, "/app/contratos");

export const updateSignerAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const s = await db.contractSigner.findFirst({ where: { id: str(fd, "id"), contract: { workspaceId: ctx.workspaceId } } });
  if (!s) throw new Error("Firmante no encontrado");
  if (s.signedAt) throw new Error("Este firmante ya firmó.");
  const email = required(fd, "email", "el correo del firmante").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Escribe un correo válido.");
  await db.contractSigner.update({ where: { id: s.id }, data: { name: required(fd, "name", "el nombre"), email } });
  return "Firmante actualizado";
}, "/app/contratos");

export const sendContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const links = await sendContract(ctx.workspaceId, str(fd, "id"));
  const c = await db.contract.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await activity({ workspaceId: ctx.workspaceId, clientId: c.clientId, content: `Contrato ${c.number} enviado para firma`, userId: ctx.user.id });
  const l = links[0];
  return { message: l?.emailed ? `Enviado a ${l.email} para firma` : "Listo para firmar. Copia el enlace y compártelo.", data: { url: l?.url } };
}, "/app/contratos");

export const voidContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const c = await db.contract.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!c) throw new Error("Contrato no encontrado");
  await db.contract.update({ where: { id: c.id }, data: { status: "VOID" } });
  await activity({ workspaceId: ctx.workspaceId, clientId: c.clientId, content: `Contrato ${c.number} anulado`, userId: ctx.user.id });
  return "Contrato anulado";
}, "/app/contratos");

export const deleteContractAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const c = await db.contract.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!c) throw new Error("Contrato no encontrado");
  if (c.status !== "DRAFT") throw new Error("Solo se pueden eliminar borradores. Anula el contrato en su lugar.");
  await db.contract.delete({ where: { id: c.id } });
  return { message: "Borrador eliminado", data: { href: "/app/contratos" } };
}, "/app/contratos");

/** El firmante proveedor firma desde su propia cuenta: lleva al mismo flujo público con su token. */
export const providerSignLinkAction = action(async (fd) => {
  const ctx = await actionContext("contracts.manage");
  const s = await db.contractSigner.findFirst({ where: { contractId: str(fd, "id"), party: "PROVIDER", contract: { workspaceId: ctx.workspaceId } } });
  if (!s) throw new Error("No hay firmante del proveedor");
  const c = await db.contract.findUniqueOrThrow({ where: { id: s.contractId } });
  if (c.status === "DRAFT") await db.contract.update({ where: { id: c.id }, data: { status: "SENT", sentAt: new Date() } });
  return { data: { href: `/firmar/${s.token}` } };
}, "/app/contratos");

export async function draftContractWithAI(clientId: string, brief: string): Promise<{ text?: string; error?: string }> {
  try {
    const ctx = await actionContext("ai.use");
    const client = await assertClient(ctx.workspaceId, clientId);
    const text = await generate({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      feature: "contract.draft",
      effort: "high",
      context: `Proveedor: ${ctx.workspace.legalName || ctx.workspace.name}\nCliente: ${client.name}\nPaís/zona horaria: ${ctx.workspace.timezone}\nDescripción del servicio: ${brief}`,
      instructions:
        "Redacta un borrador de contrato de prestación de servicios con cláusulas numeradas: objeto, alcance, plazos, precio y forma de pago, revisiones y aprobaciones, confidencialidad, propiedad intelectual, protección de datos, resolución y legislación aplicable. Usa {{empresa.nombre}}, {{cliente.nombre}}, {{propuesta.total}} y {{fecha.hoy}} donde corresponda. Añade al final una nota breve recomendando revisión legal.",
    });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo generar." };
  }
}

export async function contractShareUrl(token: string) {
  return appUrl(`/firmar/${token}`);
}
