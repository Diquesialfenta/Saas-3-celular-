import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { dateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { Thread } from "@/components/thread";
import { replyTicketTeamAction, updateTicketAction } from "../actions";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("support.manage");
  const t = await db.ticket.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  const [client, members] = await Promise.all([
    db.client.findUnique({ where: { id: t.clientId }, select: { id: true, name: true } }),
    db.membership.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/app/soporte", label: "Soporte" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            #{t.number} {t.subject} <StatusBadge status={t.status} />
          </span>
        }
        description={
          <>
            <Link href={`/app/clientes/${t.clientId}`} className="hover:underline">
              {client?.name}
            </Link>{" "}
            · abierto {dateTime(t.createdAt)}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
        <Card className="p-5">
          <Thread messages={t.messages} mine="TEAM" />
          <ActionForm action={replyTicketTeamAction} reset className="mt-6 grid gap-3 border-t border-line pt-4">
            <input type="hidden" name="id" value={t.id} />
            <label htmlFor="body" className="sr-only">
              Respuesta
            </label>
            <Textarea id="body" name="body" placeholder="Escribe la respuesta al cliente" className="min-h-28" required />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label htmlFor="after" className="text-[13px] text-muted">
                Después de responder:
              </label>
              <Select id="after" name="status" defaultValue="PENDING" className="w-52 h-9">
                <option value="PENDING">Esperar al cliente</option>
                <option value="OPEN">Mantener abierto</option>
                <option value="RESOLVED">Marcar resuelto</option>
              </Select>
              <SubmitButton>Responder</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <ActionForm action={updateTicketAction} className="grid gap-4">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Estado" htmlFor="status">
              <Select id="status" name="status" defaultValue={t.status}>
                <option value="OPEN">Abierto</option>
                <option value="PENDING">Esperando al cliente</option>
                <option value="RESOLVED">Resuelto</option>
                <option value="CLOSED">Cerrado</option>
              </Select>
            </Field>
            <Field label="Prioridad" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue={t.priority}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </Select>
            </Field>
            <Field label="Responsable" htmlFor="assigneeId">
              <Select id="assigneeId" name="assigneeId" defaultValue={t.assigneeId ?? ""}>
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton variant="secondary">Guardar</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
