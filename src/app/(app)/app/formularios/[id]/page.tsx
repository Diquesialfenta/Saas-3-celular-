import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { dateTime } from "@/lib/format";
import { ActionButton, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input, PageHeader, Select, StatusBadge } from "@/components/ui";
import { deleteFormAction, requestFormAction, saveFormAction } from "../actions";
import { FormBuilder } from "../builder";

type F = { id: string; type: string; label: string; help?: string; required?: boolean; options?: string[] };

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ respuesta?: string }> }) {
  const { id } = await params;
  const { respuesta } = await searchParams;
  const ctx = await requireWorkspace("templates.manage");
  const form = await db.form.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { requests: { orderBy: { createdAt: "desc" }, take: 50 } } });
  if (!form) notFound();
  const clients = await db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const fields = form.fields as F[];
  const open = form.requests.find((r) => r.id === respuesta);
  return (
    <>
      <PageHeader
        back={{ href: "/app/formularios", label: "Formularios" }}
        title={form.name}
        actions={
          <>
            <Modal trigger="Enviar a un cliente" title="Enviar formulario">
              <LinkResultForm action={requestFormAction} className="grid gap-4" note="Enlace del formulario:">
                <input type="hidden" name="formId" value={form.id} />
                <Field label="Cliente" htmlFor="clientId">
                  <Select id="clientId" name="clientId" required>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Fecha límite" htmlFor="dueDate">
                  <Input id="dueDate" name="dueDate" type="date" />
                </Field>
                <SubmitButton>Enviar</SubmitButton>
              </LinkResultForm>
            </Modal>
            <ActionButton action={deleteFormAction} fields={{ id: form.id }} variant="danger" confirm="¿Eliminar el formulario y sus respuestas?">
              Eliminar
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        <FormBuilder action={saveFormAction} initial={{ id: form.id, name: form.name, description: form.description, fields }} />
        <div className="grid gap-4">
          {open && (
            <Card className="p-5 pop">
              <p className="font-medium">{names.get(open.clientId)}</p>
              <p className="text-[12px] text-muted mb-4">{open.submittedAt ? `Respondido ${dateTime(open.submittedAt)}` : "Pendiente de respuesta"}</p>
              <dl className="grid gap-3">
                {fields.map((f) => {
                  const v = (open.answers as Record<string, string | string[]> | null)?.[f.id];
                  return (
                    <div key={f.id}>
                      <dt className="text-[13px] text-muted">{f.label}</dt>
                      <dd className="text-sm whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : v || "—"}</dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          )}
          <Card>
            <CardHeader title="Envíos" />
            <ul className="pb-2">
              {form.requests.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Sin envíos.</li>}
              {form.requests.map((r) => (
                <li key={r.id}>
                  <a href={`/app/formularios/${form.id}?respuesta=${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-surface text-sm">
                    <span className="truncate">{names.get(r.clientId) ?? "Cliente"}</span>
                    <StatusBadge status={r.status === "PENDING" ? "PENDING" : "SUBMITTED"} label={r.status === "PENDING" ? "Pendiente" : "Respondido"} />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
