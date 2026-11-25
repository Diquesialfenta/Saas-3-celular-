"use server";

import { db } from "@/lib/db";
import { action, str, required, bool } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { emailLayout, sendEmail, sendWhatsApp } from "@/lib/email";
import { appUrl } from "@/lib/config";

export const sendMessageAction = action(async (fd) => {
  const ctx = await actionContext("clients.view");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  const body = required(fd, "body", "el mensaje");
  await db.message.create({ data: { workspaceId: ctx.workspaceId, clientId: client.id, authorId: ctx.user.id, authorName: ctx.user.name, authorType: "TEAM", body } });
  const access = await db.portalAccess.findMany({ where: { clientId: client.id, isActive: true }, include: { user: true } });
  for (const a of access) {
    await sendEmail({
      workspaceId: ctx.workspaceId,
      to: a.user.email,
      subject: `Nuevo mensaje de ${ctx.workspace.name}`,
      html: emailLayout(ctx.workspace, `Mensaje de ${ctx.user.name}`, body, { label: "Responder en el portal", url: appUrl(`/portal/${client.id}/mensajes`) }),
    });
  }
  if (bool(fd, "whatsapp") && client.phone) {
    const r = await sendWhatsApp(ctx.workspaceId, client.phone, `${ctx.workspace.name}: ${body}`);
    if (!r.ok) return `Mensaje enviado al portal. WhatsApp no se envió (${r.reason === "NOT_CONFIGURED" ? "no está configurado" : r.reason}).`;
  }
  return undefined;
}, "/app/mensajes");
