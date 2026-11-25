import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { createProposalAction } from "../actions";

export const metadata = { title: "Nueva propuesta" };

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ cliente?: string; oportunidad?: string }> }) {
  const ctx = await requireWorkspace("sales.manage");
  const { cliente, oportunidad } = await searchParams;
  const [clients, templates] = await Promise.all([
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.template.findMany({ where: { workspaceId: ctx.workspaceId, type: "PROPOSAL" }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/app/propuestas", label: "Propuestas" }} title="Nueva propuesta" description="Elige el cliente y una plantilla. Después podrás redactarla con IA, ajustar precios y enviarla." />
      <Card className="max-w-xl p-6">
        {clients.length === 0 ? (
          <p className="text-sm">
            Necesitas un cliente para crear una propuesta.{" "}
            <Link href="/app/clientes" className="underline underline-offset-2">
              Añade uno
            </Link>
            .
          </p>
        ) : (
          <ActionForm action={createProposalAction} className="grid gap-4">
            {oportunidad && <input type="hidden" name="dealId" value={oportunidad} />}
            <Field label="Cliente" htmlFor="clientId">
              <Select id="clientId" name="clientId" defaultValue={cliente} required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título" htmlFor="title" hint="Si lo dejas vacío se usa el de la plantilla.">
              <Input id="title" name="title" placeholder="Rediseño de la web corporativa" />
            </Field>
            <Field label="Plantilla" htmlFor="templateId">
              <Select id="templateId" name="templateId">
                <option value="">En blanco</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton className="justify-self-start">Crear y editar</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
