"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { bindings } from "@/lib/bindings";
import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { clientIp } from "@/lib/auth";
import { activity, notifyTeam } from "@/lib/audit";
import { emit } from "@/lib/automations";
import { signContract } from "@/lib/services/contracts";
import { getIntegration } from "@/lib/integrations";
import { appUrl } from "@/lib/config";
import { emailLayout, sendEmail } from "@/lib/email";

// ───────── Propuesta pública ─────────

export const acceptProposalAction = action(async (fd) => {
  const p = await db.proposal.findUnique({ where: { publicToken: str(fd, "token") }, include: { items: true } });
  if (!p || p.status === "DRAFT") throw new Error("Propuesta no encontrada");
  if (p.status === "ACCEPTED") return "Esta propuesta ya estaba aceptada.";
  if (p.status === "DECLINED") throw new Error("Esta propuesta fue rechazada. Pide una nueva al proveedor.");
  if (p.status === "EXPIRED" || (p.validUntil && p.validUntil < new Date())) {
    await db.proposal.updateMany({ where: { id: p.id, status: { in: ["SENT", "VIEWED"] } }, data: { status: "EXPIRED" } });
    throw new Error("La propuesta ha caducado. Pide al proveedor que la renueve.");
  }
  const name = required(fd, "name", "tu nombre");
  const email = required(fd, "email", "tu correo").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Escribe un correo válido con @.");
  if (str(fd, "agree") !== "on") throw new Error("Marca la casilla para confirmar la aceptación.");
  const selected = new Set(fd.getAll("optional").map(String));
  const h = await headers();
  const { DB } = bindings();
  const now = new Date().toISOString();
  const [, accepted] = await DB.batch([
    DB.prepare(`
      UPDATE "ProposalItem" SET "isSelected" = "id" IN (SELECT value FROM json_each(?))
      WHERE "proposalId" = ? AND "isOptional" = 1
        AND EXISTS (SELECT 1 FROM "Proposal" WHERE "id" = ? AND "status" IN ('SENT', 'VIEWED'))
    `).bind(JSON.stringify([...selected]), p.id, p.id),
    DB.prepare(`
      UPDATE "Proposal" SET "status" = 'ACCEPTED', "acceptedAt" = ?, "acceptedByName" = ?,
        "acceptedByEmail" = ?, "acceptedIp" = ?, "updatedAt" = ?
      WHERE "id" = ? AND "status" IN ('SENT', 'VIEWED')
    `).bind(now, name, email, clientIp(h), now, p.id),
  ]);
  if (!accepted.meta.changes) return "La propuesta ya fue respondida.";
  if (p.dealId) await db.deal.update({ where: { id: p.dealId }, data: { stage: "WON", status: "WON", probability: 100, closedAt: new Date() } });
  await db.client.update({ where: { id: p.clientId }, data: { status: "ACTIVE" } });
  await activity({ workspaceId: p.workspaceId, clientId: p.clientId, content: `${name} aceptó la propuesta ${p.number}` });
  await notifyTeam(p.workspaceId, { title: `Propuesta ${p.number} aceptada`, body: `${name} · ${p.title}`, link: `/app/propuestas/${p.id}` });
  await emit(p.workspaceId, "proposal.accepted", { clientId: p.clientId, proposalId: p.id });
  return "¡Propuesta aceptada! Recibirás el contrato y los siguientes pasos por correo.";
}, "/p");

export const declineProposalAction = action(async (fd) => {
  const p = await db.proposal.findUnique({ where: { publicToken: str(fd, "token") } });
  if (!p || (p.status !== "SENT" && p.status !== "VIEWED") || (p.validUntil && p.validUntil < new Date())) {
    throw new Error("No se puede rechazar esta propuesta.");
  }
  const declined = await db.proposal.updateMany({
    where: { id: p.id, status: { in: ["SENT", "VIEWED"] } },
    data: { status: "DECLINED", declinedAt: new Date(), declineReason: optStr(fd, "reason") },
  });
  if (!declined.count) throw new Error("La propuesta ya fue respondida.");
  if (p.dealId) await db.deal.update({ where: { id: p.dealId }, data: { stage: "LOST", status: "LOST", lostReason: optStr(fd, "reason"), closedAt: new Date() } });
  await activity({ workspaceId: p.workspaceId, clientId: p.clientId, content: `Propuesta ${p.number} rechazada${optStr(fd, "reason") ? `: ${optStr(fd, "reason")}` : ""}` });
  await notifyTeam(p.workspaceId, { title: `Propuesta ${p.number} rechazada`, link: `/app/propuestas/${p.id}` });
  await emit(p.workspaceId, "proposal.declined", { clientId: p.clientId, proposalId: p.id });
  return "Gracias por responder. Hemos avisado al equipo.";
}, "/p");

