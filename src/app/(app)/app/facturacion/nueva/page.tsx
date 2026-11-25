import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { inputDate } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createInvoiceAction } from "../actions";
import { LineItems } from "../line-items";

export const metadata = { title: "Nueva factura" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ cliente?: string; proyecto?: string }> }) {
  const ctx = await requireWorkspace("billing.manage");
  const { cliente, proyecto } = await searchParams;
  const [clients, projects, services] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { workspaceId: ctx.workspaceId, status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } }, select: { id: true, name: true } }),
    db.service.findMany({ where: { workspaceId: ctx.workspaceId, isActive: true } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/app/facturacion", label: "Facturación" }} title="Nueva factura" />
      {clients.length === 0 ? (
        <Card className="p-6 text-sm">Primero añade un cliente.</Card>
      ) : (
        <ActionForm action={createInvoiceAction} className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
          <Card className="p-5 sm:p-6 grid gap-5">
            <Field label="Concepto general (opcional)" htmlFor="title">
              <Input id="title" name="title" placeholder="Desarrollo de la fase 1" />
            </Field>
            <LineItems currency={ctx.workspace.currency} initialTax={ctx.workspace.taxRate} />
            {services.length > 0 && <p className="text-[13px] text-muted">Tu catálogo: {services.map((s) => s.name).join(" · ")}</p>}
            <Field label="Notas para el cliente" htmlFor="notes">
              <Textarea id="notes" name="notes" defaultValue={ctx.workspace.invoiceFooter ?? ""} placeholder="Datos bancarios, condiciones de pago…" />
            </Field>
          </Card>
          <Card className="p-5 grid gap-4">
            <Field label="Cliente" htmlFor="clientId">
              <Select id="clientId" name="clientId" defaultValue={cliente} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Proyecto" htmlFor="projectId">
              <Select id="projectId" name="projectId" defaultValue={proyecto}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda" htmlFor="currency">
              <Input id="currency" name="currency" defaultValue={ctx.workspace.currency} maxLength={3} />
            </Field>
            <Field label="Vencimiento" htmlFor="dueDate">
              <Input id="dueDate" name="dueDate" type="date" defaultValue={inputDate(new Date(Date.now() + 15 * 86400_000))} />
            </Field>
            <div className="grid gap-2 pt-2">
              <SubmitButton name="send" value="1">
                Crear y enviar
              </SubmitButton>
              <SubmitButton variant="secondary">Guardar como borrador</SubmitButton>
            </div>
          </Card>
        </ActionForm>
      )}
    </>
  );
}
