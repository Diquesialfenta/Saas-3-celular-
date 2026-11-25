import "server-only";
import { db } from "../db";
import type { DocumentTemplate, OnboardingTemplate } from "../templates";
import { fillTemplate } from "../format";
import { appUrl } from "../config";
import { invitePortal } from "./portal";
import { createProject } from "./projects";
import { activity } from "../audit";

export type OnboardingStep = { key: string; label: string; done: boolean; ref?: string | null };

/**
 * Onboarding automático tras la contratación:
 * 1. activa el portal e invita al contacto principal
 * 2. publica el documento y el mensaje de bienvenida
 * 3. solicita el formulario inteligente
 * 4. pide los archivos necesarios (tarea del cliente)
 * 5. crea el proyecto desde su plantilla con etapas y tareas
 * 6. comparte el enlace para agendar la reunión estratégica inicial
 */
export async function startOnboarding(input: { workspaceId: string; clientId: string; templateId?: string | null; userId?: string | null }) {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: input.workspaceId } });
  const client = await db.client.findFirstOrThrow({ where: { id: input.clientId, workspaceId: input.workspaceId }, include: { contacts: true } });
  let tpl: OnboardingTemplate | null = null;
  if (input.templateId) {
    const t = await db.template.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId, type: "ONBOARDING" } });
    tpl = (t?.content as OnboardingTemplate) ?? null;
  }
  if (!tpl) {
    const welcomeDoc = await db.template.findFirst({ where: { workspaceId: input.workspaceId, type: "DOCUMENT" }, orderBy: { createdAt: "asc" } });
    const d = welcomeDoc?.content as DocumentTemplate | undefined;
    const form = await db.form.findFirst({ where: { workspaceId: input.workspaceId }, orderBy: { createdAt: "asc" } });
    const project = await db.template.findFirst({ where: { workspaceId: input.workspaceId, type: "PROJECT" }, orderBy: { createdAt: "asc" } });
    const booking = await db.bookingLink.findFirst({ where: { workspaceId: input.workspaceId, isActive: true } });
    tpl = {
      welcomeTitle: d?.title ?? `Bienvenido a ${ws.name}`,
      welcomeBody: d?.body ?? `Hola {{cliente.nombre}}, gracias por confiar en ${ws.name}.`,
      formId: form?.id ?? null,
      projectTemplateId: project?.id ?? null,
      bookingLinkId: booking?.id ?? null,
      fileRequest: "Logotipos, accesos y materiales de referencia",
    };
  }
  const vars = {
    cliente: { nombre: client.name, email: client.email ?? "" },
    empresa: { nombre: ws.name, email: ws.email ?? "" },
    fecha: { hoy: new Date().toLocaleDateString("es", { dateStyle: "long" }) },
  };
  const steps: OnboardingStep[] = [];

  // 1. Portal
  const contact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  const email = contact?.email || client.email;
  const hasAccess = await db.portalAccess.count({ where: { clientId: client.id, isActive: true } });
  if (email && !hasAccess) {
    const inv = await invitePortal(input.workspaceId, client.id, email, contact?.name ?? client.name);
    steps.push({ key: "portal", label: `Portal activado e invitación enviada a ${email}`, done: true, ref: inv.url });
  } else {
    steps.push({
      key: "portal",
      label: hasAccess ? "El cliente ya tiene acceso al portal" : "Añade un correo al cliente para invitarlo al portal",
      done: !!hasAccess,
    });
  }

  // 2. Bienvenida
  const doc = await db.document.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: client.id,
      kind: "WELCOME",
      title: fillTemplate(tpl.welcomeTitle, vars),
      body: fillTemplate(tpl.welcomeBody, vars),
      visibleToClient: true,
      publishedAt: new Date(),
      createdById: input.userId ?? null,
    },
  });
  await db.message.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: client.id,
      authorName: ws.name,
      authorType: "SYSTEM",
      body: `¡Bienvenido! Hemos preparado tu portal. Empieza por el documento "${doc.title}".`,
    },
  });
  steps.push({ key: "welcome", label: "Documento y mensaje de bienvenida publicados", done: true, ref: doc.id });

  // 5. Proyecto (antes que formulario para vincularlo)
  let projectId: string | null = null;
  if (tpl.projectTemplateId) {
    const accepted = await db.proposal.findFirst({ where: { workspaceId: input.workspaceId, clientId: client.id, status: "ACCEPTED" }, orderBy: { acceptedAt: "desc" } });
    const project = await createProject({
      workspaceId: input.workspaceId,
      clientId: client.id,
      name: accepted?.title ?? `Proyecto de ${client.name}`,
      templateId: tpl.projectTemplateId,
      createdById: input.userId ?? null,
    });
    projectId = project.id;
    steps.push({ key: "project", label: `Proyecto "${project.name}" creado con sus etapas y tareas`, done: true, ref: project.id });
  }

  // 3. Formulario
  if (tpl.formId) {
    const form = await db.form.findFirst({ where: { id: tpl.formId, workspaceId: input.workspaceId } });
    if (form) {
      const req = await db.formRequest.create({
        data: { workspaceId: input.workspaceId, formId: form.id, clientId: client.id, projectId, dueDate: new Date(Date.now() + 5 * 86400_000) },
      });
      steps.push({ key: "form", label: `Formulario "${form.name}" solicitado`, done: true, ref: appUrl(`/formulario/${req.token}`) });
    }
  }

  // 4. Archivos
  if (tpl.fileRequest && projectId) {
    await db.task.create({
      data: {
        workspaceId: input.workspaceId,
        projectId,
        title: `Subir archivos: ${tpl.fileRequest}`,
        forClient: true,
        visibleToClient: true,
        priority: "HIGH",
        dueDate: new Date(Date.now() + 5 * 86400_000),
      },
    });
    steps.push({ key: "files", label: `Solicitud de archivos: ${tpl.fileRequest}`, done: true });
  }

  // 6. Reunión
  if (tpl.bookingLinkId) {
    const link = await db.bookingLink.findFirst({ where: { id: tpl.bookingLinkId, workspaceId: input.workspaceId } });
    if (link) {
      const url = appUrl(`/agenda/${link.slug}?cliente=${client.id}`);
      await db.message.create({
        data: {
          workspaceId: input.workspaceId,
          clientId: client.id,
          authorName: ws.name,
          authorType: "SYSTEM",
          body: `Agenda aquí la reunión estratégica inicial (${link.durationMin} min): ${url}`,
        },
      });
      steps.push({ key: "meeting", label: "Enlace para agendar la reunión estratégica compartido", done: true, ref: url });
    }
  }

  await db.client.update({ where: { id: client.id }, data: { status: "ACTIVE" } });
  const run = await db.onboardingRun.create({
    data: { workspaceId: input.workspaceId, clientId: client.id, templateId: input.templateId ?? null, projectId, steps, status: "COMPLETED", completedAt: new Date() },
  });
  await activity({ workspaceId: input.workspaceId, clientId: client.id, content: "Onboarding automático completado" });
  return run;
}
