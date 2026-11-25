import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BrandedShell } from "@/components/branded";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { submitFormAction } from "../../actions";

export const metadata = { title: "Formulario", robots: { index: false } };

export type FormField = { id: string; type: string; label: string; help?: string; required?: boolean; options?: string[]; showIf?: { field: string; equals: string } };

export default async function PublicForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await db.formRequest.findUnique({ where: { token }, include: { form: true } });
  if (!req) notFound();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } });
  const fields = req.form.fields as FormField[];
  const answers = (req.answers ?? {}) as Record<string, string | string[]>;
  return (
    <BrandedShell brand={ws}>
      <h1 className="text-[32px] leading-tight tracking-[-0.03em]">{req.form.name}</h1>
      {req.form.description && <p className="text-muted mt-2">{req.form.description}</p>}
      {req.status === "SUBMITTED" ? (
        <div className="mt-6 grid gap-4">
          <Notice tone="ok">Formulario enviado. ¡Gracias! Estas son tus respuestas:</Notice>
          <Card className="p-6 grid gap-4">
            {fields.map((f) => (
              <div key={f.id}>
                <p className="text-[13px] text-muted">{f.label}</p>
                <p className="whitespace-pre-wrap">{Array.isArray(answers[f.id]) ? (answers[f.id] as string[]).join(", ") : answers[f.id] || "—"}</p>
              </div>
            ))}
          </Card>
        </div>
      ) : (
        <Card className="mt-6 p-6 sm:p-8">
          <ActionForm action={submitFormAction} className="grid gap-5">
            <input type="hidden" name="token" value={token} />
            {fields.map((f) => {
              const label = `${f.label}${f.required ? "" : " (opcional)"}`;
              if (f.type === "textarea")
                return (
                  <Field key={f.id} label={label} htmlFor={f.id} hint={f.help}>
                    <Textarea id={f.id} name={f.id} required={f.required} />
                  </Field>
                );
              if (f.type === "select")
                return (
                  <Field key={f.id} label={label} htmlFor={f.id} hint={f.help}>
                    <Select id={f.id} name={f.id} required={f.required} defaultValue="">
                      <option value="" disabled>
                        Elige una opción
                      </option>
                      {(f.options ?? []).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  </Field>
                );
              if (f.type === "checkbox")
                return (
                  <fieldset key={f.id} className="grid gap-2">
                    <legend className="text-[13px] font-medium text-ink-2 mb-1">{label}</legend>
                    {(f.options ?? []).map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={f.id} value={o} className="accent-ink" /> {o}
                      </label>
                    ))}
                  </fieldset>
                );
              return (
                <Field key={f.id} label={label} htmlFor={f.id} hint={f.help}>
                  <Input id={f.id} name={f.id} type={["email", "date", "number", "url", "tel"].includes(f.type) ? f.type : "text"} required={f.required} />
                </Field>
              );
            })}
            <SubmitButton size="lg" className="justify-self-start" style={{ background: ws.brandColor, borderColor: ws.brandColor }}>
              Enviar formulario
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </BrandedShell>
  );
}
