"use server";

import { stringList } from "@/lib/string-list";
import type { Priority, TaskStatus, ProjectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { action, optStr, str, required, optDate, bool } from "@/lib/action";
import { actionContext, assertClient, assertProject } from "@/lib/tenant";
import { activity, notifyTeam } from "@/lib/audit";
import { assertLimit } from "@/lib/services/workspace";
import { createProject, completeProject } from "@/lib/services/projects";
import { putFile } from "@/lib/storage";
import { generate } from "@/lib/ai";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/config";
import { toCents, date } from "@/lib/format";

const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELED"];

async function assertMember(workspaceId: string, userId: string | null) {
  if (!userId) return null;
  const m = await db.membership.findFirst({ where: { workspaceId, userId } });
  if (!m) throw new Error("La persona asignada no pertenece a la cuenta.");
  return userId;
}

export const createProjectAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  await assertLimit(ctx.workspaceId, "projects", "proyectos activos");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const p = await createProject({
    workspaceId: ctx.workspaceId,
    clientId: client.id,
    name: required(fd, "name", "el nombre del proyecto"),
    description: optStr(fd, "description"),
    templateId: optStr(fd, "templateId"),
    startDate: optDate(fd, "startDate"),
    dueDate: optDate(fd, "dueDate"),
    budget: str(fd, "budget") ? toCents(str(fd, "budget")) : null,
    managerId: await assertMember(ctx.workspaceId, optStr(fd, "managerId") ?? ctx.user.id),
    createdById: ctx.user.id,
  });
  return { message: "Proyecto creado", data: { href: `/app/proyectos/${p.id}` } };
}, "/app/proyectos");

export const updateProjectAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "id"));
  const status = str(fd, "status") as ProjectStatus;
  await db.project.update({
    where: { id: p.id },
    data: {
      name: required(fd, "name", "el nombre"),
      description: optStr(fd, "description"),
      objectives: str(fd, "objectives").split("\n").map((s) => s.trim()).filter(Boolean),
      startDate: optDate(fd, "startDate"),
      dueDate: optDate(fd, "dueDate"),
      budget: str(fd, "budget") ? toCents(str(fd, "budget")) : null,
      managerId: await assertMember(ctx.workspaceId, optStr(fd, "managerId")),
      visibleToClient: bool(fd, "visibleToClient"),
      ...(PROJECT_STATUSES.includes(status) && status !== "COMPLETED" ? { status } : {}),
    },
  });
  if (status === "COMPLETED" && p.status !== "COMPLETED") await completeProject(ctx.workspaceId, p.id);
  return "Proyecto actualizado";
}, "/app/proyectos");

export const setProjectStatusAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "id"));
  const status = str(fd, "status") as ProjectStatus;
  if (!PROJECT_STATUSES.includes(status)) throw new Error("Estado no válido");
  if (status === "COMPLETED") {
    await completeProject(ctx.workspaceId, p.id);
    return "Proyecto completado. Se ejecutaron las automatizaciones de cierre.";
  }
  await db.project.update({ where: { id: p.id }, data: { status, completedAt: null } });
  return "Estado actualizado";
}, "/app/proyectos");

export const deleteProjectAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "id"));
  await db.project.delete({ where: { id: p.id } });
  return { message: "Proyecto eliminado", data: { href: "/app/proyectos" } };
}, "/app/proyectos");

// ───────── Etapas e hitos ─────────

export const addStageAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "projectId"));
  const count = await db.stage.count({ where: { projectId: p.id } });
  await db.stage.create({ data: { projectId: p.id, name: required(fd, "name", "el nombre de la etapa"), sortOrder: count, dueDate: optDate(fd, "dueDate") } });
  return "Etapa añadida";
}, "/app/proyectos");

export const deleteStageAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  await db.stage.deleteMany({ where: { id: str(fd, "id"), project: { workspaceId: ctx.workspaceId } } });
  return "Etapa eliminada (sus tareas se conservan)";
}, "/app/proyectos");

export const addMilestoneAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "projectId"));
  await db.milestone.create({ data: { projectId: p.id, title: required(fd, "title", "el hito"), dueDate: optDate(fd, "dueDate"), visibleToClient: bool(fd, "visibleToClient") } });
  return "Hito añadido";
}, "/app/proyectos");

