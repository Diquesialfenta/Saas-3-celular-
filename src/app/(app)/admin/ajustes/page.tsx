import { db } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai";
import { appUrl } from "@/lib/config";
import { ActionForm, SubmitButton, CopyButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Textarea } from "@/components/ui";
import { saveAnnouncementAction } from "../actions";

export const metadata = { title: "Ajustes de la plataforma" };

export default async function AdminSettings() {
  const ann = await db.platformSetting.findUnique({ where: { key: "announcement" } });
  const checks = [
    ["Base de datos", true],
    ["APP_SECRET (cifrado de claves)", !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 32],
    ["IA (ANTHROPIC_API_KEY)", isAiConfigured()],
    ["Correo de la plataforma (SMTP_URL)", !!process.env.SMTP_URL],
    ["Cobro de suscripciones (STRIPE_SECRET_KEY)", !!process.env.STRIPE_SECRET_KEY],
    ["Webhook de Stripe (STRIPE_WEBHOOK_SECRET)", !!process.env.STRIPE_WEBHOOK_SECRET],
  ] as const;
  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Ajustes de la plataforma</h1>
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader title="Estado de los servicios" />
          <ul className="px-5 pb-5 grid gap-2">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex justify-between text-sm">
                <span>{label}</span>
                <Badge tone={ok ? "ok" : "warn"}>{ok ? "Configurado" : "Pendiente"}</Badge>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5 grid gap-3 text-[13px]">
            <div>
              <p className="text-muted">Webhook de Stripe de la plataforma</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 truncate font-mono text-[12px] bg-surface rounded px-2 py-1">{appUrl("/api/stripe/platform")}</code>
                <CopyButton value={appUrl("/api/stripe/platform")} label="Copiar" />
              </div>
            </div>
            <div>
              <p className="text-muted">Tareas programadas (cada hora, cabecera Authorization: Bearer CRON_SECRET)</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 truncate font-mono text-[12px] bg-surface rounded px-2 py-1">{appUrl("/api/cron")}</code>
                <CopyButton value={appUrl("/api/cron")} label="Copiar" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-medium">Aviso global</p>
          <p className="text-sm text-muted mt-1">Se muestra en la parte superior de todas las cuentas. Útil para mantenimientos o novedades.</p>
          <ActionForm action={saveAnnouncementAction} className="mt-4 grid gap-3">
            <Field label="Texto del aviso" htmlFor="announcement" hint="Déjalo vacío para retirarlo.">
              <Textarea id="announcement" name="announcement" defaultValue={(ann?.value as { text?: string } | null)?.text ?? ""} />
            </Field>
            <SubmitButton className="justify-self-start">Publicar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
