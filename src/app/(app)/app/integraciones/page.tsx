import { CreditCard, Mail, MessageCircle, Webhook, Video, CalendarDays, Sparkles, HardDrive } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { getIntegration, mask } from "@/lib/integrations";
import { appUrl } from "@/lib/config";
import { hasPlatformMail } from "@/lib/mail-transport";
import { isAiConfigured } from "@/lib/ai";
import { relative } from "@/lib/format";
import { ActionButton, ActionForm, CopyButton, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { removeIntegrationAction, saveSmtpAction, saveStripeAction, saveVideoAction, saveWebhookAction, saveWhatsAppAction } from "./actions";

export const metadata = { title: "Integraciones" };

export default async function IntegrationsPage() {
  const ctx = await requireWorkspace("settings.manage");
  const ws = ctx.workspaceId;
  const [stripe, smtp, wa, hook, video, emails] = await Promise.all([
    getIntegration(ws, "STRIPE"),
    getIntegration(ws, "SMTP"),
    getIntegration(ws, "WHATSAPP"),
    getIntegration(ws, "WEBHOOK"),
    getIntegration(ws, "VIDEO"),
    db.emailLog.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const platformMail = hasPlatformMail();
  const Status = ({ on, label }: { on: boolean; label?: string }) => <Badge tone={on ? "ok" : "neutral"}>{on ? (label ?? "Conectado") : "No conectado"}</Badge>;
  const Disconnect = ({ provider }: { provider: string }) => (
    <ActionButton action={removeIntegrationAction} fields={{ provider }} variant="ghost" confirm="¿Desconectar esta integración?">
      Desconectar
    </ActionButton>
  );

  return (
    <>
      <PageHeader title="Integraciones" description="Conecta tus pagos, tu correo, WhatsApp, tus videollamadas y tu calendario. Las claves se guardan cifradas." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CreditCard className="size-4" /> Stripe</span>} description="Cobro con tarjeta en facturas y portal" action={<Status on={!!stripe} />} />
          <div className="px-5 pb-5 grid gap-3">
            {stripe && <p className="text-sm text-muted">Clave {mask(stripe.secretKey)} · webhook {stripe.webhookSecret ? "configurado" : "pendiente"}</p>}
            <div className="rounded-[10px] bg-surface p-3 text-[13px]">
              <p className="text-muted">URL del webhook (evento checkout.session.completed):</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{appUrl(`/api/stripe/webhook/${ws}`)}</code>
                <CopyButton value={appUrl(`/api/stripe/webhook/${ws}`)} label="Copiar" />
              </div>
            </div>
            <div className="flex gap-2">
              <Modal trigger={stripe ? "Cambiar claves" : "Conectar Stripe"} triggerVariant={stripe ? "secondary" : "primary"} triggerSize="sm" title="Conectar Stripe">
                <ActionForm action={saveStripeAction} className="grid gap-4">
                  <Field label="Clave secreta" htmlFor="sk" hint="Stripe → Desarrolladores → Claves de API.">
                    <Input id="sk" name="secretKey" type="password" autoComplete="off" required />
                  </Field>
                  <Field label="Secreto de firma del webhook" htmlFor="whsec" hint="Empieza por whsec_. Sin él no se confirman los pagos automáticamente.">
                    <Input id="whsec" name="webhookSecret" type="password" autoComplete="off" />
                  </Field>
                  <SubmitButton pendingLabel="Comprobando">Conectar</SubmitButton>
                </ActionForm>
              </Modal>
              {stripe && <Disconnect provider="STRIPE" />}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Mail className="size-4" /> Correo (SMTP)</span>} description="Envía propuestas, facturas e invitaciones desde tu dominio" action={<Status on={!!smtp} label="Tu dominio" />} />
          <div className="px-5 pb-5 grid gap-3">
            <p className="text-sm text-muted">{smtp ? `Remitente: ${smtp.from}` : platformMail ? "Ahora se envía desde el correo de la plataforma." : "Sin servidor de correo: los envíos quedan registrados y puedes copiar los enlaces."}</p>
            <div className="flex gap-2">
              <Modal trigger={smtp ? "Cambiar" : "Conectar correo"} triggerVariant={smtp ? "secondary" : "primary"} triggerSize="sm" title="Conectar correo SMTP">
                <ActionForm action={saveSmtpAction} className="grid gap-4">
                  <Field label="Dirección SMTP" htmlFor="smtp" hint="Usa la dirección SMTP de Resend o un servidor SMTP a través del relay configurado por el administrador.">
                    <Input id="smtp" name="url" type="password" autoComplete="off" required />
                  </Field>
                  <Field label="Remitente" htmlFor="from">
                    <Input id="from" name="from" defaultValue={`${ctx.workspace.name} <${ctx.workspace.email ?? ""}>`} required />
                  </Field>
                  <SubmitButton pendingLabel="Comprobando conexión">Conectar</SubmitButton>
                </ActionForm>
              </Modal>
              {smtp && <Disconnect provider="SMTP" />}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><MessageCircle className="size-4" /> WhatsApp Business</span>} description="Mensajes y avisos automáticos por WhatsApp (API de Meta)" action={<Status on={!!wa} />} />
          <div className="px-5 pb-5 flex gap-2">
            <Modal trigger={wa ? "Cambiar" : "Conectar WhatsApp"} triggerVariant={wa ? "secondary" : "primary"} triggerSize="sm" title="Conectar WhatsApp Business">
              <ActionForm action={saveWhatsAppAction} className="grid gap-4">
                <Field label="Token de acceso permanente" htmlFor="wtoken" hint="Meta for Developers → tu app → WhatsApp → Configuración de la API.">
                  <Input id="wtoken" name="token" type="password" autoComplete="off" required />
                </Field>
                <Field label="Identificador del número de teléfono" htmlFor="wphone">
                  <Input id="wphone" name="phoneNumberId" required />
                </Field>
                <SubmitButton pendingLabel="Comprobando">Conectar</SubmitButton>
              </ActionForm>
            </Modal>
            {wa && <Disconnect provider="WHATSAPP" />}
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Video className="size-4" /> Videollamadas</span>} description="Tu sala de Google Meet, Zoom o Teams para reuniones y reservas" action={<Status on={!!video} />} />
          <div className="px-5 pb-5 grid gap-2">
            {video && <p className="text-sm text-muted truncate">{video.defaultUrl}</p>}
            <div className="flex gap-2">
              <Modal trigger={video ? "Cambiar" : "Añadir sala"} triggerVariant={video ? "secondary" : "primary"} triggerSize="sm" title="Sala de videollamadas">
                <ActionForm action={saveVideoAction} className="grid gap-4">
                  <Field label="Enlace de tu sala personal" htmlFor="vurl">
                    <Input id="vurl" name="defaultUrl" type="url" placeholder="https://meet.google.com/abc-defg-hij" required />
                  </Field>
                  <SubmitButton>Guardar</SubmitButton>
                </ActionForm>
              </Modal>
              {video && <Disconnect provider="VIDEO" />}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CalendarDays className="size-4" /> Calendario</span>} description="Google Calendar, Outlook y Apple Calendar por suscripción ICS" action={<Badge tone="ok">Disponible</Badge>} />
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[8px] bg-surface px-2.5 py-1.5 font-mono text-[12px]">{appUrl(`/api/ics/${ctx.workspace.icsToken}`)}</code>
              <CopyButton value={appUrl(`/api/ics/${ctx.workspace.icsToken}`)} label="Copiar" />
            </div>
            <p className="text-[13px] text-muted mt-2">En Google Calendar: Otros calendarios → Desde URL. Las reuniones reservadas incluyen además un archivo .ics.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Webhook className="size-4" /> Webhook</span>} description="Envía eventos a Zapier, Make, n8n o tu propio sistema" action={<Status on={!!hook} />} />
          <div className="px-5 pb-5 grid gap-2">
            {hook && <p className="text-sm text-muted truncate">{hook.url}</p>}
            <div className="flex gap-2">
              <Modal trigger={hook ? "Cambiar" : "Configurar webhook"} triggerVariant={hook ? "secondary" : "primary"} triggerSize="sm" title="Webhook saliente">
                <ActionForm action={saveWebhookAction} className="grid gap-4">
                  <Field label="URL" htmlFor="hurl">
                    <Input id="hurl" name="url" type="url" required />
                  </Field>
                  <Field label="Secreto (opcional)" htmlFor="hsec" hint="Se firma cada envío con HMAC-SHA256 en la cabecera X-Encauza-Signature.">
                    <Input id="hsec" name="secret" type="password" autoComplete="off" />
                  </Field>
                  <SubmitButton>Guardar</SubmitButton>
                </ActionForm>
              </Modal>
              {hook && <Disconnect provider="WEBHOOK" />}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><HardDrive className="size-4" /> Almacenamiento externo</span>} description="Google Drive, Dropbox o OneDrive" action={<Badge>Enlaces</Badge>} />
          <p className="px-5 pb-5 text-sm text-muted">Adjunta enlaces de Drive, Dropbox u OneDrive a cualquier entregable. Los archivos que subas aquí se guardan con versiones y permisos por cliente.</p>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="size-4" /> Inteligencia artificial</span>} description="Gestionada por la plataforma" action={<Status on={isAiConfigured()} label="Activa" />} />
          <p className="px-5 pb-5 text-sm text-muted">Redacción de propuestas, contratos, informes y resúmenes, y asistentes para tu equipo y tus clientes. El consumo cuenta para los créditos de tu plan.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Últimos correos" description="Registro de envíos de esta cuenta" />
        {emails.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">Sin envíos todavía.</p>
        ) : (
          <ul className="pb-2">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{e.subject}</span>
                  <span className="block text-[12px] text-muted">
                    {e.to} · {relative(e.createdAt)}
                  </span>
                </span>
                <Badge tone={e.status === "SENT" ? "ok" : e.status === "FAILED" ? "danger" : "warn"}>{e.status === "SENT" ? "Enviado" : e.status === "FAILED" ? "Error" : "Sin servidor"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
