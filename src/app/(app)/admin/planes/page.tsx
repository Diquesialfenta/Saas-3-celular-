import type { Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { savePlanAction } from "../actions";

export const metadata = { title: "Planes y precios" };

export default async function AdminPlans() {
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: true } } } });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[30px] tracking-[-0.03em]">Planes y precios</h1>
          <p className="text-muted">Precios, beneficios y límites de cada tipo de cuenta. Los cambios se aplican al instante.</p>
        </div>
        <Modal trigger="Crear plan" title="Nuevo plan" wide>
          <PlanForm />
        </Modal>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => {
          const l = p.limits as Record<string, number>;
          return (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-xl">{p.name}</p>
                <Badge>{p.accountType === "COMPANY" ? "Empresa" : "Independiente"}</Badge>
                {!p.isActive && <Badge tone="danger">Inactivo</Badge>}
                {!p.isPublic && <Badge tone="warn">Oculto</Badge>}
                <span className="ml-auto text-[13px] text-muted">{p._count.subscriptions} cuentas</span>
              </div>
              <p className="mt-2 font-display text-2xl tabular-nums">
                {money(p.priceMonthly, p.currency)} <span className="text-sm text-muted">/ mes · {money(p.priceYearly, p.currency)} / año</span>
              </p>
              <p className="text-[13px] text-muted mt-2">
                Clientes {l.clients < 0 ? "∞" : l.clients} · Proyectos {l.projects < 0 ? "∞" : l.projects} · Miembros {l.members < 0 ? "∞" : l.members} · {l.storageMb < 0 ? "∞" : `${Math.round(l.storageMb / 1024)} GB`} · IA {l.aiCredits < 0 ? "∞" : l.aiCredits}/mes · {p.trialDays} días de prueba
              </p>
              <Modal trigger="Editar" triggerVariant="secondary" triggerSize="sm" triggerClassName="mt-3" title={p.name} wide>
                <PlanForm p={p} />
              </Modal>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function PlanForm({ p }: { p?: Plan }) {
  const l = (p?.limits ?? {}) as Record<string, number>;
  const lim = (k: string) => (l[k] === undefined || l[k] < 0 ? "" : String(l[k]));
  return (
    <ActionForm action={savePlanAction} className="grid gap-4 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" defaultValue={p?.name} required />
      </Field>
      <Field label="Código" htmlFor="code">
        <Input id="code" name="code" defaultValue={p?.code} required />
      </Field>
      <Field label="Tipo de cuenta" htmlFor="accountType">
        <Select id="accountType" name="accountType" defaultValue={p?.accountType ?? "FREELANCER"}>
          <option value="FREELANCER">Independiente</option>
          <option value="COMPANY">Empresa</option>
        </Select>
      </Field>
      <Field label="Moneda" htmlFor="currency">
        <Input id="currency" name="currency" defaultValue={p?.currency ?? "USD"} />
      </Field>
      <Field label="Precio mensual" htmlFor="priceMonthly">
        <Input id="priceMonthly" name="priceMonthly" inputMode="decimal" defaultValue={p ? (p.priceMonthly / 100).toFixed(2) : ""} required />
      </Field>
      <Field label="Precio anual" htmlFor="priceYearly">
        <Input id="priceYearly" name="priceYearly" inputMode="decimal" defaultValue={p ? (p.priceYearly / 100).toFixed(2) : ""} required />
      </Field>
      <Field label="Descripción" htmlFor="description" className="sm:col-span-2">
        <Input id="description" name="description" defaultValue={p?.description} required />
      </Field>
      <Field label="Beneficios (uno por línea)" htmlFor="features" className="sm:col-span-2">
        <Textarea id="features" name="features" defaultValue={p?.features.join("\n")} />
      </Field>
      <fieldset className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <legend className="text-[13px] font-medium text-ink-2 mb-2">Límites (vacío = ilimitado)</legend>
        {[
          ["clients", "Clientes"],
          ["projects", "Proyectos"],
          ["members", "Miembros"],
          ["storageMb", "MB"],
          ["aiCredits", "IA / mes"],
        ].map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`l-${k}`}>
            <Input id={`l-${k}`} name={k} type="number" min={0} defaultValue={lim(k)} />
          </Field>
        ))}
      </fieldset>
      <Field label="Días de prueba" htmlFor="trialDays">
        <Input id="trialDays" name="trialDays" type="number" min={0} defaultValue={p?.trialDays ?? 14} />
      </Field>
      <Field label="Orden" htmlFor="sortOrder">
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
      </Field>
      <Field label="Precio de Stripe mensual (price_…)" htmlFor="spm">
        <Input id="spm" name="stripePriceMonthly" defaultValue={p?.stripePriceMonthly ?? ""} />
      </Field>
      <Field label="Precio de Stripe anual (price_…)" htmlFor="spy">
        <Input id="spy" name="stripePriceYearly" defaultValue={p?.stripePriceYearly ?? ""} />
      </Field>
      <Checkbox name="isActive" defaultChecked={p?.isActive ?? true} label="Activo" />
      <Checkbox name="isPublic" defaultChecked={p?.isPublic ?? true} label="Visible en la web y el registro" />
      <SubmitButton className="sm:col-span-2 justify-self-start">Guardar plan</SubmitButton>
    </ActionForm>
  );
}