// ───────── Firma de contrato ─────────

export const signContractAction = action(async (fd) => {
  const signer = await db.contractSigner.findUnique({ where: { token: str(fd, "token") }, include: { contract: true } });
  if (!signer) throw new Error("Enlace de firma no válido.");
  if (signer.contract.status === "DRAFT") throw new Error("El contrato todavía no se ha enviado para firma.");
  if (str(fd, "agree") !== "on") throw new Error("Marca la casilla para aceptar el contrato.");
  const typedName = required(fd, "typedName", "tu nombre completo");
  const signature = str(fd, "signature");
  if (!signature) throw new Error("Dibuja tu firma en el recuadro.");
  const h = await headers();
  await signContract({ signerId: signer.id, typedName, signatureData: signature, ip: clientIp(h), userAgent: h.get("user-agent") });
  return "Contrato firmado. Te hemos enviado una copia.";
}, ["/firmar", "/app/contratos"]);

// ───────── Pago de factura (Stripe de la cuenta) ─────────

export const payInvoiceAction = action(async (fd) => {
  const inv = await db.invoice.findUnique({ where: { publicToken: str(fd, "token") }, include: { client: true } });
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.status === "PAID" || inv.status === "VOID" || inv.status === "DRAFT") throw new Error("Esta factura no admite pagos.");
  const cfg = await getIntegration(inv.workspaceId, "STRIPE");
  if (!cfg) throw new Error("El proveedor no tiene activado el pago con tarjeta. Usa los datos de transferencia de la factura.");
  const stripe = new Stripe(cfg.secretKey);
  const due = inv.total - inv.amountPaid;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: inv.client.email ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: inv.currency.toLowerCase(), unit_amount: due, product_data: { name: `Factura ${inv.number}` } } }],
    metadata: { invoiceId: inv.id, workspaceId: inv.workspaceId },
    success_url: appUrl(`/i/${inv.publicToken}?pago=ok`),
    cancel_url: appUrl(`/i/${inv.publicToken}`),
  });
  await db.invoice.update({ where: { id: inv.id }, data: { stripeSessionId: session.id } });
  redirect(session.url!);
}, "/i");

// ───────── Formulario inteligente ─────────

type FormField = { id: string; type: string; label: string; required?: boolean; options?: string[] };

