import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, inputDate, money } from "@/lib/format";
import { appUrl } from "@/lib/config";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ActionButton, ActionForm, CopyButton, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select, StatusBadge, Table, Td, Th, Textarea, Notice } from "@/components/ui";
import { deletePaymentAction, recordPaymentAction, sendInvoiceAction, updateDraftInvoiceAction, voidInvoiceAction } from "../actions";
import { LineItems } from "../line-items";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("billing.view");
  const inv = await db.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { client: true, items: { orderBy: { sortOrder: "asc" } }, payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!inv) notFound();
  const due = inv.total - inv.amountPaid;
  const url = appUrl(`/i/${inv.publicToken}`);
  const can = ctx.can("billing.manage");
  const siblings = inv.installmentGroup
    ? await db.invoice.findMany({ where: { workspaceId: ctx.workspaceId, installmentGroup: inv.installmentGroup }, orderBy: { installmentIndex: "asc" } })
    : [];

  return (
    <>
      <PageHeader
        back={{ href: "/app/facturacion", label: "Facturación" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{inv.number}</span> <StatusBadge status={inv.status} />
          </span>
        }
        description={
          <>
            <Link href={`/app/clientes/${inv.clientId}`} className="hover:underline underline-offset-2">
              {inv.client.name}
            </Link>
            {inv.title ? ` · ${inv.title}` : ""}
          </>
        }
        actions={
          <>
            {inv.status !== "DRAFT" && (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink px-2">
                Vista del cliente <ExternalLink className="size-3.5" />
              </a>
            )}
            {inv.status !== "DRAFT" && <CopyButton value={url} />}
            {can && inv.status !== "VOID" && inv.status !== "PAID" && (
              <Modal trigger={inv.status === "DRAFT" ? "Enviar factura" : "Reenviar"} title="Enviar factura" description={`Se enviará a ${inv.client.email ?? "el cliente"} con el enlace para pagar.`}>
                <LinkResultForm action={sendInvoiceAction} note="Enlace de la factura:">
                  <input type="hidden" name="id" value={inv.id} />
                  <SubmitButton>Enviar</SubmitButton>
                </LinkResultForm>
              </Modal>
            )}
            {can && inv.status !== "VOID" && inv.status !== "PAID" && inv.status !== "DRAFT" && (
              <Modal trigger="Registrar pago" title="Registrar pago" triggerVariant="accent">
                <ActionForm action={recordPaymentAction} className="grid gap-4">
                  <input type="hidden" name="id" value={inv.id} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Importe (${inv.currency})`} htmlFor="amount">
                      <Input id="amount" name="amount" inputMode="decimal" defaultValue={(due / 100).toFixed(2)} required />
                    </Field>
                    <Field label="Fecha" htmlFor="paidAt">
                      <Input id="paidAt" name="paidAt" type="date" defaultValue={inputDate(new Date())} />
                    </Field>
                  </div>
                  <Field label="Método" htmlFor="method">
                    <Select id="method" name="method" defaultValue="TRANSFER">
                      {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Referencia" htmlFor="reference" hint="Nº de operación. Evita registrar el mismo pago dos veces.">
                    <Input id="reference" name="reference" />
                  </Field>
                  <SubmitButton>Registrar pago</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <Card className="p-5 sm:p-6">
          {inv.status === "DRAFT" && can ? (
            <ActionForm action={updateDraftInvoiceAction} className="grid gap-5">
              <input type="hidden" name="id" value={inv.id} />
              <Field label="Concepto general" htmlFor="title">
                <Input id="title" name="title" defaultValue={inv.title ?? ""} />
              </Field>
              <LineItems currency={inv.currency} initial={inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice }))} initialTax={inv.taxRate} initialDiscount={inv.discount} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Vencimiento" htmlFor="dueDate">
                  <Input id="dueDate" name="dueDate" type="date" defaultValue={inputDate(inv.dueDate)} />
                </Field>
              </div>
              <Field label="Notas" htmlFor="notes">
                <Textarea id="notes" name="notes" defaultValue={inv.notes ?? ""} />
              </Field>
              <div className="flex justify-end">
                <SubmitButton variant="secondary">Guardar borrador</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Descripción</Th>
                    <Th className="text-right">Cant.</Th>
                    <Th className="text-right">Precio</Th>
                    <Th className="text-right">Importe</Th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((i) => (
                    <tr key={i.id}>
                      <Td>{i.description}</Td>
                      <Td className="text-right tabular-nums">{i.quantity}</Td>
                      <Td className="text-right tabular-nums">{money(i.unitPrice, inv.currency)}</Td>
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
                  <dt className="text-muted">Impuesto ({inv.taxRate} %)</dt>
                  <dd className="tabular-nums">{money(inv.tax, inv.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 mt-1">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-display text-xl tabular-nums">{money(inv.total, inv.currency)}</dd>
                </div>
              </dl>
              {inv.notes && <p className="mt-6 text-sm text-muted whitespace-pre-wrap border-t border-line pt-4">{inv.notes}</p>}
            </>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <p className="text-[13px] text-muted">Pendiente</p>
            <p className="font-display text-3xl tabular-nums mt-1">{inv.status === "VOID" ? "—" : money(due, inv.currency)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-accent-strong" style={{ width: `${inv.total ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0}%` }} />
            </div>
            <dl className="mt-4 grid gap-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Emitida</dt>
                <dd>{date(inv.issueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Vence</dt>
                <dd className={inv.status === "OVERDUE" ? "text-danger" : ""}>{date(inv.dueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tipo</dt>
                <dd>{{ STANDARD: "Estándar", DEPOSIT: "Anticipo", INSTALLMENT: "Plazo", RECURRING: "Recurrente" }[inv.kind] ?? inv.kind}</dd>
              </div>
            </dl>
          </Card>

          {siblings.length > 1 && (
            <Card>
              <CardHeader title="Plan de pagos" description="Anticipo y plazos de la misma propuesta" />
              <ul className="pb-3">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/facturacion/${s.id}`} className={`flex items-center justify-between px-5 py-2 text-sm hover:bg-surface ${s.id === inv.id ? "font-medium" : ""}`}>
                      <span>
                        {s.installmentIndex}. {s.kind === "DEPOSIT" ? "Anticipo" : "Plazo"} · {date(s.dueDate, { day: "numeric", month: "short" })}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted">{money(s.total, s.currency)}</span>
                        <StatusBadge status={s.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Pagos" />
            {inv.payments.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin pagos todavía.</p>
            ) : (
              <ul className="pb-3">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                    <span>
                      <span className="tabular-nums font-medium">{money(p.amount, inv.currency)}</span>
                      <span className="block text-[12px] text-muted">
                        {date(p.paidAt)} · <Badge>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</Badge>
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                    </span>
                    {can && p.method !== "STRIPE" && (
                      <ActionButton action={deletePaymentAction} fields={{ id: p.id }} variant="ghost" confirm="¿Eliminar este pago?">
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Eliminar pago</span>
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {inv.status === "VOID" && <Notice tone="warn">Factura anulada.</Notice>}
          {can && inv.status !== "VOID" && inv.amountPaid === 0 && (
            <ActionButton action={voidInvoiceAction} fields={{ id: inv.id }} variant="danger" confirm="¿Anular esta factura?">
              Anular factura
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}
