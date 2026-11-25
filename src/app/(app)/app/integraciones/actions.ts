"use server";

import Stripe from "stripe";
import { verifyMailTransport } from "@/lib/mail-transport";
import { action, str, required, optStr } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { removeIntegration, saveIntegration, type Provider } from "@/lib/integrations";
import { audit } from "@/lib/audit";

export const saveStripeAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const secretKey = required(fd, "secretKey", "la clave secreta de Stripe");
  if (!/^(sk|rk)_(live|test)_/.test(secretKey)) throw new Error("La clave debe empezar por sk_live_, sk_test_ o rk_.");
  try {
    await new Stripe(secretKey).balance.retrieve();
  } catch {
    throw new Error("Stripe rechazó la clave. Revisa que sea correcta.");
  }
  await saveIntegration(ctx.workspaceId, "STRIPE", { secretKey, webhookSecret: optStr(fd, "webhookSecret") ?? undefined });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "integration.stripe" });
  return "Stripe conectado: tus clientes ya pueden pagar con tarjeta";
}, "/app/integraciones");

export const saveSmtpAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const url = required(fd, "url", "la dirección SMTP");
  const from = required(fd, "from", "el remitente");
  try {
    await verifyMailTransport(url);
  } catch (e) {
    throw new Error(`No se pudo conectar al servidor SMTP: ${e instanceof Error ? e.message : "error"}`);
  }
  await saveIntegration(ctx.workspaceId, "SMTP", { url, from });
  return "Correo conectado: los envíos salen desde tu dominio";
}, "/app/integraciones");

export const saveWhatsAppAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const token = required(fd, "token", "el token de acceso");
  const phoneNumberId = required(fd, "phoneNumberId", "el identificador del número");
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res || !res.ok) throw new Error("Meta rechazó el token o el identificador del número.");
  await saveIntegration(ctx.workspaceId, "WHATSAPP", { token, phoneNumberId });
  return "WhatsApp Business conectado";
}, "/app/integraciones");

export const saveWebhookAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const url = required(fd, "url", "la URL");
  if (!/^https:\/\//.test(url)) throw new Error("La URL debe empezar por https://");
  await saveIntegration(ctx.workspaceId, "WEBHOOK", { url, secret: optStr(fd, "secret") ?? undefined });
  return "Webhook guardado. Úsalo como acción en tus automatizaciones.";
}, "/app/integraciones");

export const saveVideoAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const defaultUrl = required(fd, "defaultUrl", "el enlace de tu sala");
  if (!/^https:\/\//.test(defaultUrl)) throw new Error("El enlace debe empezar por https://");
  await saveIntegration(ctx.workspaceId, "VIDEO", { defaultUrl });
  return "Sala de videollamadas guardada";
}, "/app/integraciones");

export const removeIntegrationAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const p = str(fd, "provider") as Provider;
  if (!["STRIPE", "SMTP", "WHATSAPP", "WEBHOOK", "VIDEO"].includes(p)) throw new Error("Integración no válida");
  await removeIntegration(ctx.workspaceId, p);
  return "Integración desconectada";
}, "/app/integraciones");