export const submitFormAction = action(async (fd) => {
  const req = await db.formRequest.findUnique({ where: { token: str(fd, "token") }, include: { form: true } });
  if (!req) throw new Error("Formulario no encontrado");
  if (req.status === "SUBMITTED") return "Este formulario ya se envió. ¡Gracias!";
  const fields = req.form.fields as FormField[];
  const answers: Record<string, string | string[]> = {};
  for (const f of fields) {
    const v = f.type === "checkbox" ? fd.getAll(f.id).map(String) : str(fd, f.id);
    if (f.required && (!v || (Array.isArray(v) && v.length === 0))) throw new Error(`Completa el campo "${f.label}".`);
    answers[f.id] = v;
  }
  await db.formRequest.update({ where: { id: req.id }, data: { status: "SUBMITTED", answers, submittedAt: new Date() } });
  await activity({ workspaceId: req.workspaceId, clientId: req.clientId, content: `Formulario "${req.form.name}" completado` });
  await notifyTeam(req.workspaceId, { title: `Formulario "${req.form.name}" recibido`, link: `/app/clientes/${req.clientId}` });
  if (req.projectId) {
    await db.task.updateMany({ where: { projectId: req.projectId, forClient: true, title: { contains: "formulario" }, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
  }
  await emit(req.workspaceId, "form.submitted", { clientId: req.clientId, formRequestId: req.id, projectId: req.projectId ?? undefined });
  return "Formulario enviado. ¡Gracias!";
}, ["/formulario", "/portal"]);

// ───────── Encuesta y testimonio ─────────

export const submitSurveyAction = action(async (fd) => {
  const r = await db.surveyResponse.findUnique({ where: { token: str(fd, "token") } });
  if (!r) throw new Error("Encuesta no encontrada");
  if (r.completedAt) return "Ya habías respondido. ¡Gracias!";
  const score = Number(str(fd, "score"));
  if (!Number.isInteger(score) || score < 0 || score > 10) throw new Error("Elige una puntuación del 0 al 10.");
  await db.surveyResponse.update({ where: { id: r.id }, data: { score, comment: optStr(fd, "comment"), completedAt: new Date() } });
  await notifyTeam(r.workspaceId, { title: `Nueva respuesta de satisfacción: ${score}/10`, link: "/app/fidelizacion" });
  return "Gracias por tu respuesta.";
}, "/encuesta");

export const submitTestimonialAction = action(async (fd) => {
  const t = await db.testimonial.findUnique({ where: { token: str(fd, "token") } });
  if (!t) throw new Error("Solicitud no encontrada");
  if (t.status !== "REQUESTED") return "Ya recibimos tu testimonio. ¡Gracias!";
  const rating = Number(str(fd, "rating")) || null;
  await db.testimonial.update({
    where: { id: t.id },
    data: { content: required(fd, "content", "tu testimonio"), authorName: required(fd, "authorName", "tu nombre"), authorRole: optStr(fd, "authorRole"), rating, status: "SUBMITTED", submittedAt: new Date() },
  });
  await notifyTeam(t.workspaceId, { title: "Nuevo testimonio recibido", link: "/app/fidelizacion" });
  return "¡Gracias por tu testimonio!";
}, "/testimonio");

// ───────── Reserva de reunión ─────────

export const bookMeetingAction = action(async (fd) => {
  const link = await db.bookingLink.findUnique({ where: { slug: str(fd, "slug") } });
  if (!link || !link.isActive) throw new Error("Este enlace de agenda no está disponible.");
  const startsAt = new Date(str(fd, "slot"));
  if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) throw new Error("Elige un horario disponible.");
  const endsAt = new Date(startsAt.getTime() + link.durationMin * 60_000);
  const clash = await db.meeting.findFirst({ where: { workspaceId: link.workspaceId, status: "SCHEDULED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
  if (clash) throw new Error("Ese horario acaba de ocuparse. Elige otro.");
  const name = required(fd, "name", "tu nombre");
  const email = required(fd, "email", "tu correo").toLowerCase();
  const clientId = optStr(fd, "clientId");
  const client = clientId ? await db.client.findFirst({ where: { id: clientId, workspaceId: link.workspaceId } }) : null;
  const video = link.videoUrl || (await getIntegration(link.workspaceId, "VIDEO"))?.defaultUrl || null;
  const m = await db.meeting.create({
    data: {
      workspaceId: link.workspaceId,
      clientId: client?.id ?? null,
      title: `${link.title} · ${client?.name ?? name}`,
      description: optStr(fd, "notes"),
      startsAt,
      endsAt,
      videoUrl: video,
      guestName: name,
      guestEmail: email,
    },
  });
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: link.workspaceId } });
  await sendEmail({
    workspaceId: ws.id,
    to: email,
    subject: `Reunión confirmada con ${ws.name}`,
    html: emailLayout(ws, "Reunión confirmada", `Hola ${name},\n\n${link.title}\n${startsAt.toLocaleString("es", { dateStyle: "full", timeStyle: "short", timeZone: ws.timezone })} (${ws.timezone})${video ? `\n\nEnlace de videollamada: ${video}` : ""}`, {
      label: "Añadir a mi calendario",
      url: appUrl(`/api/ics/meeting/${m.id}`),
    }),
  });
  if (client) await activity({ workspaceId: ws.id, clientId: client.id, type: "MEETING", content: `Reunión agendada: ${m.title}` });
  await notifyTeam(ws.id, { title: `Nueva reunión: ${m.title}`, body: startsAt.toLocaleString("es", { timeZone: ws.timezone }), link: "/app/agenda" });
  return { message: "Reunión confirmada. Te hemos enviado los detalles por correo.", data: { booked: true } };
}, "/agenda");
