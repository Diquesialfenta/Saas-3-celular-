import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { date, money } from "@/lib/format";
import { Card, CardHeader, EmptyState, StatusBadge, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Pagos y contratos" };

export default async function PortalPayments({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const [invoices, contracts, proposals] = await Promise.all([
    db.invoice.findMany({ where: { workspaceId: ctx.workspaceId, clientId, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" } }),
    db.contract.findMany({ where: { workspaceId: ctx.workspaceId, clientId, status: { not: "DRAFT" } }, include: { signers: true }, orderBy: { createdAt: "desc" } }),
    db.proposal.findMany({ where: { workspaceId: ctx.workspaceId, clientId, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" } }),
  ]);
  const due = invoices.filter((i) => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status)).reduce((s, i) => s + i.total - i.amountPaid, 0);
  const paid = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const cur = invoices[0]?.currency ?? ctx.workspace.currency;
  return (
    <div className="grid gap-6">
      <h1 className="text-[30px] tracking-[-0.03em]">Pagos y contratos</h1>
      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <Card className="p-5">
          <p className="text-[13px] text-muted">Pendiente</p>
          <p className="font-display text-2xl tabular-nums mt-1">{money(due, cur)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] text-muted">Pagado</p>
          <p className="font-display text-2xl tabular-nums mt-1">{money(paid, cur)}</p>
        </Card>
      </div>
      <Card>
        <CardHeader title="Facturas" />
        {invoices.length === 0 ? (
          <EmptyState title="Sin facturas" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Factura</Th>
                <Th>Estado</Th>
                <Th className="text-right">Importe</Th>
                <Th className="hidden sm:table-cell text-right">Vence</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <span className="font-mono text-[13px]">{i.number}</span>
                    {i.title && <span className="block text-[12px] text-muted">{i.title}</span>}
                  </Td>
                  <Td>
                    <StatusBadge status={i.status} />
                  </Td>
                  <Td className="text-right tabular-nums">{money(i.total, i.currency)}</Td>
                  <Td className="hidden sm:table-cell text-right text-muted">{date(i.dueDate)}</Td>
                  <Td className="text-right">
                    <Link href={`/i/${i.publicToken}`} className="press inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium" style={["SENT", "PARTIAL", "OVERDUE"].includes(i.status) ? { background: ctx.workspace.brandColor, color: "#fff" } : { border: "1px solid rgb(35 35 35 / .18)" }}>
                      {["SENT", "PARTIAL", "OVERDUE"].includes(i.status) ? "Pagar" : "Ver"}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Contratos" />
          {contracts.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Sin contratos.</p>
          ) : (
            <ul className="pb-2">
              {contracts.map((c) => {
                const me = c.signers.find((s) => s.party === "CLIENT");
                return (
                  <li key={c.id}>
                    <a href={`/firmar/${me?.token}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{c.title}</span>
                        <span className="block text-[12px] text-muted">{me?.signedAt ? `Firmado el ${date(me.signedAt)}` : "Pendiente de tu firma"}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Propuestas" />
          {proposals.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Sin propuestas.</p>
          ) : (
            <ul className="pb-2">
              {proposals.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.publicToken}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface text-sm">
                    <span className="truncate">{p.title}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
