import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, Checkbox, EmptyState, PageHeader, Textarea, cx } from "@/components/ui";
import { Thread } from "@/components/thread";
import { sendMessageAction } from "./actions";

export const metadata = { title: "Mensajes" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const ctx = await requireWorkspace("clients.view");
  const { cliente } = await searchParams;
  const latest = await db.message.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, distinct: ["clientId"], take: 100 });
  const unread = await db.message.groupBy({ by: ["clientId"], where: { workspaceId: ctx.workspaceId, authorType: "CLIENT", readAt: null }, _count: true });
  const clients = await db.client.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: [...latest.map((m) => m.clientId), ...(cliente ? [cliente] : [])] } }, select: { id: true, name: true, phone: true } });
  const names = new Map(clients.map((c) => [c.id, c]));
  const active = cliente ? names.get(cliente) : undefined;
  const thread = active ? await db.message.findMany({ where: { workspaceId: ctx.workspaceId, clientId: active.id }, orderBy: { createdAt: "asc" }, take: 300 }) : [];
  if (active) await db.message.updateMany({ where: { workspaceId: ctx.workspaceId, clientId: active.id, authorType: "CLIENT", readAt: null }, data: { readAt: new Date() } });
  const allClients = await db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 });

  return (
    <>
      <PageHeader title="Mensajes" description="Conversaciones con tus clientes. Ellos responden desde su portal y reciben aviso por correo." />
      <Card className="grid md:grid-cols-[300px_1fr] min-h-[600px] overflow-hidden">
        <aside className={cx("border-r border-line flex flex-col", active && "hidden md:flex")}>
          <form className="p-3 border-b border-line" action="/app/mensajes">
            <label htmlFor="new-thread" className="sr-only">
              Escribir a un cliente
            </label>
            <select id="new-thread" name="cliente" className="w-full h-9 rounded-[10px] border border-line bg-white px-2 text-sm" defaultValue="">
              <option value="" disabled>
                Escribir a un cliente…
              </option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="mt-2 w-full h-8 rounded-full bg-surface text-[13px] hover:bg-surface-2 press">Abrir conversación</button>
          </form>
          <ul className="flex-1 overflow-y-auto scroll-thin">
            {latest.length === 0 && <li className="p-6 text-sm text-muted">Aún no hay conversaciones.</li>}
            {latest.map((m) => {
              const c = names.get(m.clientId);
              const n = unread.find((u) => u.clientId === m.clientId)?._count ?? 0;
              return (
                <li key={m.clientId}>
                  <Link href={`/app/mensajes?cliente=${m.clientId}`} className={cx("flex gap-3 px-4 py-3 border-b border-line hover:bg-surface", m.clientId === cliente && "bg-surface")}>
                    <Avatar name={c?.name ?? "?"} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cx("truncate text-sm", n && "font-medium")}>{c?.name}</span>
                        <span className="text-[11px] text-faint shrink-0">{relative(m.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] text-muted flex-1">{m.body}</span>
                        {n > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] text-white">{n}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className={cx("flex flex-col bg-surface/50", !active && "hidden md:flex")}>
          {!active ? (
            <EmptyState icon={<MessageSquare className="size-5" />} title="Elige una conversación" />
          ) : (
            <>
              <header className="flex items-center gap-3 px-5 h-14 border-b border-line bg-white">
                <Link href="/app/mensajes" className="md:hidden text-muted" aria-label="Volver">
                  ←
                </Link>
                <Link href={`/app/clientes/${active.id}`} className="font-medium hover:underline">
                  {active.name}
                </Link>
              </header>
              <div className="flex-1 overflow-y-auto scroll-thin p-5 flex flex-col-reverse">
                <div>
                  <Thread messages={thread} mine="TEAM" />
                </div>
              </div>
              <ActionForm action={sendMessageAction} reset className="border-t border-line bg-white p-3 grid gap-2">
                <input type="hidden" name="clientId" value={active.id} />
                <label htmlFor="msg" className="sr-only">
                  Mensaje
                </label>
                <Textarea id="msg" name="body" placeholder={`Escribe a ${active.name}`} className="min-h-16" required />
                <div className="flex items-center justify-between gap-2">
                  {active.phone ? <Checkbox name="whatsapp" label="Enviar también por WhatsApp" /> : <span />}
                  <SubmitButton size="sm">Enviar</SubmitButton>
                </div>
              </ActionForm>
            </>
          )}
        </section>
      </Card>
    </>
  );
}