export const toggleMilestoneAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const m = await db.milestone.findFirst({ where: { id: str(fd, "id"), project: { workspaceId: ctx.workspaceId } }, include: { project: true } });
  if (!m) throw new Error("Hito no encontrado");
  await db.milestone.update({ where: { id: m.id }, data: { completedAt: m.completedAt ? null : new Date() } });
  if (!m.completedAt) await activity({ workspaceId: ctx.workspaceId, clientId: m.project.clientId, projectId: m.projectId, content: `Hito alcanzado: ${m.title}` });
  return m.completedAt ? "Hito reabierto" : "Hito alcanzado";
}, "/app/proyectos");

// ───────── Tareas ─────────

export const createTaskAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "projectId"));
  const parentId = optStr(fd, "parentId");
  if (parentId && !(await db.task.findFirst({ where: { id: parentId, projectId: p.id } }))) throw new Error("Tarea padre no válida");
  const stageId = optStr(fd, "stageId");
  if (stageId && !(await db.stage.findFirst({ where: { id: stageId, projectId: p.id } }))) throw new Error("Etapa no válida");
  const status = (str(fd, "status") as TaskStatus) || "TODO";
  const assigneeId = await assertMember(ctx.workspaceId, optStr(fd, "assigneeId"));
  const t = await db.task.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: p.id,
      stageId,
      parentId,
      title: required(fd, "title", "el título de la tarea"),
      description: optStr(fd, "description"),
      status: TASK_STATUSES.includes(status) ? status : "TODO",
      priority: PRIORITIES.includes(str(fd, "priority") as Priority) ? (str(fd, "priority") as Priority) : "MEDIUM",
      assigneeId,
      dueDate: optDate(fd, "dueDate"),
      forClient: bool(fd, "forClient"),
      visibleToClient: bool(fd, "visibleToClient") || bool(fd, "forClient"),
      createdById: ctx.user.id,
    },
  });
  if (assigneeId && assigneeId !== ctx.user.id) {
    await notifyTeam(ctx.workspaceId, { userId: assigneeId, title: `Nueva tarea: ${t.title}`, body: p.name, link: `/app/proyectos/${p.id}?tarea=${t.id}` });
  }
  return "Tarea creada";
}, ["/app/proyectos", "/app/tareas"]);

export const updateTaskAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const t = await db.task.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Tarea no encontrada");
  const status = str(fd, "status") as TaskStatus;
  const assigneeId = await assertMember(ctx.workspaceId, optStr(fd, "assigneeId"));
  const stageId = optStr(fd, "stageId");
  if (stageId && !(await db.stage.findFirst({ where: { id: stageId, projectId: t.projectId } }))) throw new Error("Etapa no válida");
  await db.task.update({
    where: { id: t.id },
    data: {
      title: required(fd, "title", "el título"),
      description: optStr(fd, "description"),
      status: TASK_STATUSES.includes(status) ? status : t.status,
      priority: PRIORITIES.includes(str(fd, "priority") as Priority) ? (str(fd, "priority") as Priority) : t.priority,
      assigneeId,
      stageId,
      startDate: optDate(fd, "startDate"),
      dueDate: optDate(fd, "dueDate"),
      estimateHours: str(fd, "estimateHours") ? Number(str(fd, "estimateHours")) : null,
      forClient: bool(fd, "forClient"),
      visibleToClient: bool(fd, "visibleToClient") || bool(fd, "forClient"),
      completedAt: status === "DONE" ? (t.completedAt ?? new Date()) : null,
    },
  });
  if (assigneeId && assigneeId !== t.assigneeId && assigneeId !== ctx.user.id) {
    await notifyTeam(ctx.workspaceId, { userId: assigneeId, title: `Te asignaron: ${t.title}`, link: `/app/proyectos/${t.projectId}?tarea=${t.id}` });
  }
  return "Tarea guardada";
}, ["/app/proyectos", "/app/tareas"]);

