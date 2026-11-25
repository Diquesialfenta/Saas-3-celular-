"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

type F = { id: string; type: string; label: string; help?: string; required?: boolean; options?: string[] };
type Act = Parameters<typeof ActionForm>[0]["action"];

const TYPES = [
  ["text", "Texto corto"],
  ["textarea", "Texto largo"],
  ["email", "Correo"],
  ["tel", "Teléfono"],
  ["url", "Enlace web"],
  ["number", "Número"],
  ["date", "Fecha"],
  ["select", "Opción única"],
  ["checkbox", "Varias opciones"],
] as const;

const uid = () => `q${Math.random().toString(36).slice(2, 8)}`;

export function FormBuilder({ action, initial }: { action: Act; initial?: { id: string; name: string; description: string | null; fields: F[] } }) {
  const [fields, setFields] = useState<F[]>(initial?.fields ?? [{ id: uid(), type: "text", label: "", required: true }]);
  const set = (i: number, p: Partial<F>) => setFields((f) => f.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setFields((f) => {
      const n = [...f];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <ActionForm action={action} className="grid gap-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <Card className="p-5 grid gap-4">
        <Field label="Nombre del formulario" htmlFor="f-name">
          <Input id="f-name" name="name" defaultValue={initial?.name} required />
        </Field>
        <Field label="Introducción para el cliente" htmlFor="f-desc">
          <Textarea id="f-desc" name="description" defaultValue={initial?.description ?? ""} />
        </Field>
      </Card>
      {fields.map((f, i) => (
        <Card key={f.id} className="p-5 grid gap-3">
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
            <Field label={`Pregunta ${i + 1}`} htmlFor={`l-${f.id}`}>
              <Input id={`l-${f.id}`} value={f.label} onChange={(e) => set(i, { label: e.target.value })} />
            </Field>
            <Field label="Tipo" htmlFor={`t-${f.id}`}>
              <Select id={`t-${f.id}`} value={f.type} onChange={(e) => set(i, { type: e.target.value })}>
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-1">
              <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="press grid size-10 place-items-center rounded-[10px] text-muted hover:bg-surface">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label="Bajar" onClick={() => move(i, 1)} className="press grid size-10 place-items-center rounded-[10px] text-muted hover:bg-surface">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" aria-label="Eliminar pregunta" onClick={() => setFields((x) => x.filter((_, k) => k !== i))} className="press grid size-10 place-items-center rounded-[10px] text-muted hover:bg-surface">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <Field label="Ayuda (opcional)" htmlFor={`h-${f.id}`}>
            <Input id={`h-${f.id}`} value={f.help ?? ""} onChange={(e) => set(i, { help: e.target.value })} />
          </Field>
          {(f.type === "select" || f.type === "checkbox") && (
            <Field label="Opciones (una por línea)" htmlFor={`o-${f.id}`}>
              <Textarea id={`o-${f.id}`} value={(f.options ?? []).join("\n")} onChange={(e) => set(i, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
            </Field>
          )}
          <Checkbox checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked })} label="Obligatoria" />
        </Card>
      ))}
      <Button type="button" variant="secondary" className="justify-self-center" onClick={() => setFields((f) => [...f, { id: uid(), type: "text", label: "" }])}>
        <Plus className="size-4" /> Añadir pregunta
      </Button>
      <div className="flex justify-end">
        <SubmitButton>Guardar formulario</SubmitButton>
      </div>
    </ActionForm>
  );
}
