"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/config";

export const replyTicketTeamAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const t = await db.ticket.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { messages: { where: { authorType: "CLIENT" }, take: 1 } } });
  if (!t) throw new Error("Ticket no encontrado");
  const body = required(fd, "body", "la respuesta");
  await db.ticketMessage.create({ data: { ticketId: t.id, authorId: ctx.user.id, authorName: ctx.user.name, authorType: "TEAM", body } });
  const status = ["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(str(fd, "status")) ? str(fd, "status") : "PENDING";
  await db.ticket.update({ where: { id: t.id }, data: { status, assigneeId: t.assigneeId ?? ctx.user.id } });
  const access = await db.portalAccess.findMany({ where: { clientId: t.clientId, isActive: true }, include: { user: true } });
  for (const a of access) {
    await sendEmail({
      workspaceId: ctx.workspaceId,
      to: a.user.email,
      subject: `Respuesta a tu ticket #${t.number}: ${t.subject}`,
      html: emailLayout(ctx.workspace, `Ticket #${t.number}`, body, { label: "Ver el ticket", url: appUrl(`/portal/${t.clientId}/soporte?ticket=${t.id}`) }),
    });
  }
  return "Respuesta enviada al cliente";
}, "/app/soporte");

export const updateTicketAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const t = await db.ticket.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Ticket no encontrado");
  const assigneeId = optStr(fd, "assigneeId");
  if (assigneeId && !(await db.membership.findFirst({ where: { workspaceId: ctx.workspaceId, userId: assigneeId } }))) throw new Error("Responsable no válido");
  const status = str(fd, "status");
  const priority = str(fd, "priority");
  await db.ticket.update({
    where: { id: t.id },
    data: {
      assigneeId,
      ...(["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(status) ? { status } : {}),
      ...(["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" } : {}),
    },
  });
  return "Ticket actualizado";
}, "/app/soporte");
