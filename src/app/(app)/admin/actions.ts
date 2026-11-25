"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required, bool, optDate } from "@/lib/action";
import { requireSuperadmin, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toCents } from "@/lib/format";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/config";

async function admin() {
  const user = await requireSuperadmin();
  return user;
}

export const setWorkspaceSuspendedAction = action(async (fd) => {
  const u = await admin();
  const suspended = str(fd, "suspended") === "1";
  await db.workspace.update({ where: { id: str(fd, "id") }, data: { isSuspended: suspended } });
  await audit({ workspaceId: str(fd, "id"), userId: u.id, action: suspended ? "admin.suspend" : "admin.reactivate" });
  return suspended ? "Cuenta suspendida" : "Cuenta reactivada";
}, "/admin");

export const updateSubscriptionAction = action(async (fd) => {
  const u = await admin();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: str(fd, "workspaceId") } });
  const plan = await db.plan.findUniqueOrThrow({ where: { id: str(fd, "planId") } });
  const status = str(fd, "status");
  if (!["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"].includes(status)) throw new Error("Estado no válido");
  await db.$transaction([
    db.workspace.update({ where: { id: ws.id }, data: { type: plan.accountType, upgradedAt: plan.accountType !== ws.type ? new Date() : ws.upgradedAt } }),
    db.subscription.update({
      where: { workspaceId: ws.id },
      data: { planId: plan.id, status: status as "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED", trialEndsAt: optDate(fd, "trialEndsAt"), currentPeriodEnd: optDate(fd, "currentPeriodEnd") },
    }),
  ]);
  await audit({ workspaceId: ws.id, userId: u.id, action: "admin.subscription", meta: { planId: plan.id, status } });
  return "Suscripción actualizada";
}, "/admin");

export const recordPlatformPaymentAction = action(async (fd) => {
  await admin();
  const amount = toCents(str(fd, "amount"));
  if (amount <= 0) throw new Error("Escribe el importe.");
  await db.platformPayment.create({ data: { workspaceId: str(fd, "workspaceId"), amount, currency: str(fd, "currency") || "USD", status: "PAID", provider: "MANUAL", reference: optStr(fd, "reference"), description: optStr(fd, "description") } });
  return "Pago registrado";
}, "/admin");

export const savePlanAction = action(async (fd) => {
  await admin();
  const accountType = str(fd, "accountType") === "COMPANY" ? "COMPANY" : "FREELANCER";
  const num = (k: string) => (str(fd, k) === "" ? -1 : Number(str(fd, k)));
  const data = {
    code: required(fd, "code", "el código").toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    name: required(fd, "name", "el nombre"),
    accountType: accountType as "COMPANY" | "FREELANCER",
    description: required(fd, "description", "la descripción"),
    priceMonthly: toCents(str(fd, "priceMonthly")),
    priceYearly: toCents(str(fd, "priceYearly")),
    currency: (str(fd, "currency") || "USD").toUpperCase(),
    trialDays: Number(str(fd, "trialDays")) || 0,
    features: str(fd, "features").split("\n").map((s) => s.trim()).filter(Boolean),
    limits: { clients: num("clients"), projects: num("projects"), members: num("members"), storageMb: num("storageMb"), aiCredits: num("aiCredits") },
    sortOrder: Number(str(fd, "sortOrder")) || 0,
    isActive: bool(fd, "isActive"),
    isPublic: bool(fd, "isPublic"),
    stripePriceMonthly: optStr(fd, "stripePriceMonthly"),
    stripePriceYearly: optStr(fd, "stripePriceYearly"),
  };
  const id = optStr(fd, "id");
  if (id) await db.plan.update({ where: { id }, data });
  else await db.plan.create({ data });
  return "Plan guardado";
}, "/admin");

