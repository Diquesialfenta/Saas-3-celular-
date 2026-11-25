"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

type Line = { description: string; quantity: number; unitPrice: number };

export function LineItems({ initial, currency, initialTax = 0, initialDiscount = 0 }: { initial?: Line[]; currency: string; initialTax?: number; initialDiscount?: number }) {
  const [lines, setLines] = useState<Line[]>(initial?.length ? initial : [{ description: "", quantity: 1, unitPrice: 0 }]);
  const [tax, setTax] = useState(initialTax);
  const [discount, setDiscount] = useState(initialDiscount);
  const fmt = (c: number) => new Intl.NumberFormat("es", { style: "currency", currency }).format(c / 100);
  const subtotal = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const base = Math.max(0, subtotal - discount);
  const taxAmt = Math.round((base * tax) / 100);
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  return (
    <div className="grid gap-3">
      <input type="hidden" name="items" value={JSON.stringify(lines.filter((l) => l.description.trim()))} />
      <div className="hidden sm:grid grid-cols-[1fr_80px_120px_40px] gap-2 text-[12px] text-muted px-1">
        <span>Descripción</span>
        <span>Cantidad</span>
        <span>Precio</span>
        <span />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_80px_120px_40px] gap-2">
          <Input aria-label="Descripción" value={l.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Servicio o concepto" className="col-span-2 sm:col-span-1" />
          <Input aria-label="Cantidad" type="number" min={0.25} step={0.25} value={l.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) || 0 })} />
          <Input aria-label="Precio unitario" inputMode="decimal" defaultValue={l.unitPrice ? (l.unitPrice / 100).toFixed(2) : ""} onChange={(e) => set(i, { unitPrice: Math.round((Number(e.target.value.replace(",", ".")) || 0) * 100) })} placeholder="0,00" />
          <button type="button" aria-label="Quitar línea" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : ls))} className="press grid size-10 place-items-center rounded-[10px] text-muted hover:bg-surface hover:text-ink">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0 }])}>
        <Plus className="size-3.5" /> Añadir línea
      </Button>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:ml-auto">
        <Field label="Impuesto %" htmlFor="taxRate">
          <Input id="taxRate" name="taxRate" type="number" min={0} max={100} step={0.01} value={tax} onChange={(e) => setTax(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Descuento" htmlFor="discount">
          <Input id="discount" name="discount" inputMode="decimal" defaultValue={discount ? (discount / 100).toFixed(2) : ""} onChange={(e) => setDiscount(Math.round((Number(e.target.value.replace(",", ".")) || 0) * 100))} />
        </Field>
      </div>
      <dl className="sm:max-w-sm sm:ml-auto w-full grid gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{fmt(subtotal)}</dd>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Descuento</dt>
            <dd className="tabular-nums">− {fmt(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted">Impuesto</dt>
          <dd className="tabular-nums">{fmt(taxAmt)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 mt-1">
          <dt className="font-medium">Total</dt>
          <dd className="font-display text-xl tabular-nums">{fmt(base + taxAmt)}</dd>
        </div>
      </dl>
    </div>
  );
}
