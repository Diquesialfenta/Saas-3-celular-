import "server-only";
import { deliverMail, hasPlatformMail } from "./mail-transport";
import { db } from "./db";
import { getIntegration } from "./integrations";
import { APP_NAME } from "./config";

type Brand = { name: string; brandColor?: string | null; logoUrl?: string | null };

export function emailLayout(brand: Brand, title: string, body: string, cta?: { label: string; url: string }) {
  const color = brand.brandColor || "#232323";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#232323">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e5e5e5">
<tr><td style="padding:28px 32px;border-bottom:1px solid #eee;font-size:18px;font-weight:600">${
    brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${esc(brand.name)}" height="28">` : esc(brand.name)
  }</td></tr>
<tr><td style="padding:32px"><h1 style="font-size:22px;margin:0 0 16px;font-weight:600">${esc(title)}</h1>${paragraphs}${
    cta
      ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(cta.label)}</a></p><p style="font-size:12px;color:#777;margin-top:16px;word-break:break-all">${cta.url}</p>`
      : ""
  }</td></tr></table>
<p style="font-size:12px;color:#888;margin-top:16px">Enviado por ${esc(brand.name)} con ${APP_NAME}</p>
</td></tr></table></body></html>`;
}

/**
 * Envía un correo con el SMTP de la cuenta, o el de la plataforma. Si no hay ninguno configurado
 * queda registrado como NOT_CONFIGURED: la interfaz lo muestra y el enlace sigue disponible para copiar.
 */
export async function sendEmail(opts: { workspaceId?: string | null; to: string; subject: string; html: string }) {
  const own = opts.workspaceId ? await getIntegration(opts.workspaceId, "SMTP") : null;
  const url = own?.url || process.env.SMTP_URL;
  const from = own?.from || process.env.MAIL_FROM || `${APP_NAME} <no-reply@localhost>`;
  if (!url && !hasPlatformMail()) {
    await db.emailLog.create({
      data: { workspaceId: opts.workspaceId ?? null, to: opts.to, subject: opts.subject, html: opts.html, status: "NOT_CONFIGURED" },
    });
    return { ok: false as const, reason: "NOT_CONFIGURED" };
  }
  try {
    await deliverMail(url, { from, to: opts.to, subject: opts.subject, html: opts.html });
    await db.emailLog.create({
      data: { workspaceId: opts.workspaceId ?? null, to: opts.to, subject: opts.subject, html: opts.html, status: "SENT" },
    });
    return { ok: true as const };
  } catch (e) {
    await db.emailLog.create({
      data: {
        workspaceId: opts.workspaceId ?? null,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        status: "FAILED",
        error: String(e).slice(0, 500),
      },
    });
    return { ok: false as const, reason: "FAILED" };
  }
}

/** WhatsApp Business Cloud API (Meta). */
export async function sendWhatsApp(workspaceId: string, to: string, text: string) {
  const cfg = await getIntegration(workspaceId, "WHATSAPP");
  if (!cfg) return { ok: false as const, reason: "NOT_CONFIGURED" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "text", text: { body: text } }),
  });
  return res.ok ? { ok: true as const } : { ok: false as const, reason: `HTTP ${res.status}` };
}
