import Link from "next/link";
import { FileSignature } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, PageHeader, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { createContractAction } from "./actions";

export const metadata = { title: "Contratos" };

export default async function ContractsPage() {
  const ctx = await requireWorkspace("contracts.manage");
  const [contracts, clients, templates, proposals] = await Promise.all([
    db.contract.findMany({ where: { workspaceId: ctx.workspaceId }, include: { client: { select: { name: true } }, signers: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.template.findMany({ where: { workspaceId: ctx.workspaceId, type: "CONTRACT" } }),
    db.proposal.findMany({ where: { workspaceId: ctx.workspaceId, status: "ACCEPTED", contracts: { none: {} } }, select: { id: true, number: true, title: true, client: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader
        title="Contratos"
        description="Genera contratos desde tus plantillas con los datos del cliente y la propuesta. Ambas partes firman en línea con registro de evidencias."
        actions={
          <Modal trigger="Crear contrato" title="Nuevo contrato">
            {clients.length === 0 ? (
              <p className="text-sm text-muted">Primero añade un cliente.</p>
            ) : (
              <ActionForm action={createContractAction} className="grid gap-4">
                <Field label="Cliente" htmlFor="clientId">
                  <Select id="clientId" name="clientId" required>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Propuesta aceptada (opcional)" htmlFor="proposalId" hint="Rellena importes, alcance y anticipo automáticamente.">
                  <Select id="proposalId" name="proposalId">
                    <option value="">Sin propuesta</option>
                    {proposals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.title} ({p.client.name})
                      </option>
                    ))}
                  </Select>
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
                <SubmitButton>Crear contrato</SubmitButton>
              </ActionForm>
            )}
          </Modal>
        }
      />
      <Card>
        {contracts.length === 0 ? (
          <EmptyState icon={<FileSignature className="size-5" />} title="Aún no hay contratos" description="Se crean al aceptar una propuesta (con la automatización activa) o manualmente." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Contrato</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th className="hidden md:table-cell">Firmas</Th>
                <Th className="hidden sm:table-cell text-right">Creado</Th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/app/contratos/${c.id}`}>
                      <span className="block font-medium">{c.title}</span>
                      <span className="block text-[12px] text-muted font-mono">{c.number}</span>
                    </Link>
                  </Td>
                  <Td className="text-muted">{c.client.name}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td className="hidden md:table-cell tabular-nums text-muted">
                    {c.signers.filter((s) => s.signedAt).length} de {c.signers.length}
                  </Td>
                  <Td className="hidden sm:table-cell text-right text-muted">{date(c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
