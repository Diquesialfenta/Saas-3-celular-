import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { date, dateTime, inputDate, money } from "@/lib/format";
import { checkLimit, type PlanLimits } from "@/lib/services/workspace";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input, Select, StatusBadge, Badge } from "@/components/ui";
import { recordPlatformPaymentAction, setWorkspaceSuspendedAction, updateSubscriptionAction } from "../../actions";

export default async function AdminAccount({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await db.workspace.findUnique({
    where: { id },
    include: { subscription: { include: { plan: true } }, memberships: { include: { user: true } }, platformPayments: { orderBy: { paidAt: "desc" }, take: 20 } },
  });
  if (!w) notFound();
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  const usage = await Promise.all((["clients", "projects", "members", "storageMb", "aiCredits"] as (keyof PlanLimits)[]).map(async (k) => ({ k, ...(await checkLimit(w.id, k)) })));
  const audit = await db.auditLog.findMany({ where: { workspaceId: w.id }, orderBy: { createdAt: "desc" }, take: 15 });
  const sub = w.subscription;
  return (
    <>
      <Link href="/admin/cuentas" className="text-[13px] text-muted hover:text-ink">
        ← Cuentas
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[30px] tracking-[-0.03em]">{w.name}</h1>
        <Badge>{w.type === "COMPANY" ? "Empresa" : "Independiente"}</Badge>
        {w.isSuspended && <Badge tone="danger">Suspendida</Badge>}
        <span className="ml-auto">
          <ActionButton action={setWorkspaceSuspendedAction} fields={{ id: w.id, suspended: w.isSuspended ? "0" : "1" }} variant={w.isSuspended ? "accent" : "danger"} confirm={w.isSuspended ? undefined : "¿Suspender la cuenta? Su equipo no podrá acceder."}>
            {w.isSuspended ? "Reactivar" : "Suspender"}
          </ActionButton>
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader title="Suscripción" action={sub && <StatusBadge status={sub.status} />} />
          {sub && (
            <ActionForm action={updateSubscriptionAction} className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="workspaceId" value={w.id} />
              <Field label="Plan" htmlFor="planId">
                <Select id="planId" name="planId" defaultValue={sub.planId}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.accountType === "COMPANY" ? "empresa" : "independiente"})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado" htmlFor="status">
                <Select id="status" name="status" defaultValue={sub.status}>
                  <option value="TRIALING">Prueba</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="PAST_DUE">Impago</option>
                  <option value="CANCELED">Cancelada</option>
                </Select>
              </Field>
              <Field label="Fin de la prueba" htmlFor="trialEndsAt">
                <Input id="trialEndsAt" name="trialEndsAt" type="date" defaultValue={inputDate(sub.trialEndsAt)} />
              </Field>
              <Field label="Fin del periodo pagado" htmlFor="currentPeriodEnd">
                <Input id="currentPeriodEnd" name="currentPeriodEnd" type="date" defaultValue={inputDate(sub.currentPeriodEnd)} />
              </Field>
              <p className="sm:col-span-2 text-[12px] text-muted">{sub.stripeSubscriptionId ? `Stripe: ${sub.stripeSubscriptionId}` : "Sin suscripción en Stripe (gestión manual)."}</p>
              <SubmitButton className="sm:col-span-2 justify-self-start">Guardar</SubmitButton>
            </ActionForm>
          )}
        </Card>
        <Card>
          <CardHeader title="Consumo frente a límites" />
          <ul className="px-5 pb-5 grid gap-2 text-sm">
            {usage.map((u) => (
              <li key={u.k} className="flex justify-between">
                <span className="text-muted">{{ clients: "Clientes", projects: "Proyectos activos", members: "Miembros", storageMb: "Almacenamiento MB", aiCredits: "IA este mes" }[u.k]}</span>
                <span className={`tabular-nums ${u.limit > 0 && u.used >= u.limit ? "text-danger" : ""}`}>{u.limit < 0 ? `${u.used} · ilimitado` : `${u.used} / ${u.limit}`}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Equipo" />
          <ul className="pb-3">
            {w.memberships.map((m) => (
              <li key={m.id} className="flex justify-between px-5 py-1.5 text-sm">
                <span>
                  {m.user.name} <span className="text-muted">{m.user.email}</span>
                </span>
                <span className="text-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Pagos de la suscripción" />
          <ul className="pb-2">
            {w.platformPayments.length === 0 && <li className="px-5 pb-3 text-sm text-muted">Sin pagos.</li>}
            {w.platformPayments.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-1.5 text-sm">
                <span>
                  {date(p.paidAt)} · {p.provider}
                </span>
                <span className={p.status === "PAID" ? "" : "text-danger"}>{money(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
          <ActionForm action={recordPlatformPaymentAction} reset className="grid grid-cols-[1fr_90px_auto] gap-2 border-t border-line p-4">
            <input type="hidden" name="workspaceId" value={w.id} />
            <label htmlFor="amount" className="sr-only">
              Importe
            </label>
            <Input id="amount" name="amount" inputMode="decimal" placeholder="Importe manual" required />
            <label htmlFor="cur" className="sr-only">
              Moneda
            </label>
            <Input id="cur" name="currency" defaultValue={sub?.plan.currency ?? "USD"} />
            <SubmitButton variant="secondary">Registrar</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Registro de auditoría" />
          <ul className="pb-3">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-5 py-1.5 text-sm">
                <span className="font-mono text-[12px]">{a.action}</span>
                <span className="text-muted text-[12px]">{dateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
