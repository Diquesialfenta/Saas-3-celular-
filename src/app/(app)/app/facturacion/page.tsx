import Link from "next/link";
import { Receipt } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, money } from "@/lib/format";
import { runRecurringPlans } from "@/lib/services/billing";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, Checkbox, EmptyState, Field, Input, PageHeader, Select, Stat, StatusBadge, Table, Tabs, Td, Th } from "@/components/ui";
import { createRecurringAction, setRecurringStatusAction } from "./actions";

export const metadata = { title: "Facturación" };

const INTERVAL: Record<string, string> = { WEEK: "Semanal", MONTH: "Mensual", QUARTER: "Trimestral", YEAR: "Anual" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ vista?: string; estado?: string }> }) {
  const ctx = await requireWorkspace("billing.view");
  const { vista = "facturas", estado } = await searchParams;
  await runRecurringPlans(ctx.workspaceId);
  const ws = ctx.workspaceId;
  const cur = ctx.workspace.currency;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [open, month, overdueCount, recurringActive] = await Promise.all([
    db.invoice.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, select: { total: true, amountPaid: true, status: true } }),
    db.payment.aggregate({ where: { workspaceId: ws, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.invoice.count({ where: { workspaceId: ws, status: "OVERDUE" } }),
    db.recurringPlan.findMany({ where: { workspaceId: ws, status: "ACTIVE" } }),
  ]);
  const mrr = recurringActive.reduce((s, r) => {
    const amt = (r.items as { quantity: number; unitPrice: number }[]).reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    return s + (r.interval === "WEEK" ? amt * 4.33 : r.interval === "QUARTER" ? amt / 3 : r.interval === "YEAR" ? amt / 12 : amt);
  }, 0);
  const tabs = [
    { href: "/app/facturacion", label: "Facturas" },
    { href: "/app/facturacion?vista=recurrentes", label: "Cobros recurrentes" },
    { href: "/app/facturacion?vista=pagos", label: "Pagos recibidos" },
  ];
  const current = vista === "recurrentes" ? tabs[1].href : vista === "pagos" ? tabs[2].href : tabs[0].href;
  const clients = await db.client.findMany({ where: { workspaceId: ws, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Facturación"
        description="Facturas, anticipos, pagos fraccionados y cobros recurrentes, con pago en línea desde el portal."
        actions={ctx.can("billing.manage") && <ButtonLink href="/app/facturacion/nueva">Crear factura</ButtonLink>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Cobrado este mes" value={money(month._sum.amount ?? 0, cur)} />
        <Stat label="Pendiente de cobro" value={money(open.reduce((s, i) => s + i.total - i.amountPaid, 0), cur)} />
        <Stat label="Facturas vencidas" value={overdueCount} tone={overdueCount ? "danger" : "ok"} hint={overdueCount ? "Requieren seguimiento" : "Todo al día"} />
        <Stat label="Ingreso recurrente mensual" value={money(Math.round(mrr), cur)} hint={`${recurringActive.length} planes activos`} />
      </div>
      <Tabs items={tabs} current={current} />
      {vista === "recurrentes" ? (
        <Recurring workspaceId={ws} clients={clients} canManage={ctx.can("billing.manage")} currency={cur} />
      ) : vista === "pagos" ? (
        <Payments workspaceId={ws} />
      ) : (
        <Invoices workspaceId={ws} estado={estado} />
      )}
    </>
  );
}

async function Invoices({ workspaceId, estado }: { workspaceId: string; estado?: string }) {
  const where: Prisma.InvoiceWhereInput = { workspaceId, ...(estado ? { status: estado as Prisma.EnumInvoiceStatusFilter["equals"] } : {}) };
  const invoices = await db.invoice.findMany({ where, include: { client: { select: { name: true } } }, orderBy: { issueDate: "desc" }, take: 300 });
  const filters = ["", "DRAFT", "SENT", "PARTIAL", "OVERDUE", "PAID"];
  return (
    <Card>
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-line">
        {filters.map((f) => (
          <Link key={f} href={f ? `/app/facturacion?estado=${f}` : "/app/facturacion"} className={`rounded-full px-3 h-8 inline-flex items-center text-[13px] border transition-colors ${(estado ?? "") === f ? "bg-ink text-white border-ink" : "border-line hover:bg-surface"}`}>
            {f ? <StatusLabel s={f} /> : "Todas"}
          </Link>
        ))}
      </div>
      {invoices.length === 0 ? (
        <EmptyState icon={<Receipt className="size-5" />} title="No hay facturas" description="Crea una factura o genera las de una propuesta aceptada." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Factura</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th className="text-right">Total</Th>
              <Th className="hidden md:table-cell text-right">Pendiente</Th>
              <Th className="hidden sm:table-cell text-right">Vence</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-surface/60">
                <Td>
                  <Link href={`/app/facturacion/${i.id}`}>
                    <span className="block font-medium font-mono text-[13px]">{i.number}</span>
                    <span className="block text-[12px] text-muted truncate max-w-[220px]">
                      {i.title ?? "—"}
                      {i.installmentCount ? ` · ${i.installmentIndex}/${i.installmentCount}` : ""}
                    </span>
                  </Link>
                </Td>
                <Td className="text-muted">{i.client.name}</Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
                <Td className="text-right tabular-nums">{money(i.total, i.currency)}</Td>
                <Td className="hidden md:table-cell text-right tabular-nums text-muted">{i.status === "VOID" ? "—" : money(i.total - i.amountPaid, i.currency)}</Td>
                <Td className="hidden sm:table-cell text-right text-muted">{date(i.dueDate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function StatusLabel({ s }: { s: string }) {
  return <>{{ DRAFT: "Borradores", SENT: "Enviadas", PARTIAL: "Pago parcial", OVERDUE: "Vencidas", PAID: "Pagadas" }[s] ?? s}</>;
}

async function Payments({ workspaceId }: { workspaceId: string }) {
  const payments = await db.payment.findMany({ where: { workspaceId }, include: { invoice: { include: { client: { select: { name: true } } } } }, orderBy: { paidAt: "desc" }, take: 200 });
  return (
    <Card>
      {payments.length === 0 ? (
        <EmptyState title="Aún no hay pagos registrados" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>Factura</Th>
              <Th>Método</Th>
              <Th className="text-right">Importe</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="text-muted">{date(p.paidAt)}</Td>
                <Td>{p.invoice.client.name}</Td>
                <Td>
                  <Link href={`/app/facturacion/${p.invoiceId}`} className="font-mono text-[13px] hover:underline">
                    {p.invoice.number}
                  </Link>
                </Td>
                <Td>
                  <Badge>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</Badge>
                </Td>
                <Td className="text-right tabular-nums font-medium">{money(p.amount, p.invoice.currency)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

async function Recurring({ workspaceId, clients, canManage, currency }: { workspaceId: string; clients: { id: string; name: string }[]; canManage: boolean; currency: string }) {
  const plans = await db.recurringPlan.findMany({ where: { workspaceId, status: { not: "CANCELED" } }, orderBy: { nextRunAt: "asc" } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 p-4 border-b border-line">
        <p className="text-sm text-muted">Las facturas se generan y envían solas en cada periodo.</p>
        {canManage && (
          <Modal trigger="Programar cobro" title="Nuevo cobro recurrente" triggerSize="sm">
            <ActionForm action={createRecurringAction} className="grid gap-4">
              <Field label="Cliente" htmlFor="r-client">
                <Select id="r-client" name="clientId" required>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Concepto" htmlFor="r-name">
                <Input id="r-name" name="name" placeholder="Mantenimiento mensual" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Importe (${currency})`} htmlFor="r-amount">
                  <Input id="r-amount" name="amount" inputMode="decimal" required />
                </Field>
                <Field label="Impuesto %" htmlFor="r-tax">
                  <Input id="r-tax" name="taxRate" type="number" min={0} max={100} step={0.01} defaultValue={0} />
                </Field>
                <Field label="Periodicidad" htmlFor="r-int">
                  <Select id="r-int" name="interval" defaultValue="MONTH">
                    {Object.entries(INTERVAL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Primera factura" htmlFor="r-start">
                  <Input id="r-start" name="startDate" type="date" />
                </Field>
              </div>
              <Field label="Termina (opcional)" htmlFor="r-end">
                <Input id="r-end" name="endsAt" type="date" />
              </Field>
              <Checkbox name="autoSend" defaultChecked label="Enviar cada factura automáticamente al cliente" />
              <SubmitButton>Programar</SubmitButton>
            </ActionForm>
          </Modal>
        )}
      </div>
      {plans.length === 0 ? (
        <EmptyState title="Sin cobros recurrentes" description="Programa cuotas mensuales, igualas o mantenimientos. También se crean al aceptar propuestas con conceptos periódicos." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Concepto</Th>
              <Th>Cliente</Th>
              <Th>Periodicidad</Th>
              <Th className="text-right">Importe</Th>
              <Th>Próxima</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const amount = (p.items as { quantity: number; unitPrice: number }[]).reduce((a, i) => a + i.quantity * i.unitPrice, 0);
              return (
                <tr key={p.id}>
                  <Td className="font-medium">
                    {p.name} {p.status === "PAUSED" && <Badge tone="warn">En pausa</Badge>}
                  </Td>
                  <Td className="text-muted">{names.get(p.clientId) ?? "—"}</Td>
                  <Td>{INTERVAL[p.interval]}</Td>
                  <Td className="text-right tabular-nums">{money(amount, p.currency)}</Td>
                  <Td className="text-muted">{date(p.nextRunAt)}</Td>
                  <Td className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <ActionButton action={setRecurringStatusAction} fields={{ id: p.id, status: p.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }} variant="ghost">
                          {p.status === "ACTIVE" ? "Pausar" : "Reanudar"}
                        </ActionButton>
                        <ActionButton action={setRecurringStatusAction} fields={{ id: p.id, status: "CANCELED" }} variant="ghost" confirm="¿Cancelar este cobro recurrente?">
                          Cancelar
                        </ActionButton>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
