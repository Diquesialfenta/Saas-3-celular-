import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { dateTime, inputDate } from "@/lib/format";
import { appUrl } from "@/lib/config";
import { isAiConfigured } from "@/lib/ai";
import { ActionButton, CopyButton, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Notice, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import {
  deleteProposalAction, draftProposalWithAI, duplicateProposalAction, proposalToContractAction, proposalToInvoicesAction, publishProposalLinkAction, saveProposalAction, sendProposalAction,
} from "../actions";
import { ProposalEditor } from "./editor";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("sales.manage");
  const p = await db.proposal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: { include: { contacts: true } }, contracts: true },
  });
  if (!p) notFound();
  const invoices = await db.invoice.count({ where: { workspaceId: ctx.workspaceId, proposalId: p.id } });
  const path = `/p/${p.publicToken}`;
  const url = appUrl(path);
  const draft = p.status === "DRAFT";
  const email = p.client.contacts.find((c) => c.isPrimary)?.email ?? p.client.email ?? "";
  const locked = p.status === "ACCEPTED";
  const timeline = [
    { label: "Creada", at: p.createdAt },
    { label: "Enviada", at: p.sentAt },
    { label: "Vista por el cliente", at: p.viewedAt },
    { label: `Aceptada por ${p.acceptedByName ?? ""}`, at: p.acceptedAt },
    { label: `Rechazada${p.declineReason ? `: ${p.declineReason}` : ""}`, at: p.declinedAt },
  ].filter((t) => t.at);

  return (
    <>
      <PageHeader
        back={{ href: "/app/propuestas", label: "Propuestas" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.title} <StatusBadge status={p.status} />
          </span>
        }
        description={
          <>
            <Link href={`/app/clientes/${p.clientId}`} className="underline-offset-2 hover:underline">
              {p.client.name}
            </Link>{" "}
            · <span className="font-mono text-[13px]">{p.number}</span>
          </>
        }
        actions={
          <>
            <a href={`${path}?vista=previa`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink px-2">
              Vista del cliente <ExternalLink className="size-3.5" />
            </a>
            <Modal trigger="Copiar enlace" triggerSize="sm" triggerVariant="secondary" title="Compartir propuesta">
              {draft ? (
                <LinkResultForm action={publishProposalLinkAction} className="grid gap-3">
                  <p className="text-sm text-muted">Publica la propuesta para activar el enlace. Así podrás compartirlo sin enviar un correo desde Encauza.</p>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton pendingLabel="Publicando">Publicar enlace</SubmitButton>
                </LinkResultForm>
              ) : (
                <div className="flex items-center gap-2">
                  <Input readOnly value={url} aria-label="Enlace de la propuesta" className="min-w-0 flex-1 font-mono text-sm" />
                  <CopyButton value={url} label="Copiar" />
                </div>
              )}
            </Modal>
            {!locked && (
              <Modal trigger={draft ? "Enviar al cliente" : "Reenviar"} title="Enviar propuesta" description="El cliente recibe un enlace privado para revisarla y aceptarla.">
                <LinkResultForm action={sendProposalAction} className="grid gap-4" note="Enlace de la propuesta:">
                  <input type="hidden" name="id" value={p.id} />
                  <Field label="Correo del cliente" htmlFor="to">
                    <Input id="to" name="email" type="email" defaultValue={email} />
                  </Field>
                  <Field label="Mensaje" htmlFor="msg">
                    <Textarea id="msg" name="message" defaultValue="Te enviamos nuestra propuesta. Puedes revisarla, elegir las opciones que te interesen y aceptarla en línea." />
                  </Field>
                  <SubmitButton>Enviar propuesta</SubmitButton>
                </LinkResultForm>
              </Modal>
            )}
          </>
        }
      />

      {locked && (
        <div className="mb-4">
          <Notice
            tone="ok"
            action={
              <div className="flex flex-wrap gap-2">
                {p.contracts[0] ? (
                  <Link href={`/app/contratos/${p.contracts[0].id}`} className="text-sm font-medium underline underline-offset-2">
                    Ver contrato {p.contracts[0].number}
                  </Link>
                ) : (
                  ctx.can("contracts.manage") && (
                    <ActionButton action={proposalToContractAction} fields={{ id: p.id }}>
                      Generar contrato
                    </ActionButton>
                  )
                )}
                {invoices === 0 && ctx.can("billing.manage") && (
                  <ActionButton action={proposalToInvoicesAction} fields={{ id: p.id }}>
                    Generar facturas
                  </ActionButton>
                )}
              </div>
            }
          >
            Aceptada por {p.acceptedByName} ({p.acceptedByEmail}) el {dateTime(p.acceptedAt)}. {invoices > 0 && `${invoices} factura(s) generadas.`}
          </Notice>
        </div>
      )}

      <ProposalEditor
        locked={locked}
        aiEnabled={isAiConfigured() && ctx.can("ai.use")}
        save={saveProposalAction}
        draftAI={draftProposalWithAI}
        initial={{
          id: p.id,
          title: p.title,
          summary: p.summary,
          sections: (p.sections as { id: string; title: string; body: string }[]) ?? [],
          items: p.items.map((i) => ({
            name: i.name,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            recurring: i.recurring as "NONE" | "MONTHLY" | "YEARLY",
            isOptional: i.isOptional,
            isSelected: i.isSelected,
          })),
          taxRate: p.taxRate,
          discount: p.discount,
          depositPercent: p.depositPercent,
          installments: p.installments,
          validUntil: inputDate(p.validUntil) || null,
          currency: p.currency,
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card className="p-5">
          <h2 className="text-[15px] font-medium font-sans tracking-normal mb-3">Seguimiento</h2>
          <ol className="grid gap-2 text-sm">
            {timeline.map((t) => (
              <li key={t.label} className="flex justify-between gap-3">
                <span>{t.label}</span>
                <span className="text-muted">{dateTime(t.at)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5 flex flex-wrap items-start gap-2">
          <ActionButton action={duplicateProposalAction} fields={{ id: p.id }}>
            Duplicar
          </ActionButton>
          {!locked && (
            <ActionButton action={deleteProposalAction} fields={{ id: p.id }} variant="danger" confirm="¿Eliminar esta propuesta?">
              Eliminar
            </ActionButton>
          )}
        </Card>
      </div>
    </>
  );
}
