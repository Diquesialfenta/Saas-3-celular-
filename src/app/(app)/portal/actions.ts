"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { portalActionContext } from "@/lib/tenant";
import { activity, notifyTeam } from "@/lib/audit";
import { emit } from "@/lib/automations";
import { putFile } from "@/lib/storage";
import { chat } from "@/lib/ai";
import { portalContext } from "@/lib/assistant-context";

export const portalSendMessageAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const body = required(fd, "body", "el mensaje");
  await db.message.create({ data: { workspaceId: ctx.workspaceId, clientId: ctx.clientId, projectId: optStr(fd, "projectId"), authorId: ctx.user.id, authorName: ctx.user.name, authorType: "CLIENT", body } });
  await notifyTeam(ctx.workspaceId, { title: `Mensaje de ${ctx.client.name}`, body: body.slice(0, 120), link: `/app/mensajes?cliente=${ctx.clientId}` });
  return undefined;
}, "/portal");

export const reviewDeliverableAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const d = await db.deliverable.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId, project: { clientId: ctx.clientId } }, include: { project: true } });
  if (!d) throw new Error("Entregable no encontrado");
  if (d.status !== "IN_REVIEW") throw new Error("Este entregable no está pendiente de revisión.");
  const decision = str(fd, "decision") === "APPROVED" ? "APPROVED" : "CHANGES";
  const comment = optStr(fd, "comment");
  if (decision === "CHANGES" && !comment) throw new Error("Describe qué cambios necesitas.");
  await db.deliverableReview.create({ data: { deliverableId: d.id, decision, comment, reviewerId: ctx.user.id, reviewerName: ctx.user.name } });
  await db.deliverable.update({ where: { id: d.id }, data: { status: decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED", approvedAt: decision === "APPROVED" ? new Date() : null } });
  await activity({ workspaceId: ctx.workspaceId, clientId: ctx.clientId, projectId: d.projectId, content: `${ctx.user.name} ${decision === "APPROVED" ? "aprobó" : "pidió cambios en"} "${d.title}"` });
  await notifyTeam(ctx.workspaceId, {
    title: decision === "APPROVED" ? `Entregable aprobado: ${d.title}` : `Cambios pedidos en: ${d.title}`,
    body: comment ?? undefined,
    link: `/app/proyectos/${d.projectId}?vista=entregables`,
  });
  await emit(ctx.workspaceId, decision === "APPROVED" ? "deliverable.approved" : "deliverable.changes_requested", { clientId: ctx.clientId, projectId: d.projectId, deliverableId: d.id });
  return decision === "APPROVED" ? "Entrega aprobada. ¡Gracias!" : "Hemos enviado tus comentarios al equipo.";
}, "/portal");

export const portalUploadAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const projectId = optStr(fd, "projectId");
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId, clientId: ctx.clientId } }))) throw new Error("Proyecto no válido");
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Elige al menos un archivo.");
  for (const file of files) {
    const stored = await putFile(ctx.workspaceId, file);
    await db.fileAsset.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId: ctx.clientId,
        projectId,
        folder: "Recibido del cliente",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        visibleToClient: true,
        source: "CLIENT",
        uploadedById: ctx.user.id,
        versions: { create: { version: 1, storageKey: stored.key, size: stored.size, uploadedById: ctx.user.id } },
      },
    });
  }
  if (projectId) {
    await db.task.updateMany({ where: { projectId, forClient: true, title: { startsWith: "Subir archivos" }, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
  }
  await notifyTeam(ctx.workspaceId, { title: `${ctx.client.name} subió ${files.length} archivo(s)`, link: projectId ? `/app/proyectos/${projectId}?vista=archivos` : `/app/clientes/${ctx.clientId}` });
  return `${files.length} archivo(s) enviado(s)`;
}, "/portal");

export const completeClientTaskAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const t = await db.task.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId, forClient: true, project: { clientId: ctx.clientId } } });
  if (!t) throw new Error("Tarea no encontrada");
  await db.task.update({ where: { id: t.id }, data: { status: "DONE", completedAt: new Date() } });
  await notifyTeam(ctx.workspaceId, { title: `${ctx.client.name} completó: ${t.title}`, link: `/app/proyectos/${t.projectId}?tarea=${t.id}` });
  return "Marcado como hecho";
}, "/portal");

