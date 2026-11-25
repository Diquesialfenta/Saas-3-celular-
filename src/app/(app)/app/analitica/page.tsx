import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { money } from "@/lib/format";
import { STAGES } from "@/lib/constants";
import { BarChart, HBars } from "@/components/charts";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Analítica" };

export default async function AnalyticsPage() {
  const ctx = await requireWorkspace("analytics.view");
  const ws = ctx.workspaceId;
  const cur = ctx.workspace.currency;
  const start = new Date();
  start.setMonth(start.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);
  const [payments, invoicedAgg, deals, proposals, projects, clients, responses, topClientsRaw, tickets, aiUsage] = await Promise.all([
    db.payment.findMany({ where: { workspaceId: ws, paidAt: { gte: start } }, select: { amount: true, paidAt: true } }),
    db.invoice.aggregate({ where: { workspaceId: ws, status: { not: "VOID" }, issueDate: { gte: start } }, _sum: { total: true } }),
    db.deal.findMany({ where: { workspaceId: ws }, select: { stage: true, status: true, value: true, source: true } }),
    db.proposal.findMany({ where: { workspaceId: ws, status: { not: "DRAFT" } }, select: { status: true, sentAt: true, acceptedAt: true } }),
    db.project.findMany({ where: { workspaceId: ws, status: "COMPLETED", completedAt: { gte: start } }, select: { dueDate: true, completedAt: true } }),
    db.client.findMany({ where: { workspaceId: ws }, select: { createdAt: true, status: true } }),
    db.surveyResponse.findMany({ where: { workspaceId: ws, completedAt: { not: null } }, select: { score: true } }),
    db.payment.groupBy({ by: ["invoiceId"], where: { workspaceId: ws, paidAt: { gte: start } }, _sum: { amount: true } }),
    db.ticket.findMany({ where: { workspaceId: ws, createdAt: { gte: new Date(Date.now() - 90 * 86400_000) } }, select: { status: true } }),
    db.aiUsage.count({ where: { workspaceId: ws, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    return d;
  });
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const byMonth = new Map<string, number>();
  for (const p of payments) byMonth.set(key(p.paidAt), (byMonth.get(key(p.paidAt)) ?? 0) + p.amount);
  const revenue = months.map((m) => ({ label: m.toLocaleDateString("es", { month: "short" }), value: byMonth.get(key(m)) ?? 0 }));
  const total = revenue.reduce((s, r) => s + r.value, 0);
  const newClients = months.map((m) => ({ label: m.toLocaleDateString("es", { month: "short" }), value: clients.filter((c) => key(c.createdAt) === key(m)).length }));

  const open = deals.filter((d) => d.status === "OPEN");
  const funnel = STAGES.filter((s) => s.id !== "LOST").map((s) => ({ label: s.label, value: deals.filter((d) => d.stage === s.id).reduce((a, d) => a + d.value, 0), hint: `(${deals.filter((d) => d.stage === s.id).length})` }));
  const closed = deals.filter((d) => d.status !== "OPEN");
  const winRate = closed.length ? Math.round((closed.filter((d) => d.status === "WON").length / closed.length) * 100) : null;
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  const acceptRate = proposals.length ? Math.round((accepted.length / proposals.length) * 100) : null;
  const daysToAccept = accepted.filter((p) => p.sentAt && p.acceptedAt).map((p) => (p.acceptedAt!.getTime() - p.sentAt!.getTime()) / 86400_000);
  const avgAccept = daysToAccept.length ? (daysToAccept.reduce((a, b) => a + b, 0) / daysToAccept.length).toFixed(1) : null;
  const onTime = projects.filter((p) => !p.dueDate || (p.completedAt && p.completedAt <= new Date(p.dueDate.getTime() + 86400_000))).length;
  const scores = responses.map((r) => r.score ?? 0);
  const nps = scores.length ? Math.round(((scores.filter((s) => s >= 9).length - scores.filter((s) => s <= 6).length) / scores.length) * 100) : null;
  const sources = Object.entries(deals.reduce<Record<string, number>>((acc, d) => ((acc[d.source ?? "Sin origen"] = (acc[d.source ?? "Sin origen"] ?? 0) + d.value), acc), {}))
    .map(([label, value]) => ({ label: ({ INBOUND: "Entrante", OUTBOUND: "Prospección", REFERRAL: "Recomendación", UPSELL: "Venta adicional", RENEWAL: "Renovación" } as Record<string, string>)[label] ?? label, value }))
    .sort((a, b) => b.value - a.value);

  const invoiceClients = await db.invoice.findMany({ where: { id: { in: topClientsRaw.map((t) => t.invoiceId) } }, select: { id: true, client: { select: { name: true } } } });
  const clientTotals = new Map<string, number>();
  for (const t of topClientsRaw) {
    const name = invoiceClients.find((i) => i.id === t.invoiceId)?.client.name ?? "—";
    clientTotals.set(name, (clientTotals.get(name) ?? 0) + (t._sum.amount ?? 0));
  }
  const topClients = [...clientTotals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  let team: { label: string; value: number; hint?: string }[] = [];
  if (ctx.isCompany) {
    const members = await db.membership.findMany({ where: { workspaceId: ws }, include: { user: { select: { id: true, name: true } } } });
    const done = await db.task.groupBy({ by: ["assigneeId"], where: { workspaceId: ws, status: "DONE", completedAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true });
    team = members.map((m) => ({ label: m.user.name, value: done.find((d) => d.assigneeId === m.user.id)?._count ?? 0 })).sort((a, b) => b.value - a.value);
  }
  const fmtMoney = (n: number) => money(n, cur);

  return (
    <>
      <PageHeader title="Analítica" description="Ingresos, ventas, entrega y satisfacción de los últimos 12 meses." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cobrado (12 meses)" value={money(total, cur)} hint={`Facturado: ${money(invoicedAgg._sum.total ?? 0, cur)}`} />
        <Stat label="Embudo abierto" value={money(open.reduce((s, d) => s + d.value, 0), cur)} hint={`${open.length} oportunidades`} />
        <Stat label="Propuestas aceptadas" value={acceptRate === null ? "—" : `${acceptRate} %`} hint={avgAccept ? `${avgAccept} días de media hasta el sí` : undefined} />
        <Stat label="NPS" value={nps ?? "—"} hint={`${scores.length} respuestas`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Cobros por mes" description="Pagos recibidos" />
          <div className="px-5 pb-5">
            <BarChart data={revenue} format={fmtMoney} label="Cobros por mes en los últimos 12 meses" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Clientes nuevos por mes" />
          <div className="px-5 pb-5">
            <BarChart data={newClients} format={(n) => `${n}`} label="Clientes nuevos por mes" />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Embudo por etapa" description={`Valor de las oportunidades · tasa de cierre ${winRate === null ? "—" : `${winRate} %`}`} />
          <div className="px-5 pb-5">
            <HBars data={funnel} format={fmtMoney} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Entrega" />
          <dl className="px-5 pb-5 grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Proyectos completados</dt>
              <dd className="tabular-nums">{projects.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Entregados a tiempo</dt>
              <dd className="tabular-nums">{projects.length ? `${Math.round((onTime / projects.length) * 100)} %` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tickets (90 días)</dt>
              <dd className="tabular-nums">{tickets.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tickets resueltos</dt>
              <dd className="tabular-nums">{tickets.length ? `${Math.round((tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length / tickets.length) * 100)} %` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Usos de IA este mes</dt>
              <dd className="tabular-nums">{aiUsage}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Clientes que más aportan" description="Cobrado en 12 meses" />
          <div className="px-5 pb-5">{topClients.length ? <HBars data={topClients} format={fmtMoney} /> : <p className="text-sm text-muted">Sin cobros todavía.</p>}</div>
        </Card>
        <Card>
          <CardHeader title="Origen de las oportunidades" />
          <div className="px-5 pb-5">{sources.length ? <HBars data={sources} format={fmtMoney} /> : <p className="text-sm text-muted">Sin oportunidades todavía.</p>}</div>
        </Card>
        {ctx.isCompany && (
          <Card>
            <CardHeader title="Productividad del equipo" description="Tareas completadas en 30 días" />
            <div className="px-5 pb-5">
              <HBars data={team} format={(n) => `${n}`} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