export const setTaskStatusAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const t = await db.task.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Tarea no encontrada");
  const status = str(fd, "status") as TaskStatus;
  if (!TASK_STATUSES.includes(status)) throw new Error("Estado no válido");
  await db.task.update({ where: { id: t.id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  return undefined;
}, ["/app/proyectos", "/app/tareas"]);

export const deleteTaskAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const t = await db.task.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Tarea no encontrada");
  await db.task.delete({ where: { id: t.id } });
  return { message: "Tarea eliminada", data: { href: `/app/proyectos/${t.projectId}` } };
}, ["/app/proyectos", "/app/tareas"]);

export const addCommentAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const t = await db.task.findFirst({ where: { id: str(fd, "taskId"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Tarea no encontrada");
  await db.taskComment.create({ data: { taskId: t.id, userId: ctx.user.id, body: required(fd, "body", "el comentario") } });
  if (t.assigneeId && t.assigneeId !== ctx.user.id) await notifyTeam(ctx.workspaceId, { userId: t.assigneeId, title: `${ctx.user.name} comentó en "${t.title}"`, link: `/app/proyectos/${t.projectId}?tarea=${t.id}` });
  return "Comentario añadido";
}, "/app/proyectos");

export const logTimeAction = action(async (fd) => {
  const ctx = await actionContext("tasks.manage");
  const t = await db.task.findFirst({ where: { id: str(fd, "taskId"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Tarea no encontrada");
  const hours = Number(str(fd, "hours").replace(",", "."));
  if (!hours || hours <= 0 || hours > 24) throw new Error("Escribe las horas dedicadas (entre 0,25 y 24).");
  await db.timeEntry.create({ data: { workspaceId: ctx.workspaceId, taskId: t.id, userId: ctx.user.id, minutes: Math.round(hours * 60), note: optStr(fd, "note"), date: optDate(fd, "date") ?? new Date() } });
  return `${hours} h registradas`;
}, ["/app/proyectos", "/app/equipo"]);

// ───────── Archivos con versiones ─────────

export const uploadFileAction = action(async (fd) => {
  const ctx = await actionContext("files.manage");
  const projectId = optStr(fd, "projectId");
  const project = projectId ? await assertProject(ctx.workspaceId, projectId) : null;
  const clientId = project?.clientId ?? optStr(fd, "clientId");
  if (clientId) await assertClient(ctx.workspaceId, clientId);
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Elige al menos un archivo.");
  await assertLimit(ctx.workspaceId, "storageMb", "almacenamiento");
  const existingId = optStr(fd, "fileId");
  for (const file of files) {
    const stored = await putFile(ctx.workspaceId, file);
    if (existingId) {
      const asset = await db.fileAsset.findFirst({ where: { id: existingId, workspaceId: ctx.workspaceId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      if (!asset) throw new Error("Archivo no encontrado");
      await db.fileVersion.create({ data: { fileId: asset.id, version: (asset.versions[0]?.version ?? 0) + 1, storageKey: stored.key, size: stored.size, note: optStr(fd, "note"), uploadedById: ctx.user.id } });
      await db.fileAsset.update({ where: { id: asset.id }, data: { mimeType: file.type || asset.mimeType, updatedAt: new Date() } });
    } else {
      await db.fileAsset.create({
        data: {
          workspaceId: ctx.workspaceId,
          projectId: project?.id ?? null,
          clientId,
          folder: optStr(fd, "folder") ?? "General",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          visibleToClient: bool(fd, "visibleToClient"),
          uploadedById: ctx.user.id,
          versions: { create: { version: 1, storageKey: stored.key, size: stored.size, uploadedById: ctx.user.id } },
        },
      });
    }
  }
  return existingId ? "Nueva versión subida" : `${files.length} archivo(s) subido(s)`;
}, ["/app/proyectos", "/app/clientes"]);

export const toggleFileVisibilityAction = action(async (fd) => {
  const ctx = await actionContext("files.manage");
  const f = await db.fileAsset.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!f) throw new Error("Archivo no encontrado");
  await db.fileAsset.update({ where: { id: f.id }, data: { visibleToClient: !f.visibleToClient } });
  return f.visibleToClient ? "Oculto para el cliente" : "Visible para el cliente";
}, "/app/proyectos");

export const deleteFileAction = action(async (fd) => {
  const ctx = await actionContext("files.manage");
  const f = await db.fileAsset.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { versions: true } });
  if (!f) throw new Error("Archivo no encontrado");
  const { deleteFile } = await import("@/lib/storage");
  for (const v of f.versions) await deleteFile(v.storageKey);
  await db.fileAsset.delete({ where: { id: f.id } });
  return "Archivo eliminado";
}, "/app/proyectos");

// ───────── Entregables y aprobaciones ─────────

export const createDeliverableAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const p = await assertProject(ctx.workspaceId, str(fd, "projectId"));
  const fileId = optStr(fd, "fileId");
  if (fileId && !(await db.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } }))) throw new Error("Archivo no válido");
  await db.deliverable.create({
    data: { workspaceId: ctx.workspaceId, projectId: p.id, title: required(fd, "title", "el título del entregable"), description: optStr(fd, "description"), fileId, link: optStr(fd, "link"), dueDate: optDate(fd, "dueDate") },
  });
  return "Entregable creado";
}, "/app/proyectos");

export const submitDeliverableAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const d = await db.deliverable.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, include: { project: { include: { client: { include: { contacts: true } }, workspace: true } } } });
  if (!d) throw new Error("Entregable no encontrado");
  if (d.fileId) await db.fileAsset.updateMany({ where: { id: d.fileId, workspaceId: ctx.workspaceId }, data: { visibleToClient: true } });
  await db.deliverable.update({ where: { id: d.id }, data: { status: "IN_REVIEW", submittedAt: new Date(), revisionCount: d.status === "CHANGES_REQUESTED" ? { increment: 1 } : undefined } });
  const client = d.project.client;
  const to = client.contacts.find((c) => c.isPrimary)?.email || client.email;
  if (to) {
    await sendEmail({
      workspaceId: ctx.workspaceId,
      to,
      subject: `Entrega lista para revisar: ${d.title}`,
      html: emailLayout(d.project.workspace, d.title, `Hola ${client.name},\n\nTienes una nueva entrega del proyecto "${d.project.name}" lista para revisar. Puedes aprobarla o pedir cambios desde tu portal.`, {
        label: "Revisar la entrega",
        url: appUrl(`/portal/${client.id}/proyectos/${d.projectId}`),
      }),
    });
  }
  await db.message.create({ data: { workspaceId: ctx.workspaceId, clientId: client.id, projectId: d.projectId, authorName: d.project.workspace.name, authorType: "SYSTEM", body: `Nueva entrega para revisar: "${d.title}".` } });
  await activity({ workspaceId: ctx.workspaceId, clientId: client.id, projectId: d.projectId, content: `Entregable "${d.title}" enviado a revisión` });
  return "Enviado al cliente para su aprobación";
}, "/app/proyectos");