export const requestChangeAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const projectId = optStr(fd, "projectId");
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId, clientId: ctx.clientId } }))) throw new Error("Proyecto no válido");
  const serviceId = optStr(fd, "serviceId");
  const service = serviceId ? await db.service.findFirst({ where: { id: serviceId, workspaceId: ctx.workspaceId, visibleInPortal: true, isActive: true } }) : null;
  const type = service ? "NEW_SERVICE" : ["MODIFICATION", "SCOPE_EXTENSION"].includes(str(fd, "type")) ? str(fd, "type") : "MODIFICATION";
  const cr = await db.changeRequest.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      projectId,
      serviceId: service?.id ?? null,
      type,
      title: service ? `Contratar: ${service.name}` : required(fd, "title", "un título para tu solicitud"),
      description: optStr(fd, "description") ?? service?.description ?? "",
      estimateAmount: service?.price ?? null,
      requestedById: ctx.user.id,
    },
  });
  await notifyTeam(ctx.workspaceId, { title: `${ctx.client.name}: ${cr.title}`, link: projectId ? `/app/proyectos/${projectId}?vista=cambios` : "/app/soporte?vista=solicitudes" });
  await emit(ctx.workspaceId, "change_request.created", { clientId: ctx.clientId, changeRequestId: cr.id, projectId: projectId ?? undefined });
  return service ? "Solicitud enviada. Te enviaremos la propuesta para confirmarla." : "Solicitud enviada al equipo.";
}, "/portal");

export const createTicketAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const last = await db.ticket.findFirst({ where: { workspaceId: ctx.workspaceId }, orderBy: { number: "desc" } });
  const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(str(fd, "priority")) ? (str(fd, "priority") as "LOW" | "MEDIUM" | "HIGH" | "URGENT") : "MEDIUM";
  const t = await db.ticket.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      projectId: optStr(fd, "projectId"),
      number: (last?.number ?? 0) + 1,
      subject: required(fd, "subject", "el asunto"),
      priority,
      createdById: ctx.user.id,
      messages: { create: { authorId: ctx.user.id, authorName: ctx.user.name, authorType: "CLIENT", body: required(fd, "body", "la descripción del problema") } },
    },
  });
  await notifyTeam(ctx.workspaceId, { title: `Ticket #${t.number}: ${t.subject}`, body: ctx.client.name, link: `/app/soporte/${t.id}` });
  await emit(ctx.workspaceId, "ticket.created", { clientId: ctx.clientId, ticketId: t.id });
  return { message: `Ticket #${t.number} abierto`, data: { href: `/portal/${ctx.clientId}/soporte?ticket=${t.id}` } };
}, "/portal");

export const replyTicketAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const t = await db.ticket.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId, clientId: ctx.clientId } });
  if (!t) throw new Error("Ticket no encontrado");
  await db.ticketMessage.create({ data: { ticketId: t.id, authorId: ctx.user.id, authorName: ctx.user.name, authorType: "CLIENT", body: required(fd, "body", "tu respuesta") } });
  await db.ticket.update({ where: { id: t.id }, data: { status: t.status === "RESOLVED" || t.status === "CLOSED" ? "OPEN" : t.status === "PENDING" ? "OPEN" : t.status } });
  await notifyTeam(ctx.workspaceId, { title: `Respuesta en ticket #${t.number}`, link: `/app/soporte/${t.id}` });
  return "Respuesta enviada";
}, "/portal");

export const referFriendAction = action(async (fd) => {
  const ctx = await portalActionContext(str(fd, "clientId"));
  const email = required(fd, "email", "el correo de tu contacto").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Escribe un correo válido.");
  const exists = await db.referral.findFirst({ where: { workspaceId: ctx.workspaceId, email } });
  if (exists) return "Ya teníamos esta recomendación. ¡Gracias!";
  await db.referral.create({
    data: { workspaceId: ctx.workspaceId, referrerClientId: ctx.clientId, name: required(fd, "name", "el nombre"), email, company: optStr(fd, "company"), note: optStr(fd, "note") },
  });
  await notifyTeam(ctx.workspaceId, { title: `Nueva recomendación de ${ctx.client.name}`, link: "/app/fidelizacion?vista=referidos" });
  return "¡Gracias por recomendarnos! Contactaremos con tu contacto mencionando tu nombre.";
}, "/portal");

export async function askPortalAssistant(clientId: string, message: string): Promise<{ reply?: string; error?: string }> {
  try {
    const ctx = await portalActionContext(clientId);
    const q = message.trim().slice(0, 2000);
    if (!q) return { error: "Escribe una pregunta." };
    const history = await db.assistantMessage.findMany({ where: { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "PORTAL", clientId }, orderBy: { createdAt: "desc" }, take: 10 });
    const reply = await chat({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      scope: "PORTAL",
      clientId,
      system: `Eres el asistente del portal de clientes de ${ctx.workspace.name}. Atiendes a ${ctx.user.name}, de ${ctx.client.name}. Respondes dudas sobre el estado de sus proyectos, entregas, facturas, contratos y reuniones, y explicas cómo usar el portal. No prometes plazos, precios ni cambios que no estén en los datos: para eso, sugiere escribir al equipo en Mensajes o abrir un ticket. Responde breve, en español y con amabilidad.`,
      context: await portalContext(ctx.workspaceId, clientId),
      history: [...history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content })), { role: "user", content: q }],
    });
    await db.assistantMessage.createMany({
      data: [
        { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "PORTAL", clientId, role: "user", content: q },
        { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "PORTAL", clientId, role: "assistant", content: reply },
      ],
    });
    return { reply };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo responder." };
  }
}

