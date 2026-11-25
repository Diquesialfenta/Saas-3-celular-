import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { getIntegration } from "@/lib/integrations";
import { BrandedShell } from "@/components/branded";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Notice, StatusBadge, Table, Td, Th } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { payInvoiceAction } from "../../actions";

export const metadata = { title: "Factura", robots: { index: false } };

export default async function PublicInvoice({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { token } = await params;
  const { pago } = await searchParams;
  const inv = await db.invoice.findUnique({ where: { publicToken: token }, include: { items: { orderBy: { sortOrder: "asc" } }, client: true, workspace: true } });
  if (!inv || inv.status === "DRAFT") notFound();
  const due = inv.total - inv.amountPaid;
  const stripe = await getIntegration(inv.workspaceId, "STRIPE");
  const ws = inv.workspace;
  return (
    <BrandedShell brand={ws}>
      {pago === "ok" && inv.status !== "PAID" && (
        <div className="mb-4">
          <Notice tone="info">Estamos confirmando tu pago con la pasarela. Esta página se actualizará en unos segundos.</Notice>
        </div>
      )}
      <Card className="p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[13px] text-muted">Factura</p>
            <h1 className="font-mono text-2xl">{inv.number}</h1>
            <div className="mt-2">
              <StatusBadge status={inv.status} />
            </div>
          </div>
          <div className="text-sm text-right">
            <p className="font-medium">{ws.legalName || ws.name}</p>
            {ws.taxId && <p className="text-muted">{ws.taxId}</p>}
            {ws.address && <p className="text-muted">{ws.address}</p>}
          </div>
        </div>
        <div className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted">Para</p>
            <p className="font-medium">{inv.client.name}</p>
            {inv.client.taxId && <p className="text-muted">{inv.client.taxId}</p>}
          </div>
          <div>
            <p className="text-muted">Emitida</p>
            <p>{date(inv.issueDate)}</p>
          </div>
          <div>
            <p className="text-muted">Vence</p>
            <p>{date(inv.dueDate)}</p>
          </div>
        </div>
        <Table className="mt-8">
          <thead>
            <tr>
              <Th>Descripción</Th>
              <Th className="text-right">Cant.</Th>
              <Th className="text-right">Importe</Th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.id}>
                <Td>{i.description}</Td>
                <Td className="text-right tabular-nums">{i.quantity}</Td>
                <Td className="text-right tabular-nums">{money(Math.round(i.quantity * i.unitPrice), inv.currency)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <dl className="mt-4 ml-auto max-w-xs grid gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{money(inv.subtotal, inv.currency)}</dd>
          </div>
          {inv.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Descuento</dt>
              <dd className="tabular-nums">− {money(inv.discount, inv.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Impuestos</dt>
            <dd className="tabular-nums">{money(inv.tax, inv.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 mt-1">
            <dt className="font-medium">Total</dt>
            <dd className="font-display text-xl tabular-nums">{money(inv.total, inv.currency)}</dd>
          </div>
          {inv.amountPaid > 0 && (
            <div className="flex justify-between text-ok">
              <dt>Pagado</dt>
              <dd className="tabular-nums">{money(inv.amountPaid, inv.currency)}</dd>
            </div>
          )}
        </dl>
        {inv.notes && <p className="mt-8 text-sm text-muted whitespace-pre-wrap border-t border-line pt-4">{inv.notes}</p>}
      </Card>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 print:hidden">
        {inv.status === "PAID" ? (
          <Notice tone="ok">Factura pagada. ¡Gracias!</Notice>
        ) : inv.status === "VOID" ? (
          <Notice tone="warn">Factura anulada.</Notice>
        ) : stripe ? (
          <ActionForm action={payInvoiceAction}>
            <input type="hidden" name="token" value={token} />
            <SubmitButton size="lg" style={{ background: ws.brandColor, borderColor: ws.brandColor }} pendingLabel="Abriendo la pasarela">
              Pagar {money(due, inv.currency)} con tarjeta
            </SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted">Para pagar, usa los datos indicados en las notas de la factura.</p>
        )}
        <PrintButton label="Descargar PDF" />
      </div>
    </BrandedShell>
  );
}
