"use server";

import type { TemplateType } from "@prisma/client";
import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { TEMPLATE_TYPE_LABELS } from "@/lib/templates";
import { textToItems, textToProject, textToSections } from "@/lib/template-text";
import { generate } from "@/lib/ai";

function buildContent(type: TemplateType, fd: FormData) {
  switch (type) {
    case "PROPOSAL":
      return {
        title: required(fd, "title", "el título"),
        summary: str(fd, "summary"),
        sections: textToSections(str(fd, "sections")),
        items: textToItems(str(fd, "items")),
        depositPercent: Number(str(fd, "depositPercent")) || 0,
        validDays: Number(str(fd, "validDays")) || 15,
      };
    case "CONTRACT":
      return { title: required(fd, "title", "el título"), body: required(fd, "body", "el texto") };
    case "PROJECT":
      return textToProject(str(fd, "structure"), str(fd, "objectives").split("\n").map((s) => s.trim()).filter(Boolean));
    case "DOCUMENT":
      return { kind: str(fd, "kind") || "OTHER", title: required(fd, "title", "el título"), body: required(fd, "body", "el contenido") };
    case "EMAIL":
      return { subject: required(fd, "subject", "el asunto"), body: required(fd, "body", "el mensaje") };
    case "ONBOARDING":
      return {
        welcomeTitle: required(fd, "welcomeTitle", "el título de bienvenida"),
        welcomeBody: required(fd, "welcomeBody", "el mensaje de bienvenida"),
        formId: optStr(fd, "formId"),
        projectTemplateId: optStr(fd, "projectTemplateId"),
        bookingLinkId: optStr(fd, "bookingLinkId"),
        fileRequest: optStr(fd, "fileRequest"),
      };
    default:
      throw new Error("Tipo no editable aquí");
  }
}

export const saveTemplateAction = action(async (fd) => {
  const ctx = await actionContext("templates.manage");
  const type = str(fd, "type") as TemplateType;
  if (!(type in TEMPLATE_TYPE_LABELS)) throw new Error("Tipo no válido");
  const content = buildContent(type, fd);
  const data = { name: required(fd, "name", "el nombre de la plantilla"), description: optStr(fd, "description"), content: content as object };
  const id = optStr(fd, "id");
  if (id) {
    await db.template.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
    return "Plantilla guardada";
  }
  const t = await db.template.create({ data: { ...data, type, workspaceId: ctx.workspaceId } });
  return { message: "Plantilla creada", data: { href: `/app/plantillas/${t.id}` } };
}, "/app/plantillas");

export const duplicateTemplateAction = action(async (fd) => {
  const ctx = await actionContext("templates.manage");
  const t = await db.template.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Plantilla no encontrada");
  const c = await db.template.create({ data: { workspaceId: ctx.workspaceId, type: t.type, name: `${t.name} (copia)`, description: t.description, content: t.content as object } });
  return { message: "Plantilla duplicada", data: { href: `/app/plantillas/${c.id}` } };
}, "/app/plantillas");

export const deleteTemplateAction = action(async (fd) => {
  const ctx = await actionContext("templates.manage");
  await db.template.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return { message: "Plantilla eliminada", data: { href: "/app/plantillas" } };
}, "/app/plantillas");

export async function aiWriteTemplate(type: string, brief: string): Promise<{ text?: string; error?: string }> {
  try {
    const ctx = await actionContext("ai.use");
    const instructions: Record<string, string> = {
      CONTRACT: "Redacta una plantilla de contrato de prestación de servicios con cláusulas numeradas. Usa las variables {{empresa.nombre}}, {{empresa.documento}}, {{empresa.direccion}}, {{cliente.nombre}}, {{cliente.documento}}, {{cliente.direccion}}, {{propuesta.numero}}, {{propuesta.titulo}}, {{propuesta.alcance}}, {{propuesta.total}}, {{propuesta.anticipo}} y {{fecha.hoy}} donde corresponda.",
      DOCUMENT: "Redacta un documento de bienvenida para clientes nuevos. Usa {{cliente.nombre}} y {{empresa.nombre}}.",
      EMAIL: "Redacta el cuerpo de un correo profesional y breve. Usa {{cliente.nombre}} y {{empresa.nombre}}.",
      PROPOSAL: "Redacta las secciones de una plantilla de propuesta comercial. Formato: cada sección empieza con una línea «## Título» seguida de su texto.",
      PROJECT: "Diseña la estructura de un proyecto tipo. Formato estricto, una línea por elemento: «# Etapa», «- Tarea | días desde el inicio | HIGH (opcional) | cliente (si la hace el cliente)», «@ Hito | días desde el inicio».",
    };
    const text = await generate({ workspaceId: ctx.workspaceId, userId: ctx.user.id, feature: `template.${type.toLowerCase()}`, context: `Negocio: ${ctx.workspace.name}\nDescripción: ${brief}`, instructions: instructions[type] ?? "Redacta el contenido de la plantilla.", effort: "medium" });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo generar." };
  }
}
