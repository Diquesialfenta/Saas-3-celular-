"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { action, optStr, str, required, bool } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { toCents } from "@/lib/format";
import { upgradeToCompany } from "@/lib/services/workspace";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/config";
import { hashPassword, verifyPassword } from "@/lib/auth";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const saveGeneralAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: {
      name: required(fd, "name", "el nombre"),
      legalName: optStr(fd, "legalName"),
      taxId: optStr(fd, "taxId"),
      email: optStr(fd, "email"),
      phone: optStr(fd, "phone"),
      website: optStr(fd, "website"),
      address: optStr(fd, "address"),
      timezone: str(fd, "timezone") || ctx.workspace.timezone,
    },
  });
  return "Datos guardados";
}, "/app");

export const saveBrandAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const brandColor = str(fd, "brandColor");
  if (!HEX.test(brandColor)) throw new Error("Elige un color en formato #RRGGBB.");
  let logoUrl = ctx.workspace.logoUrl;
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(logo.type)) throw new Error("El logotipo debe ser PNG, JPG, SVG o WebP.");
    if (logo.size > 1024 * 1024) throw new Error("El logotipo debe pesar menos de 1 MB.");
    const buf = Buffer.from(await logo.arrayBuffer());
    logoUrl = `data:${logo.type};base64,${buf.toString("base64")}`;
  }
  if (bool(fd, "removeLogo")) logoUrl = null;
  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { brandColor, logoUrl, portalTitle: optStr(fd, "portalTitle"), portalWelcome: optStr(fd, "portalWelcome") },
  });
  return "Marca y portal actualizados";
}, "/app");

export const saveBillingSettingsAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const currency = str(fd, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("La moneda debe ser un código de 3 letras (USD, EUR, PEN…).");
  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { currency, taxRate: Math.max(0, Math.min(100, Number(str(fd, "taxRate")) || 0)), invoiceFooter: optStr(fd, "invoiceFooter") },
  });
  return "Facturación configurada";
}, "/app");

export const saveServiceAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const data = {
    name: required(fd, "name", "el nombre del servicio"),
    description: optStr(fd, "description"),
    price: toCents(str(fd, "price")),
    currency: ctx.workspace.currency,
    recurring: ["NONE", "MONTHLY", "YEARLY"].includes(str(fd, "recurring")) ? str(fd, "recurring") : "NONE",
    visibleInPortal: bool(fd, "visibleInPortal"),
    isActive: true,
  };
  const id = optStr(fd, "id");
  if (id) await db.service.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  else await db.service.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return "Servicio guardado";
}, "/app/configuracion");

export const deleteServiceAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  await db.service.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Servicio eliminado";
}, "/app/configuracion");

export const upgradeToCompanyAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  if (ctx.membership.role !== "OWNER") throw new Error("Solo el propietario puede cambiar el tipo de cuenta.");
  if (ctx.isCompany) throw new Error("Tu cuenta ya es de empresa.");
  await upgradeToCompany(ctx.workspaceId, required(fd, "planId", "el plan"));
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "workspace.upgraded" });
  return { message: "¡Ya eres una cuenta de empresa! Todos tus datos siguen aquí.", data: { href: "/app/equipo" } };
}, "/app");

export const changePlanAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  if (ctx.membership.role !== "OWNER") throw new Error("Solo el propietario puede cambiar el plan.");
  const plan = await db.plan.findFirst({ where: { id: required(fd, "planId", "el plan"), accountType: ctx.workspace.type, isActive: true } });
  if (!plan) throw new Error("Plan no disponible para tu tipo de cuenta");
  const interval = str(fd, "interval") === "YEAR" ? "YEAR" : "MONTH";
  // Con Stripe de la plataforma configurado: se cobra por Checkout; sin él, el cambio queda en prueba y lo gestiona el administrador.
  if (process.env.STRIPE_SECRET_KEY) {
    const price = interval === "YEAR" ? plan.stripePriceYearly : plan.stripePriceMonthly;
    if (!price) throw new Error("Este plan aún no tiene precio en Stripe. Contacta con soporte.");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const coupon = optStr(fd, "coupon");
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (coupon) {
      const c = await db.coupon.findFirst({ where: { code: coupon.toUpperCase(), isActive: true } });
      if (!c || (c.validUntil && c.validUntil < new Date()) || (c.maxRedemptions && c.redemptions >= c.maxRedemptions)) throw new Error("El cupón no es válido.");
      const sc = await stripe.coupons.create({ ...(c.percentOff ? { percent_off: c.percentOff } : { amount_off: c.amountOff ?? 0, currency: plan.currency.toLowerCase() }), duration: c.durationMonths ? "repeating" : "once", ...(c.durationMonths ? { duration_in_months: c.durationMonths } : {}) });
      discounts = [{ coupon: sc.id }];
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: ctx.user.email,
      discounts,
      metadata: { workspaceId: ctx.workspaceId, planId: plan.id, interval, coupon: coupon ?? "" },
      subscription_data: { metadata: { workspaceId: ctx.workspaceId, planId: plan.id } },
      success_url: appUrl("/app/configuracion/plan?pago=ok"),
      cancel_url: appUrl("/app/configuracion/plan"),
    });
    redirect(session.url!);
  }
  await db.subscription.update({ where: { workspaceId: ctx.workspaceId }, data: { planId: plan.id, interval } });
  return "Plan cambiado. El cobro lo activará el administrador de la plataforma.";
}, "/app");

export const changePasswordAction = action(async (fd) => {
  const ctx = await actionContext();
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (!(await verifyPassword(current, ctx.user.passwordHash))) throw new Error("La contraseña actual no es correcta.");
  if (next.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  await db.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(next), name: optStr(fd, "name") ?? ctx.user.name } });
  await db.session.deleteMany({ where: { userId: ctx.user.id, id: { not: ctx.sessionId } } });
  return "Contraseña cambiada. Se cerraron tus otras sesiones.";
}, "/app");

export const updateProfileAction = action(async (fd) => {
  const ctx = await actionContext();
  await db.user.update({ where: { id: ctx.user.id }, data: { name: required(fd, "name", "tu nombre") } });
  return "Perfil actualizado";
}, "/app");

export const exportDataAction = action(async () => {
  const ctx = await actionContext("settings.manage");
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "workspace.export" });
  return { data: { href: "/api/export" } };
}, "/app");