export const saveCouponAction = action(async (fd) => {
  await admin();
  const percentOff = str(fd, "percentOff") ? Number(str(fd, "percentOff")) : null;
  const amountOff = str(fd, "amountOff") ? toCents(str(fd, "amountOff")) : null;
  if (!percentOff && !amountOff) throw new Error("Indica un porcentaje o un importe de descuento.");
  if (percentOff && (percentOff < 1 || percentOff > 100)) throw new Error("El porcentaje debe estar entre 1 y 100.");
  const data = {
    code: required(fd, "code", "el código").toUpperCase().replace(/\s/g, ""),
    description: optStr(fd, "description"),
    percentOff,
    amountOff,
    durationMonths: str(fd, "durationMonths") ? Number(str(fd, "durationMonths")) : null,
    accountType: (["FREELANCER", "COMPANY"].includes(str(fd, "accountType")) ? str(fd, "accountType") : null) as "FREELANCER" | "COMPANY" | null,
    validUntil: optDate(fd, "validUntil"),
    maxRedemptions: str(fd, "maxRedemptions") ? Number(str(fd, "maxRedemptions")) : null,
    isActive: bool(fd, "isActive"),
  };
  const id = optStr(fd, "id");
  if (id) await db.coupon.update({ where: { id }, data });
  else await db.coupon.create({ data });
  return "Promoción guardada";
}, "/admin");

export const setUserFlagsAction = action(async (fd) => {
  const u = await admin();
  const target = str(fd, "id");
  if (target === u.id && str(fd, "field") !== "") throw new Error("No puedes cambiar tus propios permisos de administración.");
  const field = str(fd, "field");
  const value = str(fd, "value") === "1";
  if (field === "isSuspended") {
    await db.user.update({ where: { id: target }, data: { isSuspended: value } });
    if (value) await db.session.deleteMany({ where: { userId: target } });
  } else if (field === "isSuperadmin") {
    await db.user.update({ where: { id: target }, data: { isSuperadmin: value } });
  } else throw new Error("Campo no válido");
  await audit({ userId: u.id, action: `admin.user.${field}`, entityId: target, meta: { value } });
  return "Usuario actualizado";
}, "/admin");

export const resetLinkAction = action(async (fd) => {
  const u = await admin();
  const target = await db.user.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const token = randomToken();
  await db.token.create({ data: { type: "PASSWORD_RESET", tokenHash: sha256(token), email: target.email, expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  await audit({ userId: u.id, action: "admin.user.reset", entityId: target.id });
  return { message: "Enlace generado (válido 24 h)", data: { url: appUrl(`/recuperar/${token}`) } };
}, "/admin");

export const replyPlatformTicketAction = action(async (fd) => {
  const u = await admin();
  const t = await db.platformTicket.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const messages = [...((t.messages as { from: string; body: string; at: string; name: string }[]) ?? []), { from: "admin", body: required(fd, "body", "la respuesta"), at: new Date().toISOString(), name: u.name }];
  const status = ["OPEN", "ANSWERED", "CLOSED"].includes(str(fd, "status")) ? str(fd, "status") : "ANSWERED";
  await db.platformTicket.update({ where: { id: t.id }, data: { messages, status } });
  await db.notification.create({ data: { userId: t.userId, workspaceId: t.workspaceId, title: `Soporte respondió: ${t.subject}`, link: "/app/ayuda" } });
  return "Respuesta enviada";
}, "/admin");

export const saveAnnouncementAction = action(async (fd) => {
  await admin();
  const text = optStr(fd, "announcement");
  await db.platformSetting.upsert({ where: { key: "announcement" }, create: { key: "announcement", value: { text } }, update: { value: { text } } });
  return text ? "Aviso publicado para todas las cuentas" : "Aviso retirado";
}, "/admin");

/** Soporte de la plataforma: lo usan las cuentas desde /app/ayuda. */
export const createPlatformTicketAction = action(async (fd) => {
  const session = await getSession();
  if (!session) throw new Error("Inicia sesión");
  await db.platformTicket.create({
    data: {
      workspaceId: session.workspaceId,
      userId: session.userId,
      subject: required(fd, "subject", "el asunto"),
      messages: [{ from: "user", body: required(fd, "body", "el mensaje"), at: new Date().toISOString(), name: session.user.name }],
    },
  });
  return "Mensaje enviado al soporte de la plataforma";
}, "/app/ayuda");

export const replyMyPlatformTicketAction = action(async (fd) => {
  const session = await getSession();
  if (!session) throw new Error("Inicia sesión");
  const t = await db.platformTicket.findFirst({ where: { id: str(fd, "id"), userId: session.userId } });
  if (!t) throw new Error("Consulta no encontrada");
  const messages = [...((t.messages as object[]) ?? []), { from: "user", body: required(fd, "body", "el mensaje"), at: new Date().toISOString(), name: session.user.name }];
  await db.platformTicket.update({ where: { id: t.id }, data: { messages, status: "OPEN" } });
  return "Respuesta enviada";
}, "/app/ayuda");
