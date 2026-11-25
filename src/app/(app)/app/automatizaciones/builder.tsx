"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowDown } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Card, Field, Input, Select, Textarea, Checkbox } from "@/components/ui";

type Opt = { value: string; label: string };
type ActionDef = { type: string; config: Record<string, string | boolean | number | null | undefined> };
type Act = Parameters<typeof ActionForm>[0]["action"];

const FIELD_LABEL: Record<string, string> = {
  subject: "Asunto",
  body: "Mensaje",
  title: "Título",
  templateId: "Plantilla",
  autoSend: "Enviar automáticamente",
  dueInDays: "Vence en (días)",
  formId: "Formulario",
  surveyId: "Encuesta",
  status: "Estado",
  source: "Origen",
};

export function AutomationBuilder({
  action,
  triggers,
  actions,
  templates,
  forms,
  surveys,
  initial,
}: {
  action: Act;
  triggers: Opt[];
  actions: { value: string; label: string; fields: string[] }[];
  templates: { id: string; name: string; type: string }[];
  forms: Opt[];
  surveys: Opt[];
  initial?: { id: string; name: string; trigger: string; actions: ActionDef[]; conditions: { minAmount?: number; clientTag?: string } };
}) {
  const [steps, setSteps] = useState<ActionDef[]>(initial?.actions ?? [{ type: "notify_team", config: { title: "" } }]);
  const set = (i: number, patch: Partial<ActionDef>) => setSteps((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setCfg = (i: number, key: string, v: string | boolean) => setSteps((s) => s.map((x, k) => (k === i ? { ...x, config: { ...x.config, [key]: v } } : x)));
  const tplFor = (t: string) =>
    templates.filter((x) => x.type === (t === "create_contract" ? "CONTRACT" : t === "create_project" ? "PROJECT" : t === "start_onboarding" ? "ONBOARDING" : ""));

  return (
    <ActionForm action={action} className="grid gap-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="actions" value={JSON.stringify(steps)} />
      <Card className="p-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="a-name" className="sm:col-span-2">
          <Input id="a-name" name="name" defaultValue={initial?.name} required />
        </Field>
        <Field label="Cuando…" htmlFor="a-trigger" className="sm:col-span-2">
          <Select id="a-trigger" name="trigger" defaultValue={initial?.trigger}>
            {triggers.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Solo si el cliente tiene la etiqueta (opcional)" htmlFor="a-tag">
          <Input id="a-tag" name="clientTag" defaultValue={initial?.conditions.clientTag} />
        </Field>
        <Field label="Solo si la factura supera (opcional)" htmlFor="a-min">
          <Input id="a-min" name="minAmount" inputMode="decimal" defaultValue={initial?.conditions.minAmount ? String(initial.conditions.minAmount / 100) : ""} />
        </Field>
      </Card>
      {steps.map((s, i) => {
        const def = actions.find((a) => a.value === s.type);
        return (
          <div key={i} className="grid gap-2">
            <div className="flex justify-center text-muted">
              <ArrowDown className="size-4" />
            </div>
            <Card className="p-5 grid gap-3">
              <div className="flex items-end gap-2">
                <Field label={`Acción ${i + 1}`} htmlFor={`act-${i}`} className="flex-1">
                  <Select id={`act-${i}`} value={s.type} onChange={(e) => set(i, { type: e.target.value, config: {} })}>
                    {actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <button type="button" aria-label="Quitar acción" onClick={() => setSteps((x) => x.filter((_, k) => k !== i))} className="press grid size-10 place-items-center rounded-[10px] text-muted hover:bg-surface">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {def?.fields.map((f) => {
                const id = `f-${i}-${f}`;
                if (f === "autoSend") return <Checkbox key={f} checked={s.config[f] !== false} onChange={(e) => setCfg(i, f, e.target.checked)} label={FIELD_LABEL[f]} />;
                if (f === "templateId")
                  return (
                    <Field key={f} label={FIELD_LABEL[f]} htmlFor={id}>
                      <Select id={id} value={String(s.config[f] ?? "")} onChange={(e) => setCfg(i, f, e.target.value)}>
                        <option value="">Por defecto</option>
                        {tplFor(s.type).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  );
                if (f === "formId" || f === "surveyId")
                  return (
                    <Field key={f} label={FIELD_LABEL[f]} htmlFor={id}>
                      <Select id={id} value={String(s.config[f] ?? "")} onChange={(e) => setCfg(i, f, e.target.value)}>
                        <option value="">Elegir…</option>
                        {(f === "formId" ? forms : surveys).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  );
                if (f === "status")
                  return (
                    <Field key={f} label={FIELD_LABEL[f]} htmlFor={id}>
                      <Select id={id} value={String(s.config[f] ?? "ACTIVE")} onChange={(e) => setCfg(i, f, e.target.value)}>
                        <option value="LEAD">Prospecto</option>
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                      </Select>
                    </Field>
                  );
                if (f === "source")
                  return (
                    <Field key={f} label={FIELD_LABEL[f]} htmlFor={id}>
                      <Select id={id} value={String(s.config[f] ?? "RENEWAL")} onChange={(e) => setCfg(i, f, e.target.value)}>
                        <option value="RENEWAL">Renovación</option>
                        <option value="UPSELL">Venta adicional</option>
                      </Select>
                    </Field>
                  );
                if (f === "body")
                  return (
                    <Field key={f} label={FIELD_LABEL[f]} htmlFor={id} hint="Puedes usar {{cliente.nombre}} y {{empresa.nombre}}.">
                      <Textarea id={id} value={String(s.config[f] ?? "")} onChange={(e) => setCfg(i, f, e.target.value)} />
                    </Field>
                  );
                return (
                  <Field key={f} label={FIELD_LABEL[f] ?? f} htmlFor={id}>
                    <Input id={id} value={String(s.config[f] ?? "")} onChange={(e) => setCfg(i, f, e.target.value)} />
                  </Field>
                );
              })}
            </Card>
          </div>
        );
      })}
      <Button type="button" variant="secondary" className="justify-self-center" onClick={() => setSteps((s) => [...s, { type: "notify_team", config: {} }])}>
        <Plus className="size-4" /> Añadir acción
      </Button>
      <div className="flex justify-end">
        <SubmitButton>Guardar automatización</SubmitButton>
      </div>
    </ActionForm>
  );
}
