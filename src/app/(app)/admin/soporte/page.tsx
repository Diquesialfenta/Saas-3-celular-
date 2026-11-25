import Link from "next/link";
import { db } from "@/lib/db";
import { relative } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Select, Textarea, cx, Badge } from "@/components/ui";
import { replyPlatformTicketAction } from "../actions";

export const metadata = { title: "Soporte de la plataforma" };

type Msg = { from: string; body: string; at: string; name: string };

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const tickets = await db.platformTicket.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 200 });
  const open = tickets.find((x) => x.id === t);
  const wsNames = new Map((await db.workspace.findMany({ where: { id: { in: tickets.map((x) => x.workspaceId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((w) => [w.id, w.name]));
  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Soporte de la plataforma</h1>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] items-start">
        <Card>
          {tickets.length === 0 ? (
            <EmptyState title="Sin consultas" />
          ) : (
            <ul>
              {tickets.map((x) => (
                <li key={x.id}>
                  <Link href={`/admin/soporte?t=${x.id}`} className={cx("flex items-center justify-between gap-3 px-4 py-3 border-b border-line hover:bg-surface", x.id === t && "bg-surface")}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{x.subject}</span>
                      <span className="block text-[12px] text-muted">
                        {x.workspaceId ? wsNames.get(x.workspaceId) : "Sin cuenta"} · {relative(x.updatedAt)}
                      </span>
                    </span>
                    <Badge tone={x.status === "OPEN" ? "warn" : x.status === "ANSWERED" ? "info" : "neutral"}>{x.status === "OPEN" ? "Abierta" : x.status === "ANSWERED" ? "Respondida" : "Cerrada"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {open && (
          <Card className="p-5">
            <p className="font-medium mb-4">{open.subject}</p>
            <ol className="grid gap-3">
              {(open.messages as Msg[]).map((m, i) => (
                <li key={i} className={cx("rounded-[12px] px-4 py-3 max-w-[85%]", m.from === "admin" ? "ml-auto bg-ink text-white" : "bg-surface")}>
                  <p className={cx("text-[12px]", m.from === "admin" ? "text-white/60" : "text-muted")}>
                    {m.name} · {relative(m.at)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ol>
            <ActionForm action={replyPlatformTicketAction} reset className="mt-5 grid gap-2">
              <input type="hidden" name="id" value={open.id} />
              <label htmlFor="body" className="sr-only">
                Respuesta
              </label>
              <Textarea id="body" name="body" required />
              <div className="flex justify-end gap-2">
                <label htmlFor="st" className="sr-only">
                  Estado
                </label>
                <Select id="st" name="status" defaultValue="ANSWERED" className="w-44 h-9">
                  <option value="ANSWERED">Respondida</option>
                  <option value="CLOSED">Cerrar</option>
                </Select>
                <SubmitButton>Responder</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
