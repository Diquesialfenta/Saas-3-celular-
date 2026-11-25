import { stringList } from "@/lib/string-list";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, money } from "@/lib/format";
import { checkLimit, type PlanLimits } from "@/lib/services/workspace";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Input, Notice, PageHeader, Progress, Select, StatusBadge, Tabs } from "@/components/ui";
import { changePlanAction, upgradeToCompanyAction } from "../actions";

export const metadata = { title: "Plan y suscripción" };

const LIMIT_LABEL: Record<keyof PlanLimits, string> = { clients: "Clientes", projects: "Proyectos activos", members: "Miembros del equipo", storageMb: "Almacenamiento (MB)", aiCredits: "Usos de IA este mes" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const ctx = await requireWorkspace("settings.manage");
  const { pago } = await searchParams;
  const sub = ctx.subscription;
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } });
  const usage = await Promise.all((Object.keys(LIMIT_LABEL) as (keyof PlanLimits)[]).map(async (k) => ({ key: k, ...(await checkLimit(ctx.workspaceId, k)) })));
  const sameType = plans.filter((p) => p.accountType === ctx.workspace.type);
  const companyPlans = plans.filter((p) => p.accountType === "COMPANY");
  const isOwner = ctx.membership.role === "OWNER";

  return (
    <>
      <PageHeader title="Configuración" description={ctx.workspace.name} />
      <Tabs
        current="/app/configuracion/plan"
        items={[
          { href: "/app/configuracion", label: "General" },
          { href: "/app/configuracion?vista=marca", label: "Marca y portal" },
          { href: "/app/configuracion?vista=facturacion", label: "Facturación y servicios" },
          { href: "/app/configuracion/plan", label: "Plan y suscripción" },
          { href: "/app/configuracion?vista=perfil", label: "Mi perfil" },
        ]}
      />
      {pago === "ok" && (
        <div className="mb-4">
          <Notice tone="ok">Pago recibido. Tu suscripción se actualizará en unos segundos.</Notice>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        <Card>
          <CardHeader
            title={`Plan ${sub?.plan.name ?? "—"}`}
            description={sub ? `${money(sub.interval === "YEAR" ? sub.plan.priceYearly : sub.plan.priceMonthly, sub.plan.currency)} / ${sub.interval === "YEAR" ? "año" : "mes"}` : undefined}
            action={sub && <StatusBadge status={sub.status} />}
          />
          <div className="px-5 pb-5 grid gap-4">
            {sub?.status === "TRIALING" && sub.trialEndsAt && <p className="text-sm text-muted">Tu prueba termina el {date(sub.trialEndsAt, { dateStyle: "long" })}.</p>}
            {sub?.currentPeriodEnd && <p className="text-sm text-muted">Próxima renovación: {date(sub.currentPeriodEnd, { dateStyle: "long" })}.</p>}
            <ul className="grid gap-3">
              {usage.map((u) => (
                <li key={u.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{LIMIT_LABEL[u.key]}</span>
                    <span className="text-muted tabular-nums">{u.limit < 0 ? "Ilimitado" : `${u.used} de ${u.limit}`}</span>
                  </div>
                  {u.limit > 0 && <Progress value={(u.used / u.limit) * 100} />}
                </li>
              ))}
            </ul>
          </div>
        </Card>
        {ctx.workspace.type === "FREELANCER" && companyPlans.length > 0 && (
          <Card className="p-5 bg-ink text-white border-ink">
            <p className="text-[13px] text-white/60">Crece con tu equipo</p>
            <p className="font-display text-xl mt-1">Pasa a cuenta de empresa</p>
            <p className="text-sm text-white/70 mt-2">Equipos, departamentos, roles, carga de trabajo y analítica avanzada. Conservas todos tus clientes, proyectos, documentos y configuraciones.</p>
            {isOwner ? (
              <Modal trigger="Cambiar a empresa" triggerVariant="accent" triggerClassName="mt-4" title="Pasar a cuenta de empresa">
                <ActionForm action={upgradeToCompanyAction} className="grid gap-4">
                  <Field label="Plan de empresa" htmlFor="planId">
                    <Select id="planId" name="planId">
                      {companyPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {money(p.priceMonthly, p.currency)}/mes
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="text-sm text-muted">Empiezas con {companyPlans[0].trialDays} días de prueba del plan de empresa. Nada se borra ni se mueve.</p>
                  <SubmitButton>Confirmar el cambio</SubmitButton>
                </ActionForm>
              </Modal>
            ) : (
              <p className="mt-3 text-[13px] text-white/60">Solo el propietario de la cuenta puede hacer el cambio.</p>
            )}
          </Card>
        )}
      </div>

      <h2 className="text-xl mt-10 mb-4">Planes para {ctx.workspace.type === "COMPANY" ? "empresas" : "independientes"}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {sameType.map((p) => {
          const currentPlan = sub?.planId === p.id;
          return (
            <Card key={p.id} className={`p-6 flex flex-col ${currentPlan ? "border-ink" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="font-display text-xl">{p.name}</p>
                {currentPlan && <Badge tone="accent">Tu plan</Badge>}
              </div>
              <p className="text-sm text-muted mt-1">{p.description}</p>
              <p className="mt-4 font-display text-3xl tabular-nums">
                {money(p.priceMonthly, p.currency)}
                <span className="text-sm text-muted"> / mes</span>
              </p>
              <p className="text-[13px] text-muted">o {money(p.priceYearly, p.currency)} al año</p>
              <ul className="mt-4 grid gap-1.5 text-sm flex-1">
                {stringList(p.features).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 mt-0.5 text-ok" /> {f}
                  </li>
                ))}
              </ul>
              {!currentPlan && isOwner && (
                <Modal trigger="Elegir este plan" triggerVariant="secondary" triggerClassName="mt-5" title={`Plan ${p.name}`}>
                  <ActionForm action={changePlanAction} className="grid gap-4">
                    <input type="hidden" name="planId" value={p.id} />
                    <Field label="Facturación" htmlFor={`int-${p.id}`}>
                      <Select id={`int-${p.id}`} name="interval">
                        <option value="MONTH">Mensual · {money(p.priceMonthly, p.currency)}</option>
                        <option value="YEAR">Anual · {money(p.priceYearly, p.currency)}</option>
                      </Select>
                    </Field>
                    <Field label="Cupón (opcional)" htmlFor={`cp-${p.id}`}>
                      <Input id={`cp-${p.id}`} name="coupon" />
                    </Field>
                    <SubmitButton pendingLabel="Preparando el pago">Continuar</SubmitButton>
                  </ActionForm>
                </Modal>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
