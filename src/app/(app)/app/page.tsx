import Link from "next/link";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { money, date, relative } from "@/lib/format";
import { runRecurringPlans } from "@/lib/services/billing";
import { Card, CardHeader, EmptyState, PageHeader, PriorityDot, Stat, StatusBadge, ButtonLink, cx } from "@/components/ui";

export const metadata = { title: "Inicio" };

export default async function Dashboard() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspaceId;
  await runRecurringPlans(ws);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date(Date.now() + 7 * 86400_000);

  const [paid, receivable, overdue, pipeline, activeProjects, myTasks, awaiting, meetings, activities, setup] = await Promise.all([
    db.payment.aggregate({ where: { workspaceId: ws, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.invoice.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true } }),
    db.invoice.count({ where: { workspaceId: ws, status: "OVERDUE" } }),
    db.deal.aggregate({ where: { workspaceId: ws, status: "OPEN" }, _sum: { value: true }, _count: true }),
    db.project.count({ where: { workspaceId: ws, status: "ACTIVE" } }),
    db.task.findMany({
      where: { workspaceId: ws, assigneeId: ctx.user.id, status: { not: "DONE" }, parentId: null },
      include: { project: { select: { name: true, id: true } } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 7,
    }),
    db.proposal.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "VIEWED"] } }, include: { client: true }, orderBy: { sentAt: "asc" }, take: 5 }),
    db.meeting.findMany({ where: { workspaceId: ws, status: "SCHEDULED", startsAt: { gte: new Date(), lte: soon } }, orderBy: { startsAt: "asc" }, take: 5 }),
    db.activity.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 8 }),
    Promise.all([
      db.client.count({ where: { workspaceId: ws } }),
      db.proposal.count({ where: { workspaceId: ws, status: { not: "DRAFT" } } }),
      db.portalAccess.count({ where: { workspaceId: ws } }),
      db.integration.count({ where: { workspaceId: ws } }),
    ]),
  ]);
  const due = receivable.reduce((s, i) => s + i.total - i.amountPaid, 0);
  const cur = ctx.workspace.currency;
  const [clientCount, sentCount, portalCount, integrationCount] = setup;
  const steps = [
    { done: !!(ctx.workspace.logoUrl || ctx.workspace.address || ctx.workspace.email), label: "Completa los datos y la marca de tu cuenta", href: "/app/configuracion" },
    { done: clientCount > 0, label: "Añade tu primer cliente", href: "/app/clientes?nuevo=1" },
    { done: sentCount > 0, label: "Envía tu primera propuesta", href: "/app/propuestas" },
    { done: portalCount > 0, label: "Invita a un cliente a su portal", href: "/app/clientes" },
    { done: integrationCount > 0, label: "Conecta pagos, correo o WhatsApp", href: "/app/integraciones" },
  ];
  const pending = steps.filter((s) => !s.done).length;
  const hour = new Date().getHours();

  return (
    <>
      <PageHeader
        title={`${hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches"}, ${ctx.user.name.split(" ")[0]}`}
        description={`Esto es lo que pasa hoy en ${ctx.workspace.name}.`}
        actions={
          ctx.can("sales.manage") && (
            <ButtonLink href="/app/propuestas/nueva" prefetch={false}>
              Crear propuesta
            </ButtonLink>
          )
        }
      />

      {pending > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="grid lg:grid-cols-[280px_1fr]">
            <div className="bg-ink text-white p-6">
              <p className="text-[13px] text-white/60">Puesta en marcha</p>
              <p className="font-display text-2xl mt-1 tracking-[-0.02em]">
                {steps.length - pending} de {steps.length} pasos
              </p>
              <div className="mt-4 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${((steps.length - pending) / steps.length) * 100}%` }} />
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-px bg-line [&>li:last-child:nth-child(odd)]:sm:col-span-2">
              {steps.map((s) => (
                <li key={s.label} className="bg-white">
                  <Link href={s.href} className="flex items-center gap-3 px-5 py-4 text-sm hover:bg-surface transition-colors h-full">
                    <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border", s.done ? "bg-accent border-accent-strong" : "border-line-strong")}>
                      {s.done && <Check className="size-3 text-accent-ink" strokeWidth={3} />}
                    </span>
                    <span className={cx(s.done && "text-muted line-through decoration-line-strong")}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        {ctx.can("billing.view") && <Stat label="Cobrado este mes" value={money(paid._sum.amount ?? 0, cur)} />}
        {ctx.can("billing.view") && <Stat label="Pendiente de cobro" value={money(due, cur)} hint={overdue ? `${overdue} factura(s) vencida(s)` : "Nada vencido"} tone={overdue ? "danger" : "ok"} />}
        {ctx.can("sales.manage") && <Stat label="Oportunidades abiertas" value={money(pipeline._sum.value ?? 0, cur)} hint={`${pipeline._count} en curso`} />}
        <Stat label="Proyectos activos" value={activeProjects} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Mis tareas" description="Ordenadas por fecha de entrega" action={<Link href="/app/tareas" className="text-[13px] text-muted hover:text-ink">Ver todas</Link>} />
          {myTasks.length === 0 ? (
            <EmptyState title="No tienes tareas pendientes" description="Las tareas asignadas a ti aparecerán aquí." />
          ) : (
            <ul className="pb-2">
              {myTasks.map((t) => {
                const late = t.dueDate && t.dueDate < new Date();
                return (
                  <li key={t.id}>
                    <Link href={`/app/proyectos/${t.project.id}?tarea=${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface transition-colors">
                      <StatusBadge status={t.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{t.title}</span>
                        <span className="block truncate text-[12px] text-muted">{t.project.name}</span>
                      </span>
                      <PriorityDot priority={t.priority} />
                      <span className={cx("w-24 text-right text-[13px] tabular-nums", late ? "text-danger" : "text-muted")}>{t.dueDate ? date(t.dueDate, { day: "numeric", month: "short" }) : "—"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximas reuniones" description="Siguientes 7 días" />
          {meetings.length === 0 ? (
            <EmptyState title="Sin reuniones próximas" />
          ) : (
            <ul className="pb-3">
              {meetings.map((m) => (
                <li key={m.id} className="px-5 py-2.5">
                  <p className="text-sm">{m.title}</p>
                  <p className="text-[13px] text-muted">{date(m.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {ctx.can("sales.manage") && (
          <Card className="lg:col-span-2">
            <CardHeader title="Propuestas esperando respuesta" />
            {awaiting.length === 0 ? (
              <EmptyState title="Ninguna propuesta pendiente" description="Cuando envíes una propuesta verás aquí si el cliente la ha abierto." />
            ) : (
              <ul className="pb-2">
                {awaiting.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/propuestas/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface transition-colors">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{p.title}</span>
                        <span className="block text-[12px] text-muted">
                          {p.client.name} · enviada {p.sentAt ? relative(p.sentAt) : ""}
                        </span>
                      </span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <CardHeader title="Actividad reciente" />
          {activities.length === 0 ? (
            <EmptyState title="Todavía no hay actividad" />
          ) : (
            <ol className="px-5 pb-4 grid gap-3">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-line-strong" />
                  <span>
                    {a.content}
                    <span className="block text-[12px] text-faint">{relative(a.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
