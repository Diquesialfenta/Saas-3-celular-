import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { APP_NAME } from "@/lib/config";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, Input, PageHeader, Textarea, cx, Badge } from "@/components/ui";
import { createPlatformTicketAction, replyMyPlatformTicketAction } from "../../admin/actions";

export const metadata = { title: "Ayuda" };

type Msg = { from: string; body: string; at: string; name: string };

export default async function HelpPage() {
  const ctx = await requireWorkspace();
  const tickets = await db.platformTicket.findMany({ where: { userId: ctx.user.id }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader
        title="Ayuda"
        description={`Escribe al equipo de ${APP_NAME} si algo no funciona o tienes dudas sobre tu cuenta.`}
        actions={
          <Modal trigger="Escribir a soporte" title="Nueva consulta">
            <ActionForm action={createPlatformTicketAction} className="grid gap-4">
              <Field label="Asunto" htmlFor="subject">
                <Input id="subject" name="subject" required />
              </Field>
              <Field label="Mensaje" htmlFor="body">
                <Textarea id="body" name="body" className="min-h-32" required />
              </Field>
              <SubmitButton>Enviar</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      {tickets.length === 0 ? (
        <Card>
          <EmptyState title="Sin consultas" description="Tus consultas al soporte aparecerán aquí con sus respuestas." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{t.subject}</p>
                <Badge tone={t.status === "ANSWERED" ? "ok" : t.status === "OPEN" ? "warn" : "neutral"}>{t.status === "ANSWERED" ? "Respondida" : t.status === "OPEN" ? "Esperando respuesta" : "Cerrada"}</Badge>
              </div>
              <ol className="mt-4 grid gap-3">
                {(t.messages as Msg[]).map((m, i) => (
                  <li key={i} className={cx("rounded-[12px] px-4 py-3 max-w-[85%]", m.from === "user" ? "ml-auto bg-ink text-white" : "bg-surface")}>
                    <p className={cx("text-[12px]", m.from === "user" ? "text-white/60" : "text-muted")}>
                      {m.from === "admin" ? `Soporte de ${APP_NAME}` : m.name} · {relative(m.at)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ol>
              {t.status !== "CLOSED" && (
                <ActionForm action={replyMyPlatformTicketAction} reset className="mt-4 flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <label htmlFor={`r-${t.id}`} className="sr-only">
                    Respuesta
                  </label>
                  <Input id={`r-${t.id}`} name="body" placeholder="Responder" required />
                  <SubmitButton variant="secondary">Enviar</SubmitButton>
                </ActionForm>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
