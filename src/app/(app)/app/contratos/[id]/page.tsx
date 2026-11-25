import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { dateTime } from "@/lib/format";
import { appUrl } from "@/lib/config";
import { isAiConfigured } from "@/lib/ai";
import { TEMPLATE_VARIABLES } from "@/lib/templates";
import { ActionButton, ActionForm, CopyButton, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, CardHeader, Field, Input, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { deleteContractAction, draftContractWithAI, providerSignLinkAction, sendContractAction, updateContractAction, updateSignerAction, voidContractAction } from "../actions";
import { ContractBodyEditor } from "./body-editor";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("contracts.manage");
  const c = await db.contract.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { client: true, signers: { orderBy: { order: "asc" } }, proposal: true },
  });
  if (!c) notFound();
  const anySigned = c.signers.some((s) => s.signedAt);
  const editable = !anySigned && c.status !== "VOID";
  const clientSigner = c.signers.find((s) => s.party === "CLIENT");
  const provider = c.signers.find((s) => s.party === "PROVIDER");

  return (
    <>
      <PageHeader
        back={{ href: "/app/contratos", label: "Contratos" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.title} <StatusBadge status={c.status} />
          </span>
        }
        description={
          <>
            <Link href={`/app/clientes/${c.clientId}`} className="hover:underline underline-offset-2">
              {c.client.name}
            </Link>{" "}
            · <span className="font-mono text-[13px]">{c.number}</span>
            {c.proposal && (
              <>
                {" "}
                · desde{" "}
                <Link href={`/app/propuestas/${c.proposal.id}`} className="hover:underline underline-offset-2">
                  {c.proposal.number}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <ButtonLink href={`/app/contratos/${c.id}/imprimir`} variant="secondary" target="_blank">
              <Printer className="size-4" /> PDF
            </ButtonLink>
            {c.status !== "VOID" && c.status !== "SIGNED" && (
              <Modal trigger={c.status === "DRAFT" ? "Enviar para firma" : "Reenviar al cliente"} title="Enviar para firma" description={`Se enviará a ${clientSigner?.email || "el cliente"} un enlace privado para leer y firmar.`}>
                <LinkResultForm action={sendContractAction} note="Enlace de firma del cliente:">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton>Enviar contrato</SubmitButton>
                </LinkResultForm>
              </Modal>
            )}
          </>
        }
      />

      {c.status === "SIGNED" && (
        <div className="mb-4">
          <Notice tone="ok">Firmado por todas las partes el {dateTime(c.signedAt)}. Huella del documento: <span className="font-mono text-[12px] break-all">{c.contentHash}</span></Notice>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
        <Card className="p-5 sm:p-8">
          {editable ? (
            <ActionForm action={updateContractAction} className="grid gap-4">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Título" htmlFor="title">
                <Input id="title" name="title" defaultValue={c.title} className="font-display text-lg h-11" required />
              </Field>
              <ContractBodyEditor initial={c.body} clientId={c.clientId} aiEnabled={isAiConfigured() && ctx.can("ai.use")} draftAI={draftContractWithAI} />
              <p className="text-[13px] text-muted">
                Variables disponibles: {TEMPLATE_VARIABLES.map((v) => <code key={v} className="mr-1.5 font-mono text-[12px]">{v}</code>)}
              </p>
              <div className="flex justify-end">
                <SubmitButton>Guardar contrato</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <div className="prose-doc text-ink-2">{c.body}</div>
          )}
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader title="Firmantes" description="Firma con trazo, nombre, IP, fecha y huella SHA-256" />
            <ul className="px-5 pb-5 grid gap-4">
              {c.signers.map((s) => (
                <li key={s.id} className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{s.name}</span>
                      <span className="block text-[12px] text-muted truncate">{s.email || "Sin correo"}</span>
                    </span>
                    <Badge tone={s.signedAt ? "ok" : s.viewedAt ? "warn" : "neutral"}>{s.signedAt ? "Firmado" : s.viewedAt ? "Visto" : s.party === "PROVIDER" ? "Tu firma" : "Pendiente"}</Badge>
                  </div>
                  {s.signedAt ? (
                    <div className="rounded-[10px] border border-line bg-surface p-3">
                      {s.signatureData && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.signatureData} alt={`Firma de ${s.typedName}`} className="h-14 w-auto" />
                      )}
                      <p className="text-[12px] text-muted mt-1">
                        {s.typedName} · {dateTime(s.signedAt)} · IP {s.ip ?? "—"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {s.party === "PROVIDER" && c.status !== "VOID" && (
                        <ActionButton action={providerSignLinkAction} fields={{ id: c.id }} variant="primary">
                          Firmar ahora
                        </ActionButton>
                      )}
                      {s.party === "CLIENT" && c.status !== "DRAFT" && c.status !== "VOID" && <CopyButton value={appUrl(`/firmar/${s.token}`)} label="Copiar enlace de firma" />}
                      {editable && (
                        <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title="Editar firmante">
                          <ActionForm action={updateSignerAction} className="grid gap-4">
                            <input type="hidden" name="id" value={s.id} />
                            <Field label="Nombre" htmlFor={`n-${s.id}`}>
                              <Input id={`n-${s.id}`} name="name" defaultValue={s.name} required />
                            </Field>
                            <Field label="Correo" htmlFor={`e-${s.id}`}>
                              <Input id={`e-${s.id}`} name="email" type="email" defaultValue={s.email} required />
                            </Field>
                            <SubmitButton>Guardar</SubmitButton>
                          </ActionForm>
                        </Modal>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {provider && !provider.signedAt && c.status === "PARTIALLY_SIGNED" && <Notice tone="warn">El cliente ya firmó. Falta tu firma para completar el contrato.</Notice>}
          <Card className="p-5 flex flex-wrap gap-2">
            {c.status !== "VOID" && c.status !== "DRAFT" && (
              <ActionButton action={voidContractAction} fields={{ id: c.id }} variant="danger" confirm="¿Anular el contrato? Los enlaces de firma dejarán de funcionar.">
                Anular contrato
              </ActionButton>
            )}
            {c.status === "DRAFT" && (
              <ActionButton action={deleteContractAction} fields={{ id: c.id }} variant="danger" confirm="¿Eliminar el borrador?">
                Eliminar borrador
              </ActionButton>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
