"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext, assertClient } from "@/lib/tenant";
import { requestTestimonial, sendSurvey } from "@/lib/services/loyalty";
import { activity } from "@/lib/audit";
import { emit } from "@/lib/automations";

export const sendSurveyAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const surveyId = required(fd, "surveyId", "la encuesta");
  const r = await sendSurvey(ctx.workspaceId, surveyId, client.id);
  return { message: "Encuesta enviada", data: { url: r.url } };
}, "/app/fidelizacion");

export const saveSurveyAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const data = { name: required(fd, "name", "el nombre"), question: required(fd, "question", "la pregunta"), followUp: optStr(fd, "followUp"), isActive: str(fd, "isActive") === "on" };
  const id = optStr(fd, "id");
  if (id) await db.survey.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  else await db.survey.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return "Encuesta guardada";
}, "/app/fidelizacion");

export const requestTestimonialAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const client = await assertClient(ctx.workspaceId, required(fd, "clientId", "el cliente"));
  const r = await requestTestimonial(ctx.workspaceId, client.id);
  return { message: "Testimonio solicitado", data: { url: r.url } };
}, "/app/fidelizacion");

export const moderateTestimonialAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const status = str(fd, "status");
  if (!["APPROVED", "REJECTED", "SUBMITTED"].includes(status)) throw new Error("Estado no válido");
  await db.testimonial.updateMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId }, data: { status } });
  return status === "APPROVED" ? "Testimonio aprobado para publicar" : "Testimonio actualizado";
}, "/app/fidelizacion");

export const updateReferralAction = action(async (fd) => {
  const ctx = await actionContext("support.manage");
  const r = await db.referral.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!r) throw new Error("Referido no encontrado");
  const status = str(fd, "status");
  if (!["NEW", "CONTACTED", "CONVERTED", "REWARDED", "LOST"].includes(status)) throw new Error("Estado no válido");
  let convertedClientId = r.convertedClientId;
  if (status === "CONVERTED" && !convertedClientId) {
    const c = await db.client.create({
      data: { workspaceId: ctx.workspaceId, name: r.company || r.name, email: r.email, status: "LEAD", source: "Recomendación", referredById: r.referrerClientId, ownerId: ctx.user.id, contacts: { create: { workspaceId: ctx.workspaceId, name: r.name, email: r.email, isPrimary: true } } },
    });
    convertedClientId = c.id;
    await activity({ workspaceId: ctx.workspaceId, clientId: c.id, content: `Cliente creado desde una recomendación` });
    await emit(ctx.workspaceId, "client.created", { clientId: c.id });
  }
  await db.referral.update({ where: { id: r.id }, data: { status, convertedClientId } });
  return status === "CONVERTED" ? "Referido convertido en cliente" : "Referido actualizado";
}, "/app/fidelizacion");

export const createRenewalAction = action(async (fd) => {
  const ctx = await actionContext("sales.manage");
  const client = await assertClient(ctx.workspaceId, str(fd, "clientId"));
  await db.deal.create({ data: { workspaceId: ctx.workspaceId, clientId: client.id, title: required(fd, "title", "el título"), source: str(fd, "source") || "RENEWAL", stage: "QUALIFIED", probability: 40, ownerId: ctx.user.id, currency: ctx.workspace.currency } });
  return "Oportunidad creada en el embudo";
}, ["/app/fidelizacion", "/app/oportunidades"]);

export const saveReferralRewardAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  await db.workspace.update({ where: { id: ctx.workspaceId }, data: { referralReward: optStr(fd, "referralReward") } });
  return "Programa de referidos actualizado";
}, "/app/fidelizacion");
