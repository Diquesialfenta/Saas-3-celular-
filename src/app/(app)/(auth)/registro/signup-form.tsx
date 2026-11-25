"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, cx } from "@/components/ui";

type Plan = { code: string; name: string; accountType: "FREELANCER" | "COMPANY"; priceMonthly: number; currency: string; trialDays: number };
type Act = Parameters<typeof ActionForm>[0]["action"];

export function SignupForm({ action, plans, defaultType, defaultPlan, withUser = true }: { action: Act; plans: Plan[]; defaultType: "FREELANCER" | "COMPANY"; defaultPlan?: string; withUser?: boolean }) {
  const [type, setType] = useState(defaultType);
  const options = plans.filter((p) => p.accountType === type);
  const [plan, setPlan] = useState<string | undefined>(defaultPlan && options.some((p) => p.code === defaultPlan) ? defaultPlan : options[0]?.code);
  const fmt = (p: Plan) => new Intl.NumberFormat("es", { style: "currency", currency: p.currency, maximumFractionDigits: 0 }).format(p.priceMonthly / 100);
  return (
    <ActionForm action={action} className="grid gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1" role="radiogroup" aria-label="Tipo de cuenta">
        {(
          [
            ["FREELANCER", "Independiente"],
            ["COMPANY", "Empresa"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={type === value}
            onClick={() => {
              setType(value);
              setPlan(plans.find((p) => p.accountType === value)?.code);
            }}
            className={cx("press h-9 rounded-full text-sm font-medium transition-colors", type === value ? "bg-white shadow-card text-ink" : "text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="plan" value={plan ?? ""} />
      {options.length > 0 && (
        <div className="grid gap-2">
          {options.map((p) => (
            <label key={p.code} className={cx("flex cursor-pointer items-center justify-between rounded-[12px] border px-4 py-3 transition-colors", plan === p.code ? "border-ink" : "border-line-strong hover:bg-surface")}>
              <span className="flex items-center gap-3">
                <input type="radio" name="_plan" checked={plan === p.code} onChange={() => setPlan(p.code)} className="accent-ink" />
                <span className="text-sm font-medium">{p.name}</span>
              </span>
              <span className="text-sm text-muted tabular-nums">{p.priceMonthly === 0 ? "Gratis" : `${fmt(p)}/mes`}</span>
            </label>
          ))}
          <p className="text-[13px] text-muted">{options.find((p) => p.code === plan)?.trialDays ?? 14} días de prueba. Sin tarjeta para empezar.</p>
        </div>
      )}
      {withUser && (
        <>
          <Field label="Tu nombre" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
          <Field label="Correo" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Contraseña" htmlFor="password" hint="Al menos 8 caracteres.">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
        </>
      )}
      <Field label={type === "COMPANY" ? "Nombre de la empresa" : "Nombre de tu marca o negocio"} htmlFor="business">
        <Input id="business" name="business" autoComplete="organization" required />
      </Field>
      <SubmitButton size="lg" className="mt-2" pendingLabel="Creando tu cuenta">
        Empezar la prueba gratis
      </SubmitButton>
    </ActionForm>
  );
}
