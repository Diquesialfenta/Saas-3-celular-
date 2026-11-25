import "server-only";

type Mail = { from: string; to: string; subject: string; html: string };

export function hasPlatformMail() {
  return !!(process.env.RESEND_API_KEY || process.env.SMTP_URL);
}

async function relay(smtpUrl: string, message?: Mail) {
  const smtp = new URL(smtpUrl);
  if (!["smtp:", "smtps:"].includes(smtp.protocol) || !smtp.hostname) {
    throw new Error("Usa una dirección SMTP válida.");
  }

  if (smtp.hostname === "smtp.resend.com" && smtp.username === "resend" && smtp.password) {
    return resend(decodeURIComponent(smtp.password), message);
  }

  const relayUrl = process.env.SMTP_RELAY_URL;
  const token = process.env.SMTP_RELAY_TOKEN;
  if (!relayUrl || !token) throw new Error("Configura un relay SMTP HTTPS en Sites o usa Resend.");
  const target = new URL(relayUrl);
  if (target.protocol !== "https:" || target.username || target.password) {
    throw new Error("La dirección del relay SMTP debe usar HTTPS.");
  }
  const response = await fetch(target, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ operation: message ? "send" : "verify", smtpUrl, message }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`El relay SMTP respondió con HTTP ${response.status}.`);
}

async function resend(apiKey: string, message?: Mail) {
  // Un token limitado a envío puede responder 401/403 a GET /domains. El envío
  // proporciona la validación definitiva del token y el dominio remitente.
  if (!message) {
    if (!/^re_[A-Za-z0-9_-]+$/.test(apiKey)) throw new Error("La clave de Resend no tiene el formato esperado.");
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Resend respondió con HTTP ${response.status}.`);
}

export function verifyMailTransport(smtpUrl: string) {
  return relay(smtpUrl);
}

export async function deliverMail(smtpUrl: string | undefined, message: Mail) {
  if (smtpUrl) return relay(smtpUrl, message);
  if (process.env.RESEND_API_KEY) return resend(process.env.RESEND_API_KEY, message);
  throw new Error("No hay un proveedor de correo configurado.");
}