export const deleteDeliverableAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  await db.deliverable.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Entregable eliminado";
}, "/app/proyectos");

// ───────── Solicitudes de cambio / ampliación ─────────

export const respondChangeRequestAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const cr = await db.changeRequest.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!cr) throw new Error("Solicitud no encontrada");
  const status = str(fd, "status");
  if (!["OPEN", "QUOTED", "APPROVED", "REJECTED", "DONE"].includes(status)) throw new Error("Estado no válido");
  await db.changeRequest.update({ where: { id: cr.id }, data: { status, response: optStr(fd, "response"), estimateAmount: str(fd, "estimate") ? toCents(str(fd, "estimate")) : cr.estimateAmount } });
  await db.message.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: cr.clientId,
      projectId: cr.projectId,
      authorId: ctx.user.id,
      authorName: ctx.user.name,
      authorType: "TEAM",
      body: `Tu solicitud "${cr.title}" ha cambiado de estado: ${{ OPEN: "abierta", QUOTED: "presupuestada", APPROVED: "aprobada", REJECTED: "rechazada", DONE: "completada" }[status]}.${optStr(fd, "response") ? `\n\n${optStr(fd, "response")}` : ""}`,
    },
  });
  if (status === "QUOTED" && str(fd, "createProposal") === "on") {
    const { nextNumber } = await import("@/lib/audit");
    const number = await nextNumber(ctx.workspaceId, "proposal");
    const prop = await db.proposal.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId: cr.clientId,
        number,
        title: cr.title,
        summary: cr.description,
        currency: ctx.workspace.currency,
        taxRate: ctx.workspace.taxRate,
        depositPercent: 0,
        validUntil: new Date(Date.now() + 15 * 86400_000),
        items: { create: [{ name: cr.title, unitPrice: str(fd, "estimate") ? toCents(str(fd, "estimate")) : 0 }] },
      },
    });
    await db.changeRequest.update({ where: { id: cr.id }, data: { proposalId: prop.id } });
    return { message: "Propuesta de ampliación creada", data: { href: `/app/propuestas/${prop.id}` } };
  }
  return "Solicitud actualizada y cliente avisado";
}, ["/app/proyectos", "/app/soporte"]);

