import "server-only";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";
import { appUrl } from "../config";
import { emailLayout, sendEmail } from "../email";
import { activity } from "../audit";

/** Invita a un contacto del cliente a su portal privado. Devuelve el enlace (también se envía por correo). */
export async function invitePortal(workspaceId: string, clientId: string, email: string, name?: string) {
  const client = await db.client.findFirst({ where: { id: clientId, workspaceId }, include: { workspace: true } });
  if (!client) throw new Error("Cliente no encontrado");
  const normalized = email.trim().toLowerCase();
  const token = randomToken();
  await db.token.create({
    data: {
      type: "PORTAL_INVITE",
      tokenHash: sha256(token),
      email: normalized,
      workspaceId,
      clientId,
      meta: { name: name ?? client.name },
      expiresAt: new Date(Date.now() + 14 * 86400_000),
    },
  });
  const url = appUrl(`/invitacion/${token}`);
  const ws = client.workspace;
  const result = await sendEmail({
    workspaceId,
    to: normalized,
    subject: `${ws.name} te da acceso a tu portal de cliente`,
    html: emailLayout(
      ws,
      ws.portalTitle || `Tu portal con ${ws.name}`,
      `Hola ${name ?? client.name},\n\n${ws.portalWelcome || `Desde tu portal podrás seguir el avance de tus proyectos, aprobar entregas, firmar documentos, ver tus pagos y hablar directamente con ${ws.name}.`}\n\nEl enlace es personal y caduca en 14 días.`,
      { label: "Activar mi portal", url },
    ),
  });
  await activity({ workspaceId, clientId, content: `Invitación al portal enviada a ${normalized}` });
  return { url, emailed: result.ok };
}
