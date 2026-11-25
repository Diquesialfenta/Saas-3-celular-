import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, Input, Select, StatusBadge, Textarea } from "@/components/ui";
import { Thread } from "@/components/thread";
import { createTicketAction, replyTicketAction } from "../../actions";

export const metadata = { title: "Soporte" };

export default async function PortalSupport({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ ticket?: string }> }) {
  const { clientId } = await params;
  const { ticket } = await searchParams;
  const ctx = await requirePortal(clientId);
  const [tickets, projects] = await Promise.all([
    db.ticket.findMany({ where: { workspaceId: ctx.workspaceId, clientId }, orderBy: { updatedAt: "desc" } }),
    db.project.findMany({ where: { workspaceId: ctx.workspaceId, clientId, visibleToClient: true }, select: { id: true, name: true } }),
  ]);
  const open = ticket ? await db.ticket.findFirst({ where: { id: ticket, workspaceId: ctx.workspaceId, clientId }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[30px] tracking-[-0.03em]">Soporte</h1>
        <Modal trigger="Abrir un ticket" title="Nuevo ticket de soporte">
          <ActionForm action={createTicketAction} className="grid gap-4">
            <input type="hidden" name="clientId" value={clientId} />
            <Field label="Asunto" htmlFor="subject">
              <Input id="subject" name="subject" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proyecto" htmlFor="projectId">
                <Select id="projectId" name="projectId">
                  <option value="">General</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Urgencia" htmlFor="priority">
                <Select id="priority" name="priority" defaultValue="MEDIUM">
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </Select>
              </Field>
            </div>
            <Field label="Describe el problema" htmlFor="body">
              <Textarea id="body" name="body" required className="min-h-32" />
            </Field>
            <SubmitButton>Abrir ticket</SubmitButton>
          </ActionForm>
        </Modal>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] items-start">
        <Card>
          {tickets.length === 0 ? (
            <EmptyState title="No tienes tickets" description="Si algo no funciona o necesitas ayuda tras la entrega, abre un ticket." />
          ) : (
            <ul>
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/portal/${clientId}/soporte?ticket=${t.id}`} className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-line hover:bg-surface ${t.id === ticket ? "bg-surface" : ""}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        #{t.number} {t.subject}
                      </span>
                      <span className="block text-[12px] text-muted">{relative(t.updatedAt)}</span>
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {open && (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="font-medium">
                #{open.number} · {open.subject}
              </p>
              <StatusBadge status={open.status} />
            </div>
            <Thread messages={open.messages} mine="CLIENT" />
            <ActionForm action={replyTicketAction} reset className="mt-4 grid gap-2">
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="id" value={open.id} />
              <label htmlFor="reply" className="sr-only">
                Respuesta
              </label>
              <Textarea id="reply" name="body" placeholder="Escribe tu respuesta" required />
              <SubmitButton size="sm" className="justify-self-end">
                Responder
              </SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
