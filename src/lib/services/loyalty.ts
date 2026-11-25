import "server-only";
import { db } from "../db";
import { appUrl } from "../config";
import { emailLayout, sendEmail } from "../email";

async function clientEmail(workspaceId: string, clientId: string) {
  const client = await db.client.findFirstOrThrow({ where: { id: clientId, workspaceId }, include: { contacts: true, workspace: true } });
  const contact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  return { client, ws: client.workspace, email: contact?.email || client.email, name: contact?.name || client.name };
}

export async function sendSurvey(workspaceId: string, surveyId: string, clientId: string, projectId?: string | null) {
  const survey = await db.survey.findFirstOrThrow({ where: { id: surveyId, workspaceId } });
  const { ws, email, name } = await clientEmail(workspaceId, clientId);
  const resp = await db.surveyResponse.create({ data: { workspaceId, surveyId, clientId, projectId: projectId ?? null } });
  const url = appUrl(`/encuesta/${resp.token}`);
  if (email) {
    await sendEmail({
      workspaceId,
      to: email,
      subject: `${ws.name}: ¿cómo lo hicimos?`,
      html: emailLayout(ws, survey.question, `Hola ${name},\n\nTu opinión nos ayuda a mejorar. Responder lleva menos de un minuto.`, { label: "Responder la encuesta", url }),
    });
  }
  return { url };
}

export async function requestTestimonial(workspaceId: string, clientId: string) {
  const { ws, email, name } = await clientEmail(workspaceId, clientId);
  const t = await db.testimonial.create({ data: { workspaceId, clientId, authorName: name } });
  const url = appUrl(`/testimonio/${t.token}`);
  if (email) {
    await sendEmail({
      workspaceId,
      to: email,
      subject: `${ws.name} te pide una breve reseña`,
      html: emailLayout(ws, "¿Nos dejas tu testimonio?", `Hola ${name},\n\nSi quedaste contento con el trabajo, unas líneas tuyas ayudan a otros clientes a decidir. Tú eliges si se publica tu nombre.`, {
        label: "Escribir mi testimonio",
        url,
      }),
    });
  }
  return { url };
}
