"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { Spinner } from "@/components/forms";

type Item = { name: string; description: string | null; quantity: number; unitPrice: number; recurring: "NONE" | "MONTHLY" | "YEARLY"; isOptional: boolean; isSelected: boolean };
type Section = { id: string; title: string; body: string };
export type ProposalDraft = {
  id: string;
  title: string;
  summary: string | null;
  sections: Section[];
  items: Item[];
  taxRate: number;
  discount: number;
  depositPercent: number;
  installments: number;
  validUntil: string | null;
  currency: string;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Act = (prev: any, fd: FormData) => Promise<{ ok?: boolean; error?: string; message?: string } | null>;
type AiDraft = (id: string, brief: string) => Promise<{ error?: string; summary?: string; sections?: { title: string; body: string }[]; items?: { name: string; description: string; quantity: number }[] }>;

const uid = () => Math.random().toString(36).slice(2, 9);

export function ProposalEditor({ initial, save, draftAI, aiEnabled, locked }: { initial: ProposalDraft; save: Act; draftAI: AiDraft; aiEnabled: boolean; locked: boolean }) {
  const [d, setD] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [brief, setBrief] = useState("");
  const fmt = (c: number) => new Intl.NumberFormat("es", { style: "currency", currency: d.currency }).format(c / 100);
  const update = (patch: Partial<ProposalDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setItem = (i: number, patch: Partial<Item>) => update({ items: d.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const setSection = (i: number, patch: Partial<Section>) => update({ sections: d.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const n = [...arr];
    const j = i + dir;
    if (j < 0 || j >= n.length) return n;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  };

  const included = d.items.filter((i) => !i.isOptional || i.isSelected);
  const subtotal = Math.round(included.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const base = Math.max(0, subtotal - d.discount);
  const tax = Math.round((base * d.taxRate) / 100);
  const total = base + tax;
  const oneOff = Math.round(included.filter((i) => i.recurring === "NONE").reduce((s, i) => s + i.quantity * i.unitPrice, 0));

  const doSave = () =>
    startSave(async () => {
      const fd = new FormData();
      fd.set("id", d.id);
      fd.set("payload", JSON.stringify({ ...d, currency: undefined, id: undefined }));
      const r = await save(null, fd);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Propuesta guardada");
        setDirty(false);
      }
    });

  const doDraft = () =>
    startDraft(async () => {
      const r = await draftAI(d.id, brief);
      if (r.error) return void toast.error(r.error);
      update({
        summary: r.summary ?? d.summary,
        sections: r.sections?.length ? r.sections.map((s) => ({ id: uid(), title: s.title, body: s.body })) : d.sections,
        items: d.items.length
          ? d.items
          : (r.items ?? []).map((it) => ({ name: it.name, description: it.description, quantity: it.quantity || 1, unitPrice: 0, recurring: "NONE" as const, isOptional: false, isSelected: true })),
      });
      toast.success("Borrador generado. Revisa el texto y pon los precios.");
    });

  return (
    <fieldset disabled={locked} className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
      <div className="grid gap-4 min-w-0">
        {aiEnabled && !locked && (
          <Card className="p-5 bg-gradient-to-br from-white to-accent/15">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4" /> Redactar con IA
            </p>
            <p className="text-[13px] text-muted mt-1">Describe qué necesita el cliente. La IA escribe el resumen, las secciones y los conceptos; tú pones los precios.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label htmlFor="brief" className="sr-only">
                Brief para la IA
              </label>
              <Textarea id="brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ej.: tienda online para una marca de cosmética, 40 productos, pasarela de pago y formación al equipo" className="min-h-16" />
              <Button type="button" onClick={doDraft} disabled={!brief.trim() || drafting} className="self-end">
                {drafting && <Spinner />} {drafting ? "Redactando" : "Generar borrador"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-5 grid gap-4">
          <Field label="Título" htmlFor="p-title">
            <Input id="p-title" value={d.title} onChange={(e) => update({ title: e.target.value })} className="text-lg h-11 font-display" />
          </Field>
          <Field label="Resumen ejecutivo" htmlFor="p-summary">
            <Textarea id="p-summary" value={d.summary ?? ""} onChange={(e) => update({ summary: e.target.value })} />
          </Field>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-medium font-sans tracking-normal">Secciones</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => update({ sections: [...d.sections, { id: uid(), title: "Nueva sección", body: "" }] })}>
              <Plus className="size-3.5" /> Añadir sección
            </Button>
          </div>
          <div className="grid gap-3">
            {d.sections.length === 0 && <p className="text-sm text-muted">Sin secciones. Añade contexto, alcance, entregables o condiciones.</p>}
            {d.sections.map((s, i) => (
              <div key={s.id} className="rounded-[12px] border border-line p-3 grid gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor={`s-${s.id}`} className="sr-only">
                    Título de la sección
                  </label>
                  <Input id={`s-${s.id}`} value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} className="font-medium" />
                  <IconBtn label="Subir" onClick={() => update({ sections: move(d.sections, i, -1) })}>
                    <ArrowUp className="size-3.5" />
                  </IconBtn>
                  <IconBtn label="Bajar" onClick={() => update({ sections: move(d.sections, i, 1) })}>
                    <ArrowDown className="size-3.5" />
                  </IconBtn>
                  <IconBtn label="Eliminar sección" onClick={() => update({ sections: d.sections.filter((_, k) => k !== i) })}>
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
                <label htmlFor={`sb-${s.id}`} className="sr-only">
                  Contenido
                </label>
                <Textarea id={`sb-${s.id}`} value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} className="min-h-28" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-medium font-sans tracking-normal">Conceptos y precios</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => update({ items: [...d.items, { name: "", description: null, quantity: 1, unitPrice: 0, recurring: "NONE", isOptional: false, isSelected: true }] })}
            >
              <Plus className="size-3.5" /> Añadir concepto
            </Button>
          </div>
          <div className="grid gap-3">
            {d.items.length === 0 && <p className="text-sm text-muted">Añade los servicios con su precio. Marca como opcionales los que el cliente pueda añadir.</p>}
            {d.items.map((it, i) => (
              <div key={i} className={cx("rounded-[12px] border p-3 grid gap-2", it.isOptional ? "border-dashed border-line-strong" : "border-line")}>
                <div className="grid gap-2 sm:grid-cols-[1fr_80px_120px_auto]">
                  <Input aria-label="Concepto" placeholder="Concepto" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                  <Input aria-label="Cantidad" type="number" min={0.25} step={0.25} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) || 0 })} />
                  <Input
                    aria-label="Precio unitario"
                    inputMode="decimal"
                    defaultValue={(it.unitPrice / 100).toFixed(2)}
                    onBlur={(e) => setItem(i, { unitPrice: Math.round((Number(e.target.value.replace(",", ".")) || 0) * 100) })}
                  />
                  <div className="flex gap-1">
                    <IconBtn label="Subir" onClick={() => update({ items: move(d.items, i, -1) })}>
                      <ArrowUp className="size-3.5" />
                    </IconBtn>
                    <IconBtn label="Eliminar concepto" onClick={() => update({ items: d.items.filter((_, k) => k !== i) })}>
                      <Trash2 className="size-3.5" />
                    </IconBtn>
                  </div>
                </div>
                <Input aria-label="Descripción" placeholder="Descripción (opcional)" value={it.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value || null })} className="text-sm" />
                <div className="flex flex-wrap items-center gap-4 text-[13px]">
                  <label className="flex items-center gap-2">
                    Facturación
                    <select value={it.recurring} onChange={(e) => setItem(i, { recurring: e.target.value as Item["recurring"] })} className="rounded-[8px] border border-line bg-white h-8 px-2">
                      <option value="NONE">Pago único</option>
                      <option value="MONTHLY">Mensual</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-ink" checked={it.isOptional} onChange={(e) => setItem(i, { isOptional: e.target.checked, isSelected: !e.target.checked })} />
                    Opcional para el cliente
                  </label>
                  <span className="ml-auto font-medium tabular-nums">{fmt(Math.round(it.quantity * it.unitPrice))}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-20">
        <Card className="p-5 grid gap-3">
          <h2 className="text-[15px] font-medium font-sans tracking-normal">Condiciones</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Impuesto %" htmlFor="tax">
              <Input id="tax" type="number" min={0} max={100} step={0.01} value={d.taxRate} onChange={(e) => update({ taxRate: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Descuento" htmlFor="disc">
              <Input id="disc" inputMode="decimal" defaultValue={(d.discount / 100).toFixed(2)} onBlur={(e) => update({ discount: Math.round((Number(e.target.value.replace(",", ".")) || 0) * 100) })} />
            </Field>
            <Field label="Anticipo %" htmlFor="dep">
              <Input id="dep" type="number" min={0} max={100} value={d.depositPercent} onChange={(e) => update({ depositPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
            </Field>
            <Field label="Plazos del resto" htmlFor="inst">
              <Select id="inst" value={d.installments} onChange={(e) => update({ installments: Number(e.target.value) })}>
                {[1, 2, 3, 4, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Un pago" : `${n} pagos mensuales`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Válida hasta" htmlFor="valid">
            <Input id="valid" type="date" value={d.validUntil ?? ""} onChange={(e) => update({ validUntil: e.target.value || null })} />
          </Field>
        </Card>
        <Card className="p-5">
          <dl className="grid gap-2 text-sm">
            <Row label="Subtotal" value={fmt(subtotal)} />
            {d.discount > 0 && <Row label="Descuento" value={`− ${fmt(d.discount)}`} />}
            <Row label={`Impuesto (${d.taxRate} %)`} value={fmt(tax)} />
            <div className="h-px bg-line my-1" />
            <Row label="Total" value={<span className="font-display text-xl">{fmt(total)}</span>} />
            {d.depositPercent > 0 && oneOff > 0 && <Row label={`Anticipo ${d.depositPercent} %`} value={fmt(Math.round((total * d.depositPercent) / 100))} muted />}
          </dl>
          {!locked && (
            <Button type="button" onClick={doSave} disabled={saving || !dirty} className="w-full mt-4">
              {saving && <Spinner />}
              {saving ? "Guardando" : dirty ? "Guardar cambios" : "Guardado"}
            </Button>
          )}
        </Card>
      </div>
    </fieldset>
  );
}

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", muted && "text-muted")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="press grid size-10 shrink-0 place-items-center rounded-[10px] border border-line text-muted hover:text-ink hover:bg-surface">
      {children}
    </button>
  );
}
