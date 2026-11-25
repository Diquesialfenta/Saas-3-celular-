import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, money } from "@/lib/format";
import { computeTotals } from "@/lib/services/billing";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th, Stat } from "@/components/ui";

export const metadata = { title: "Propuestas" };

export default async function ProposalsPage() {
  const ctx = await requireWorkspace("sales.manage");
  const proposals = await db.proposal.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { client: { select: { name: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });
  const totalOf = (p: (typeof proposals)[number]) =>
    computeTotals(
      p.items.filter((i) => !i.isOptional || i.isSelected).map((i) => ({ description: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      p.taxRate,
      p.discount,
    ).total;
  const sent = proposals.filter((p) => p.status !== "DRAFT");
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  const cur = ctx.workspace.currency;
  return (
    <>
      <PageHeader title="Propuestas" description="Propuestas interactivas: el cliente las abre, elige opciones y las acepta en línea." actions={<ButtonLink href="/app/propuestas/nueva">Crear propuesta</ButtonLink>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Enviadas" value={sent.length} />
        <Stat label="Aceptadas" value={accepted.length} hint={sent.length ? `${Math.round((accepted.length / sent.length) * 100)} % de aceptación` : undefined} />
        <Stat label="Importe aceptado" value={money(accepted.reduce((s, p) => s + totalOf(p), 0), cur)} />
        <Stat label="Pendientes de respuesta" value={proposals.filter((p) => p.status === "SENT" || p.status === "VIEWED").length} />
      </div>
      <Card>
        {proposals.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title="Aún no has creado propuestas" description="Parte de una plantilla o deja que la IA redacte el primer borrador." action={<ButtonLink href="/app/propuestas/nueva">Crear propuesta</ButtonLink>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Propuesta</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th className="text-right">Total</Th>
                <Th className="hidden md:table-cell text-right">Válida hasta</Th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/app/propuestas/${p.id}`} className="block">
                      <span className="block font-medium">{p.title}</span>
                      <span className="block text-[12px] text-muted font-mono">{p.number}</span>
                    </Link>
                  </Td>
                  <Td className="text-muted">{p.client.name}</Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td className="text-right tabular-nums">{money(totalOf(p), p.currency)}</Td>
                  <Td className="hidden md:table-cell text-right text-muted">{date(p.validUntil)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
