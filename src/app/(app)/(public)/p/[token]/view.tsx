"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Textarea, cx } from "@/components/ui";

type Item = { id: string; name: string; description: string | null; quantity: number; unitPrice: number; recurring: string; isOptional: boolean; isSelected: boolean };
type Act = Parameters<typeof ActionForm>[0]["action"];

export function ProposalView(p: {
  token: string;
  brandColor: string;
  currency: string;
  taxRate: number;
  discount: number;
  depositPercent: number;
  installments: number;
  status: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  items: Item[];
  accept: Act;
  decline: Act;
  defaultEmail: string;
}) {
  const [selected, setSelected] = useState(() => new Set(p.items.filter((i) => i.isOptional && i.isSelected).map((i) => i.id)));
  const [mode, setMode] = useState<"idle" | "accept" | "decline" | "done">(p.status === "ACCEPTED" || p.status === "DECLINED" ? "done" : "idle");
  const [result, setResult] = useState<"ACCEPTED" | "DECLINED" | null>(p.status === "ACCEPTED" || p.status === "DECLINED" ? (p.status as "ACCEPTED" | "DECLINED") : null);
  const fmt = (c: number) => new Intl.NumberFormat("es", { style: "currency", currency: p.currency }).format(c / 100);
  const included = p.items.filter((i) => !i.isOptional || selected.has(i.id));
  const subtotal = Math.round(included.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const base = Math.max(0, subtotal - p.discount);
  const tax = Math.round((base * p.taxRate) / 100);
  const total = base + tax;
  const recurring = included.filter((i) => i.recurring !== "NONE");
  const final = result ?? (p.status === "ACCEPTED" || p.status === "DECLINED" ? p.status : null);
  const open = p.status === "SENT" || p.status === "VIEWED";
  const per = (r: string) => (r === "MONTHLY" ? "/mes" : r === "YEARLY" ? "/año" : "");

  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-[22px] tracking-[-0.02em]">Inversión</h2>
      <Card className="mt-5 overflow-hidden">
        <ul>
          {p.items.map((i) => {
            const on = !i.isOptional || selected.has(i.id);
            return (
              <li key={i.id} className={cx("flex items-start gap-4 px-5 py-4 border-b border-line last:border-0 transition-colors", i.isOptional && !on && "bg-surface/60")}>
                {i.isOptional ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Incluir ${i.name}`}
                    disabled={!open}
                    onClick={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(i.id)) n.delete(i.id);
                        else n.add(i.id);
                        return n;
                      })
                    }
                    className={cx("press mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors", on ? "bg-ink border-ink text-white" : "border-line-strong bg-white")}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </button>
                ) : (
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.name}
                    {i.isOptional && <span className="ml-2 text-[12px] font-normal text-muted">Opcional</span>}
                  </p>
                  {i.description && <p className="text-sm text-muted mt-0.5">{i.description}</p>}
                  {i.quantity !== 1 && <p className="text-[13px] text-muted mt-0.5">{i.quantity} × {fmt(i.unitPrice)}</p>}
                </div>
                <p className={cx("tabular-nums whitespace-nowrap", !on && "text-faint line-through")}>
                  {fmt(Math.round(i.quantity * i.unitPrice))}
                  <span className="text-muted text-[13px]">{per(i.recurring)}</span>
                </p>
              </li>
            );
          })}
        </ul>
        <dl className="grid gap-1.5 bg-surface px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{fmt(subtotal)}</dd>
          </div>
          {p.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Descuento</dt>
              <dd className="tabular-nums">− {fmt(p.discount)}</dd>
            </div>
          )}
          {p.taxRate > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Impuestos ({p.taxRate} %)</dt>
              <dd className="tabular-nums">{fmt(tax)}</dd>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-display text-2xl tabular-nums tracking-[-0.02em]">{fmt(total)}</dd>
          </div>
        </dl>
      </Card>
      <ul className="mt-4 grid gap-1 text-sm text-muted">
        {p.depositPercent > 0 && <li>Anticipo del {p.depositPercent} % ({fmt(Math.round((total * p.depositPercent) / 100))}) al aceptar.</li>}
        {p.installments > 1 && <li>El resto en {p.installments} pagos mensuales.</li>}
        {recurring.length > 0 && <li>Los conceptos periódicos se facturan automáticamente cada periodo.</li>}
      </ul>

      <div className="mt-8">
        {final || mode === "done" ? (
          <Card className={cx("p-6", final === "ACCEPTED" ? "bg-ok-bg border-ok/20" : "")}>
            {final === "ACCEPTED" ? (
              <p className="text-ok font-medium">
                Propuesta aceptada{p.acceptedBy ? ` por ${p.acceptedBy}` : ""}
                {p.acceptedAt ? ` el ${new Date(p.acceptedAt).toLocaleDateString("es", { dateStyle: "long" })}` : ""}. Recibirás el contrato y los siguientes pasos por correo.
              </p>
            ) : (
              <p className="text-muted">Has respondido a esta propuesta. Gracias.</p>
            )}
          </Card>
        ) : !open ? (
          <Card className="p-6 text-muted">Esta propuesta ha caducado. Escribe al proveedor para que te envíe una nueva.</Card>
        ) : mode === "idle" ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => setMode("accept")} className="press h-12 rounded-full px-6 font-medium text-white" style={{ background: p.brandColor }}>
              Aceptar la propuesta · {fmt(total)}
            </button>
            <button type="button" onClick={() => setMode("decline")} className="press h-12 rounded-full px-6 font-medium border border-line-strong bg-white hover:bg-surface">
              Rechazar
            </button>
          </div>
        ) : mode === "accept" ? (
          <Card className="pop p-6">
            <h3 className="text-lg">Aceptar la propuesta</h3>
            <ActionForm
              action={p.accept}
              className="mt-4 grid gap-4"
              onDone={() => {
                setResult("ACCEPTED");
                setMode("done");
              }}
            >
              <input type="hidden" name="token" value={p.token} />
              {[...selected].map((id) => (
                <input key={id} type="hidden" name="optional" value={id} />
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre completo" htmlFor="name">
                  <Input id="name" name="name" autoComplete="name" required />
                </Field>
                <Field label="Correo" htmlFor="email">
                  <Input id="email" name="email" type="email" autoComplete="email" defaultValue={p.defaultEmail} required />
                </Field>
              </div>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" name="agree" required className="mt-0.5 accent-ink" />
                <span>Acepto esta propuesta por {fmt(total)} y autorizo a continuar con el contrato y la facturación indicada.</span>
              </label>
              <div className="flex gap-2">
                <SubmitButton size="lg" style={{ background: p.brandColor, borderColor: p.brandColor }}>
                  Confirmar aceptación
                </SubmitButton>
                <button type="button" onClick={() => setMode("idle")} className="press h-12 px-4 rounded-full text-sm text-muted hover:text-ink">
                  Volver
                </button>
              </div>
            </ActionForm>
          </Card>
        ) : (
          <Card className="pop p-6">
            <h3 className="text-lg">¿Qué no encaja?</h3>
            <ActionForm
              action={p.decline}
              className="mt-4 grid gap-4"
              onDone={() => {
                setResult("DECLINED");
                setMode("done");
              }}
            >
              <input type="hidden" name="token" value={p.token} />
              <Field label="Motivo (opcional)" htmlFor="reason">
                <Textarea id="reason" name="reason" placeholder="Precio, plazos, alcance…" />
              </Field>
              <div className="flex gap-2">
                <SubmitButton variant="danger">Rechazar la propuesta</SubmitButton>
                <button type="button" onClick={() => setMode("idle")} className="press h-10 px-4 rounded-full text-sm text-muted hover:text-ink">
                  Volver
                </button>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </section>
  );
}
