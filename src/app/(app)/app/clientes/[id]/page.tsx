import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Globe, Sparkles, Trash2, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, money, relative } from "@/lib/format";
import { isAiConfigured } from "@/lib/ai";
import { ActionButton, ActionForm, AutoSubmitSelect, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Avatar, Badge, ButtonLink, Card, CardHeader, Checkbox, DescList, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Textarea, Progress } from "@/components/ui";
import {
  addContactAction, addNoteAction, clientSummaryAction, deleteClientAction, deleteContactAction, invitePortalAction, revokePortalAction,
  setClientStatusAction, startOnboardingAction, updateClientAction, createDealAction,
} from "../actions";
import { ClientFields } from "../client-form";

const ACT_LABEL: Record<string, string> = { NOTE: "Nota", CALL: "Llamada", EMAIL: "Correo", MEETING: "Reunión", SYSTEM: "Sistema" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("clients.view");
  const client = await db.client.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      portalAccess: { where: { isActive: true }, include: { user: true } },
      deals: { orderBy: { createdAt: "desc" } },
      proposals: { orderBy: { createdAt: "desc" }, take: 10 },
      contracts: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { issueDate: "desc" }, take: 10 },
      projects: { orderBy: { createdAt: "desc" }, include: { tasks: { where: { parentId: null }, select: { status: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });
  if (!client) notFound();
  const onboardingTemplates = await db.template.findMany({ where: { workspaceId: ctx.workspaceId, type: "ONBOARDING" } });
  const runs = await db.onboardingRun.findMany({ where: { workspaceId: ctx.workspaceId, clientId: client.id }, orderBy: { createdAt: "desc" }, take: 1 });
  const paid = await db.payment.aggregate({ where: { workspaceId: ctx.workspaceId, invoice: { clientId: client.id } }, _sum: { amount: true } });
  const pending = client.invoices.filter((i) => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status)).reduce((s, i) => s + i.total - i.amountPaid, 0);
  const primary = client.contacts[0];
  const canManage = ctx.can("clients.manage");
  const cur = ctx.workspace.currency;

  return (
    <>
      <PageHeader
        back={{ href: "/app/clientes", label: "Clientes" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={client.name} size={40} />
            {client.name}
          </span>
        }
        description={[client.industry, client.source && `Origen: ${client.source}`].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {canManage && (
              <ActionForm action={setClientStatusAction}>
                <input type="hidden" name="id" value={client.id} />
                <label htmlFor="client-status" className="sr-only">
                  Estado del cliente
                </label>
                <AutoSubmitSelect id="client-status" name="status" defaultValue={client.status}>
                  <option value="LEAD">Prospecto</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="ARCHIVED">Archivado</option>
                </AutoSubmitSelect>
              </ActionForm>
            )}
            {ctx.can("sales.manage") && (
              <ButtonLink href={`/app/propuestas/nueva?cliente=${client.id}`} variant="secondary">
                Crear propuesta
              </ButtonLink>
            )}
            {ctx.can("projects.manage") && (
              <ButtonLink href={`/app/proyectos?nuevo=1&cliente=${client.id}`} variant="secondary">
                Crear proyecto
              </ButtonLink>
            )}
            {ctx.can("portal.manage") && (
              <Modal trigger="Iniciar onboarding" title="Onboarding automático" description="Activa el portal, publica la bienvenida, solicita el formulario y los archivos, crea el proyecto y comparte la agenda de la reunión inicial.">
                <ActionForm action={startOnboardingAction} className="grid gap-4">
                  <input type="hidden" name="clientId" value={client.id} />
                  <Field label="Proceso de onboarding" htmlFor="templateId">
                    <Select id="templateId" name="templateId">
                      <option value="">Proceso estándar (plantillas por defecto)</option>
                      {onboardingTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {!primary?.email && !client.email && <p className="text-sm text-warn">Este cliente no tiene correo: el portal no se podrá activar hasta que añadas uno.</p>}
                  <SubmitButton pendingLabel="Preparando todo">Iniciar onboarding</SubmitButton>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <Card className="p-4">
          <p className="text-[13px] text-muted">Facturado y cobrado</p>
          <p className="font-display text-xl mt-1 tabular-nums">{money(paid._sum.amount ?? 0, cur)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Pendiente de cobro</p>
          <p className="font-display text-xl mt-1 tabular-nums">{money(pending, cur)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Proyectos</p>
          <p className="font-display text-xl mt-1">{client.projects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Cliente desde</p>
          <p className="font-display text-xl mt-1">{date(client.createdAt, { month: "short", year: "numeric" })}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4 content-start min-w-0">
          {runs[0] && (
            <Card>
              <CardHeader title="Onboarding" description={`Completado ${relative(runs[0].createdAt)}`} />
              <ul className="px-5 pb-4 grid gap-2">
                {(runs[0].steps as { key: string; label: string; done: boolean; ref?: string }[]).map((s) => (
                  <li key={s.key} className="flex items-start gap-2 text-sm">
                    <span className={s.done ? "text-ok" : "text-warn"}>{s.done ? "✓" : "!"}</span>
                    <span>
                      {s.label}
                      {s.ref?.startsWith("http") && (
                        <a href={s.ref} target="_blank" rel="noreferrer" className="ml-2 text-muted underline underline-offset-2">
                          abrir
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Proyectos"
              action={
                ctx.can("projects.manage") && (
                  <Link className="text-[13px] text-muted hover:text-ink" href={`/app/proyectos?nuevo=1&cliente=${client.id}`}>
                    Añadir
                  </Link>
                )
              }
            />
            {client.projects.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin proyectos todavía.</p>
            ) : (
              <ul className="pb-2">
                {client.projects.map((p) => {
                  const done = p.tasks.filter((t) => t.status === "DONE").length;
                  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/app/proyectos/${p.id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_auto] items-center gap-4 px-5 py-2.5 hover:bg-surface transition-colors">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <span className="hidden sm:block">
                          <Progress value={pct} />
                        </span>
                        <StatusBadge status={p.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <DocList
              title="Propuestas"
              empty="Sin propuestas"
              rows={client.proposals.map((p) => ({ href: `/app/propuestas/${p.id}`, label: p.title, meta: p.number, status: p.status }))}
            />
            <DocList
              title="Contratos"
              empty="Sin contratos"
              rows={client.contracts.map((c) => ({ href: `/app/contratos/${c.id}`, label: c.title, meta: c.number, status: c.status }))}
            />
            <DocList
              title="Facturas"
              empty="Sin facturas"
              rows={client.invoices.map((i) => ({ href: `/app/facturacion/${i.id}`, label: `${i.number} · ${money(i.total, i.currency)}`, meta: `Vence ${date(i.dueDate)}`, status: i.status }))}
            />
            <Card>
              <CardHeader
                title="Oportunidades"
                action={
                  ctx.can("sales.manage") && (
                    <Modal trigger="Añadir" triggerVariant="ghost" triggerSize="sm" title="Nueva oportunidad">
                      <ActionForm action={createDealAction} className="grid gap-4">
                        <input type="hidden" name="clientId" value={client.id} />
                        <Field label="Título" htmlFor="d-title">
                          <Input id="d-title" name="title" required />
                        </Field>
                        <Field label={`Valor estimado (${cur})`} htmlFor="d-value">
                          <Input id="d-value" name="value" inputMode="decimal" />
                        </Field>
                        <Field label="Cierre previsto" htmlFor="d-close">
                          <Input id="d-close" name="expectedCloseDate" type="date" />
                        </Field>
                        <SubmitButton>Crear oportunidad</SubmitButton>
                      </ActionForm>
                    </Modal>
                  )
                }
              />
              {client.deals.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">Sin oportunidades.</p>
              ) : (
                <ul className="pb-2">
                  {client.deals.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                      <span className="truncate">{d.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-muted tabular-nums">{money(d.value, d.currency)}</span>
                        <StatusBadge status={d.stage} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Historial"
              description="Notas, llamadas y todo lo que ocurre con el cliente"
              action={
                isAiConfigured() &&
                ctx.can("ai.use") && (
                  <ActionButton action={clientSummaryAction} fields={{ clientId: client.id }} variant="secondary">
                    <Sparkles className="size-3.5" /> Resumir con IA
                  </ActionButton>
                )
              }
            />
            <div className="px-5 pb-5">
              <ActionForm action={addNoteAction} reset className="grid gap-2">
                <input type="hidden" name="clientId" value={client.id} />
                <label htmlFor="note" className="sr-only">
                  Nueva nota
                </label>
                <Textarea id="note" name="content" placeholder="Escribe una nota, el resumen de una llamada o un correo" className="min-h-20" required />
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="note-type" className="sr-only">
                    Tipo
                  </label>
                  <Select id="note-type" name="type" className="w-40 h-9">
                    <option value="NOTE">Nota</option>
                    <option value="CALL">Llamada</option>
                    <option value="EMAIL">Correo</option>
                    <option value="MEETING">Reunión</option>
                  </Select>
                  <SubmitButton size="sm">Guardar nota</SubmitButton>
                </div>
              </ActionForm>
              <ol className="mt-5 grid gap-4">
                {client.activities.map((a) => (
                  <li key={a.id} className="grid grid-cols-[86px_1fr] gap-3 text-sm">
                    <span className="text-[12px] text-faint pt-0.5">{relative(a.createdAt)}</span>
                    <span>
                      <Badge tone={a.type === "SYSTEM" ? "neutral" : "info"} className="mr-2">
                        {ACT_LABEL[a.type] ?? a.type}
                      </Badge>
                      <span className="whitespace-pre-wrap">{a.content}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader
              title="Datos"
              action={
                canManage && (
                  <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title="Editar cliente" wide>
                    <ActionForm action={updateClientAction} className="grid gap-5">
                      <ClientFields c={client} full />
                      <div className="flex justify-end">
                        <SubmitButton>Guardar</SubmitButton>
                      </div>
                    </ActionForm>
                  </Modal>
                )
              }
            />
            <div className="px-5 pb-5 grid gap-4">
              <div className="grid gap-2 text-sm">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2 hover:underline underline-offset-2">
                    <Mail className="size-4 text-muted" /> {client.email}
                  </a>
                )}
                {client.phone && (
                  <a href={`https://wa.me/${client.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline underline-offset-2">
                    <Phone className="size-4 text-muted" /> {client.phone}
                  </a>
                )}
                {client.website && (
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline underline-offset-2">
                    <Globe className="size-4 text-muted" /> {client.website}
                  </a>
                )}
              </div>
              <DescList
                items={[
                  { label: "Tipo", value: client.kind === "PERSON" ? "Persona" : "Empresa" },
                  { label: "Documento", value: client.taxId },
                  { label: "Dirección", value: client.address },
                  { label: "Etiquetas", value: client.tags.length ? <span className="flex flex-wrap gap-1">{client.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span> : null },
                ]}
              />
              {client.notes && <p className="text-sm text-muted whitespace-pre-wrap border-t border-line pt-3">{client.notes}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Contactos"
              action={
                canManage && (
                  <Modal trigger="Añadir" triggerVariant="ghost" triggerSize="sm" title="Nuevo contacto">
                    <ActionForm action={addContactAction} className="grid gap-4">
                      <input type="hidden" name="clientId" value={client.id} />
                      <Field label="Nombre" htmlFor="c-name">
                        <Input id="c-name" name="name" required />
                      </Field>
                      <Field label="Cargo" htmlFor="c-pos">
                        <Input id="c-pos" name="position" />
                      </Field>
                      <Field label="Correo" htmlFor="c-email">
                        <Input id="c-email" name="email" type="email" />
                      </Field>
                      <Field label="Teléfono" htmlFor="c-phone">
                        <Input id="c-phone" name="phone" type="tel" />
                      </Field>
                      <Checkbox name="isPrimary" label="Contacto principal" />
                      <SubmitButton>Añadir contacto</SubmitButton>
                    </ActionForm>
                  </Modal>
                )
              }
            />
            {client.contacts.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin contactos.</p>
            ) : (
              <ul className="pb-3">
                {client.contacts.map((c) => (
                  <li key={c.id} className="group flex items-start gap-3 px-5 py-2">
                    <Avatar name={c.name} size={28} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.name}</span>
                        {c.isPrimary && <Badge tone="accent">Principal</Badge>}
                      </span>
                      <span className="block text-[13px] text-muted truncate">{[c.position, c.email, c.phone].filter(Boolean).join(" · ")}</span>
                    </span>
                    {canManage && (
                      <ActionButton action={deleteContactAction} fields={{ id: c.id }} variant="ghost" confirm={`¿Eliminar a ${c.name}?`} className="opacity-60 hover:opacity-100 px-2">
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Eliminar contacto</span>
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Portal del cliente" description="Acceso privado con tu marca" />
            <div className="px-5 pb-5 grid gap-3">
              {client.portalAccess.length > 0 ? (
                <ul className="grid gap-2">
                  {client.portalAccess.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{a.user.name}</span>
                        <span className="block truncate text-[12px] text-muted">{a.user.email}</span>
                      </span>
                      {ctx.can("portal.manage") && (
                        <ActionButton action={revokePortalAction} fields={{ id: a.id }} variant="ghost" confirm="¿Revocar el acceso al portal?">
                          Revocar
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nadie de este cliente tiene acceso todavía.</p>
              )}
              {ctx.can("portal.manage") && (
                <LinkResultForm action={invitePortalAction} className="grid gap-2" note="Enlace de activación (válido 14 días):">
                  <input type="hidden" name="clientId" value={client.id} />
                  <label htmlFor="inv-email" className="text-[13px] font-medium text-ink-2">
                    Invitar por correo
                  </label>
                  <div className="flex gap-2">
                    <Input id="inv-email" name="email" type="email" defaultValue={primary?.email ?? client.email ?? ""} required />
                    <input type="hidden" name="name" value={primary?.name ?? client.name} />
                    <SubmitButton variant="secondary">Invitar</SubmitButton>
                  </div>
                </LinkResultForm>
              )}
              <Link href={`/portal/${client.id}?vista=equipo`} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                Ver cómo lo ve el cliente <ExternalLink className="size-3" />
              </Link>
            </div>
          </Card>

          {canManage && (ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN") && (
            <ActionButton action={deleteClientAction} fields={{ id: client.id }} variant="danger" confirm={`Se eliminará ${client.name} con todos sus proyectos, documentos y facturas. ¿Continuar?`}>
              <Trash2 className="size-3.5" /> Eliminar cliente
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}

function DocList({ title, rows, empty }: { title: string; empty: string; rows: { href: string; label: string; meta: string; status: string }[] }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="pb-2">
          {rows.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-surface transition-colors">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{r.label}</span>
                  <span className="block text-[12px] text-muted">{r.meta}</span>
                </span>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