// ───────── Documentos, informes y reuniones ─────────

export const saveDocumentAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const projectId = optStr(fd, "projectId");
  const project = projectId ? await assertProject(ctx.workspaceId, projectId) : null;
  const clientId = project?.clientId ?? optStr(fd, "clientId");
  if (clientId) await assertClient(ctx.workspaceId, clientId);
  const visible = bool(fd, "visibleToClient");
  const id = optStr(fd, "id");
  const data = {
    title: required(fd, "title", "el título"),
    body: required(fd, "body", "el contenido"),
    kind: optStr(fd, "kind") ?? "OTHER",
    visibleToClient: visible,
    publishedAt: visible ? new Date() : null,
  };
  if (id) {
    await db.document.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  } else {
    await db.document.create({ data: { ...data, workspaceId: ctx.workspaceId, projectId: project?.id ?? null, clientId, createdById: ctx.user.id } });
  }
  if (visible && clientId) await activity({ workspaceId: ctx.workspaceId, clientId, projectId, content: `Documento publicado en el portal: ${data.title}` });
  return "Documento guardado";
}, "/app/proyectos");

export const deleteDocumentAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  await db.document.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Documento eliminado";
}, "/app/proyectos");

const AI_DOCS: Record<string, { title: string; instructions: string }> = {
  BRIEF: { title: "Brief estratégico", instructions: "Redacta un brief estratégico: contexto, objetivos medibles, público, mensajes clave, alcance, riesgos y criterios de éxito." },
  PLAN: { title: "Plan de trabajo", instructions: "Redacta un plan de trabajo por fases con objetivos, tareas principales, responsables (cliente o equipo) y fechas relativas." },
  REPORT: { title: "Informe de progreso", instructions: "Redacta un informe de progreso para el cliente: resumen, avances desde la última vez, hitos, próximos pasos, bloqueos y lo que necesitamos del cliente. Tono profesional y positivo, sin inventar datos." },
  WELCOME: { title: "Documento de bienvenida", instructions: "Redacta un documento de bienvenida para el cliente: agradecimiento, cómo trabajaremos, canales de comunicación, próximos pasos y qué necesitamos de él." },
};

export const generateDocumentAction = action(async (fd) => {
  const ctx = await actionContext("ai.use");
  const p = await assertProject(ctx.workspaceId, str(fd, "projectId"));
  const kind = str(fd, "kind");
  const spec = AI_DOCS[kind];
  if (!spec) throw new Error("Tipo de documento no válido");
  const [client, tasks, milestones, deliverables, forms] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: p.clientId } }),
    db.task.findMany({ where: { projectId: p.id }, orderBy: { dueDate: "asc" } }),
    db.milestone.findMany({ where: { projectId: p.id } }),
    db.deliverable.findMany({ where: { projectId: p.id } }),
    db.formRequest.findMany({ where: { projectId: p.id, status: "SUBMITTED" }, include: { form: true } }),
  ]);
  const context = [
    `Proveedor: ${ctx.workspace.name}. Cliente: ${client.name} (${client.industry ?? "sector no indicado"}).`,
    `Proyecto: ${p.name}. Estado: ${p.status}. Inicio ${date(p.startDate)}, entrega ${date(p.dueDate)}.`,
    `Descripción: ${p.description ?? "-"}`,
    `Objetivos: ${stringList(p.objectives).join("; ") || "-"}`,
    `Tareas:`,
    ...tasks.map((t) => `- [${t.status}] ${t.title}${t.dueDate ? ` (vence ${date(t.dueDate)})` : ""}${t.forClient ? " [pendiente del cliente]" : ""}`),
    `Hitos: ${milestones.map((m) => `${m.title} ${m.completedAt ? "(hecho)" : `(${date(m.dueDate)})`}`).join("; ") || "-"}`,
    `Entregables: ${deliverables.map((d) => `${d.title} [${d.status}]`).join("; ") || "-"}`,
    ...forms.map((f) => `Respuestas del formulario "${f.form.name}": ${JSON.stringify(f.answers)}`),
    `Notas del usuario: ${str(fd, "notes") || "-"}`,
  ].join("\n");
  const body = await generate({ workspaceId: ctx.workspaceId, userId: ctx.user.id, feature: `document.${kind.toLowerCase()}`, context, instructions: spec.instructions, effort: "medium" });
  const doc = await db.document.create({
    data: { workspaceId: ctx.workspaceId, projectId: p.id, clientId: p.clientId, kind, title: `${spec.title} · ${p.name}`, body, visibleToClient: false, createdById: ctx.user.id },
  });
  return { message: "Documento generado como borrador. Revísalo y publícalo cuando quieras.", data: { href: `/app/proyectos/${p.id}?vista=documentos&doc=${doc.id}` } };
}, "/app/proyectos");

