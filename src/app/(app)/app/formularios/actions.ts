"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { action, optStr, str, required, optDate } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { appUrl } from "@/lib/config";
import { emailLayout, sendEmail } from "@/lib/email";

const fieldSchema = z.array(
  z.object({
    id: z.string().min(1),
    type: z.enum(["text", "textarea", "email", "tel", "url", "number", "date", "select", "checkbox"]),
    label: z.string().min(1, "Cada pregunta necesita un enunciado."),
    help: z.string().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  }),
).min(1, "Añade al menos una pregunta.");

export const saveFormAction = action(async (fd) => {
  const ctx = await actionContext("templates.manage");
  const fields = fieldSchema.parse(JSON.parse(str(fd, "fields") || "[]"));
  for (const f of fields) if ((f.type === "select" || f.type === "checkbox") && !f.options?.length) throw new Error(`La pregunta «${f.label}» necesita opciones.`);
  const data = { name: required(fd, "name", "el nombre"), description: optStr(fd, "description"), fields };
  const id = optStr(fd, "id");
  if (id) {
    await db.form.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
    return "Formulario guardado";
  }
  const f = await db.form.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return { message: "Formulario creado", data: { href: `/app/formularios/${f.id}` } };
}, "/app/formularios");

export const deleteFormAction = action(async (fd) => {
  const ctx = await actionContext("templates.manage");
  await db.form.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return { message: "Formulario eliminado", data: { href: "/app/formularios" } };
}, "/app/formularios");

export const requestFormAction = action(async (fd) => {
  const ctx = await actionContext("clients.manage");
  const form = await db.form.findFirst({ where: { id: str(fd, "formId"), workspaceId: ctx.workspaceId } });
  if (!form) throw new Error("Formulario no encontrado");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const req = await db.formRequest.create({ data: { workspaceId: ctx.workspaceId, formId: form.id, clientId: client.id, dueDate: optDate(fd, "dueDate") } });
  const url = appUrl(`/formulario/${req.token}`);
  const contact = await db.contact.findFirst({ where: { clientId: client.id, isPrimary: true } });
  const to = contact?.email ?? client.email;
  let emailed = false;
  if (to) {
    const r = await sendEmail({
      workspaceId: ctx.workspaceId,
      to,
      subject: `${ctx.workspace.name} necesita algunos datos`,
      html: emailLayout(ctx.workspace, form.name, `Hola ${contact?.name ?? client.name},\n\n${form.description ?? "Necesitamos algunos datos para continuar. Te llevará pocos minutos."}`, { label: "Completar el formulario", url }),
    });
    emailed = r.ok;
  }
  return { message: emailed ? `Formulario enviado a ${to}` : "Solicitud creada. Copia el enlace para enviarlo.", data: { url } };
}, "/app/formularios");
