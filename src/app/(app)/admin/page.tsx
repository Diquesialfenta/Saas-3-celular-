import Link from "next/link";
import { db } from "@/lib/db";
import { money, relative } from "@/lib/format";
import { BarChart, HBars } from "@/components/charts";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui";

export const metadata = { title: "Superadministración" };

export default async function AdminHome() {
  const start = new Date();
  start.setMonth(start.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);
  const [subs, workspaces, users, payments, canceled30, storage, ai, recent, openTickets] = await Promise.all([
    db.subscription.findMany({ include: { plan: true } }),
    db.workspace.findMany({ select: { id: true, name: true, type: true, createdAt: true } }),
    db.user.count(),
    db.platformPayment.findMany({ where: { paidAt: { gte: start }, status: "PAID" } }),
    db.subscription.count({ where: { status: "CANCELED", updatedAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
    db.fileVersion.groupBy({ by: ["fileId"], _sum: { size: true } }),
    db.aiUsage.groupBy({ by: ["workspaceId"], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true, _sum: { inputTokens: true, outputTokens: true }, orderBy: { _count: { workspaceId: "desc" } }, take: 6 }),
    db.workspace.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { subscription: { include: { plan: true } } } }),
    db.platformTicket.count({ where: { status: "OPEN" } }),
  ]);
  const active = subs.filter((s) => s.status === "ACTIVE");
  const mrr = active.reduce((sum, s) => sum + (s.interval === "YEAR" ? s.plan.priceYearly / 12 : s.plan.priceMonthly), 0);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    return d;
  });
  const k = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const revenue = months.map((m) => ({ label: m.toLocaleDateString("es", { month: "short" }), value: payments.filter((p) => k(p.paidAt) === k(m)).reduce((s, p) => s + p.amount, 0) }));
  const signups = months.map((m) => ({ label: m.toLocaleDateString("es", { month: "short" }), value: workspaces.filter((w) => k(w.createdAt) === k(m)).length }));
  const totalStorage = storage.reduce((s, f) => s + (f._sum.size ?? 0), 0);
  const wsNames = new Map(workspaces.map((w) => [w.id, w.name]));
  const byPlan = Object.entries(subs.reduce<Record<string, number>>((acc, s) => ((acc[s.plan.name] = (acc[s.plan.name] ?? 0) + 1), acc), {})).map(([label, value]) => ({ label, value }));

  return (
    <>
      <h1 className="text-[30px] tracking-[-0.03em] mb-6">Resumen de la plataforma</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Ingreso recurrente mensual" value={money(Math.round(mrr), "USD")} hint={`${active.length} suscripciones de pago`} />
        <Stat label="Cuentas" value={workspaces.length} hint={`${workspaces.filter((w) => w.type === "COMPANY").length} empresas · ${workspaces.filter((w) => w.type === "FREELANCER").length} independientes`} />
        <Stat label="En prueba" value={subs.filter((s) => s.status === "TRIALING").length} hint={`${subs.filter((s) => s.status === "PAST_DUE").length} con impago`} tone={subs.some((s) => s.status === "PAST_DUE") ? "danger" : undefined} />
        <Stat label="Usuarios" value={users} hint={`${canceled30} bajas en 30 días · ${openTickets} consultas abiertas`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Cobros de suscripciones" description="Últimos 12 meses" />
          <div className="px-5 pb-5">
            <BarChart data={revenue} format={(n) => money(n, "USD")} label="Cobros de suscripciones por mes" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Altas de cuentas" />
          <div className="px-5 pb-5">
            <BarChart data={signups} format={(n) => `${n}`} label="Cuentas nuevas por mes" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Cuentas por plan" />
          <div className="px-5 pb-5">
            <HBars data={byPlan} format={(n) => `${n}`} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Consumo de IA" description={`Últimos 30 días · almacenamiento total ${(totalStorage / 1048576).toFixed(1)} MB`} />
          <div className="px-5 pb-5">
            {ai.length ? <HBars data={ai.map((a) => ({ label: wsNames.get(a.workspaceId) ?? "—", value: a._count, hint: `${Math.round(((a._sum.inputTokens ?? 0) + (a._sum.outputTokens ?? 0)) / 1000)}k tok` }))} format={(n) => `${n}`} /> : <p className="text-sm text-muted">Sin uso.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Últimas cuentas" />
          <ul className="pb-2">
            {recent.map((w) => (
              <li key={w.id}>
                <Link href={`/admin/cuentas/${w.id}`} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-surface text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{w.name}</span>
                    <span className="block text-[12px] text-muted">
                      {w.subscription?.plan.name} · {relative(w.createdAt)}
                    </span>
                  </span>
                  {w.subscription && <StatusBadge status={w.subscription.status} />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