export const createMeetingAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const projectId = optStr(fd, "projectId");
  const project = projectId ? await assertProject(ctx.workspaceId, projectId) : null;
  const clientId = project?.clientId ?? optStr(fd, "clientId");
  if (clientId) await assertClient(ctx.workspaceId, clientId);
  const start = optDate(fd, "startsAt");
  if (!start) throw new Error("Elige la fecha y hora de la reunión.");
  const minutes = Number(str(fd, "duration")) || 45;
  const { getIntegration } = await import("@/lib/integrations");
  const video = optStr(fd, "videoUrl") ?? (await getIntegration(ctx.workspaceId, "VIDEO"))?.defaultUrl ?? null;
  await db.meeting.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: project?.id ?? null,
      clientId,
      title: required(fd, "title", "el título"),
      description: optStr(fd, "description"),
      startsAt: start,
      endsAt: new Date(start.getTime() + minutes * 60_000),
      videoUrl: video,
      location: optStr(fd, "location"),
      visibleToClient: bool(fd, "visibleToClient"),
      createdById: ctx.user.id,
    },
  });
  return "Reunión programada";
}, ["/app/proyectos", "/app/agenda"]);

export const updateMeetingAction = action(async (fd) => {
  const ctx = await actionContext("projects.manage");
  const m = await db.meeting.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!m) throw new Error("Reunión no encontrada");
  const status = str(fd, "status");
  await db.meeting.update({
    where: { id: m.id },
    data: { notes: optStr(fd, "notes") ?? m.notes, status: ["SCHEDULED", "DONE", "CANCELED"].includes(status) ? status : m.status },
  });
  return "Reunión actualizada";
}, ["/app/proyectos", "/app/agenda"]);

export const summarizeMeetingAction = action(async (fd) => {
  const ctx = await actionContext("ai.use");
  const m = await db.meeting.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!m) throw new Error("Reunión no encontrada");
  if (!m.notes?.trim()) throw new Error("Escribe o pega primero las notas o la transcripción de la reunión.");
  const summary = await generate({
    workspaceId: ctx.workspaceId,
    userId: ctx.user.id,
    feature: "meeting.summary",
    context: `Reunión: ${m.title} (${date(m.startsAt)})\nNotas o transcripción:\n${m.notes}`,
    instructions: "Resume la reunión en: resumen (3 frases), decisiones tomadas, tareas acordadas con responsable y fecha si se mencionan, y dudas abiertas.",
    effort: "low",
  });
  await db.meeting.update({ where: { id: m.id }, data: { summary, status: "DONE" } });
  if (m.clientId) {
    await db.document.create({ data: { workspaceId: ctx.workspaceId, clientId: m.clientId, projectId: m.projectId, kind: "MEETING_NOTES", title: `Resumen: ${m.title}`, body: summary, createdById: ctx.user.id } });
  }
  return "Resumen generado y guardado como documento";
}, ["/app/proyectos", "/app/agenda"]);
