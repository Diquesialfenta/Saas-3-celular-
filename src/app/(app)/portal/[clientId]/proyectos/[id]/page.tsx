import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Check } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { date, relative } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Input, Progress, Select, StatusBadge, Textarea, cx } from "@/components/ui";
import { portalUploadAction, requestChangeAction, reviewDeliverableAction } from "../../../actions";

export default async function PortalProject({ params }: { params: Promise<{ clientId: string; id: string }> }) {
  const { clientId, id } = await params;
  const ctx = await requirePortal(clientId);
  const p = await db.project.findFirst({
    where: { id, workspaceId: ctx.workspaceId, clientId, visibleToClient: true },
    include: {
      stages: { orderBy: { sortOrder: "asc" }, include: { tasks: { where: { parentId: null }, select: { status: true, title: true, visibleToClient: true, forClient: true, dueDate: true } } } },
      milestones: { where: { visibleToClient: true }, orderBy: { dueDate: "asc" } },
      tasks: { where: { parentId: null }, select: { status: true } },
      deliverables: { where: { status: { not: "DRAFT" } }, include: { reviews: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) notFound();
  const [files, docs, changes] = await Promise.all([
    db.fileAsset.findMany({ where: { workspaceId: ctx.workspaceId, projectId: p.id, OR: [{ visibleToClient: true }, { source: "CLIENT" }] }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } }),
    db.document.findMany({ where: { workspaceId: ctx.workspaceId, projectId: p.id, visibleToClient: true }, orderBy: { publishedAt: "desc" } }),
    db.changeRequest.findMany({ where: { workspaceId: ctx.workspaceId, projectId: p.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const fileMap = new Map(files.map((f) => [f.id, f]));
  const done = p.tasks.filter((t) => t.status === "DONE").length;
  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const brand = ctx.workspace.brandColor;

  return (
    <div className="grid gap-6">
      <div>
        <Link href={`/portal/${clientId}/proyectos`} className="text-[13px] text-muted hover:text-ink">
          ← Proyectos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[30px] tracking-[-0.03em]">{p.name}</h1>
          <StatusBadge status={p.status} />
        </div>
        {p.description && <p className="text-muted mt-1 max-w-2xl">{p.description}</p>}
        <div className="mt-4 max-w-md">
          <div className="flex justify-between text-[13px] text-muted mb-1.5">
            <span>{pct} % completado</span>
            <span>{p.dueDate ? `Entrega prevista: ${date(p.dueDate, { dateStyle: "long" })}` : ""}</span>
          </div>
          <Progress value={pct} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Entregas" description="Aprueba lo que está bien o pide cambios" />
            {p.deliverables.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Todavía no hay entregas. Te avisaremos cuando haya algo que revisar.</p>
            ) : (
              <ul className="grid gap-px bg-line">
                {p.deliverables.map((d) => {
                  const f = d.fileId ? fileMap.get(d.fileId) : null;
                  return (
                    <li key={d.id} className="bg-white px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{d.title}</p>
                          {d.description && <p className="text-sm text-muted">{d.description}</p>}
                          <div className="mt-1 flex flex-wrap gap-3 text-[13px]">
                            {f?.versions[0] && (
                              <a href={`/api/files/${f.versions[0].id}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                                <Download className="size-3.5" /> {f.name}
                              </a>
                            )}
                            {d.link && (
                              <a href={d.link} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                Ver la entrega
                              </a>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                      {d.status === "IN_REVIEW" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionForm action={reviewDeliverableAction}>
                            <input type="hidden" name="clientId" value={clientId} />
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="decision" value="APPROVED" />
                            <SubmitButton size="sm" style={{ background: brand, borderColor: brand }}>
                              <Check className="size-3.5" /> Aprobar
                            </SubmitButton>
                          </ActionForm>
                          <Modal trigger="Pedir cambios" triggerVariant="secondary" triggerSize="sm" title="Pedir cambios" description={d.title}>
                            <ActionForm action={reviewDeliverableAction} className="grid gap-4">
                              <input type="hidden" name="clientId" value={clientId} />
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="decision" value="CHANGES" />
                              <Field label="¿Qué hay que cambiar?" htmlFor={`ch-${d.id}`}>
                                <Textarea id={`ch-${d.id}`} name="comment" required className="min-h-32" />
                              </Field>
                              <SubmitButton>Enviar comentarios</SubmitButton>
                            </ActionForm>
                          </Modal>
                        </div>
                      )}
                      {d.reviews[0] && <p className="mt-2 text-[12px] text-muted">Última revisión: {d.reviews[0].reviewerName}, {relative(d.reviews[0].createdAt)}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Cronograma" />
            <ol className="px-5 pb-5 grid gap-5">
              {p.stages.map((s, i) => {
                const total = s.tasks.length;
                const sd = s.tasks.filter((t) => t.status === "DONE").length;
                const state = total && sd === total ? "done" : sd > 0 || s.tasks.some((t) => t.status === "IN_PROGRESS") ? "doing" : "todo";
                return (
                  <li key={s.id} className="grid grid-cols-[28px_1fr] gap-3">
                    <span className={cx("grid size-7 place-items-center rounded-full text-[12px] font-medium", state === "done" ? "text-white" : state === "doing" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted")} style={state === "done" ? { background: brand } : undefined}>
                      {state === "done" ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-[13px] text-muted">{total ? `${sd} de ${total} tareas` : "Sin tareas"}</p>
                      <ul className="mt-1.5 grid gap-1">
                        {s.tasks
                          .filter((t) => t.visibleToClient)
                          .map((t, k) => (
                            <li key={k} className="text-sm flex items-center gap-2">
                              <span className={cx("size-1.5 rounded-full", t.status === "DONE" ? "bg-ok" : "bg-line-strong")} />
                              <span className={t.status === "DONE" ? "text-muted line-through" : ""}>{t.title}</span>
                              {t.forClient && <Badge tone="accent">Tú</Badge>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {docs.length > 0 && (
            <Card>
              <CardHeader title="Informes y documentos" />
              <ul className="pb-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/portal/${clientId}/documentos?doc=${d.id}`} className="flex justify-between gap-3 px-5 py-2.5 hover:bg-surface text-sm">
                      <span>{d.title}</span>
                      <span className="text-muted text-[13px]">{date(d.publishedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader title="Hitos" />
            <ol className="px-5 pb-4 grid gap-2.5">
              {p.milestones.length === 0 && <li className="text-sm text-muted">Sin hitos.</li>}
              {p.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cx("size-2.5 rounded-full", m.completedAt ? "" : "bg-line-strong")} style={m.completedAt ? { background: brand } : undefined} />
                    <span className={m.completedAt ? "text-muted" : ""}>{m.title}</span>
                  </span>
                  <span className="text-[13px] text-muted">{m.completedAt ? "Hecho" : date(m.dueDate, { day: "numeric", month: "short" })}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Archivos" />
            <ul className="pb-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/${f.versions[0]?.id}`} className="flex items-center justify-between gap-2 px-5 py-2 text-sm hover:bg-surface">
                    <span className="truncate">{f.name}</span>
                    <span className="text-[12px] text-muted shrink-0">{f.source === "CLIENT" ? "Tuyo" : `v${f.versions[0]?.version}`}</span>
                  </a>
                </li>
              ))}
            </ul>
            <ActionForm action={portalUploadAction} reset className="grid gap-2 border-t border-line p-4">
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="projectId" value={p.id} />
              <label htmlFor="pf" className="text-[13px] font-medium">
                Enviar archivos al equipo
              </label>
              <Input id="pf" name="file" type="file" multiple required className="h-auto py-2" />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Subiendo">
                Enviar
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium">¿Quieres cambiar o ampliar algo?</p>
            <p className="text-[13px] text-muted mt-1">El equipo lo revisa y te responde con un presupuesto si hace falta.</p>
            <Modal trigger="Solicitar un cambio" triggerVariant="secondary" triggerSize="sm" triggerClassName="mt-3" title="Solicitud de cambio o ampliación">
              <ActionForm action={requestChangeAction} className="grid gap-4">
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="projectId" value={p.id} />
                <Field label="Tipo" htmlFor="cr-type">
                  <Select id="cr-type" name="type">
                    <option value="MODIFICATION">Modificación de algo ya hecho</option>
                    <option value="SCOPE_EXTENSION">Ampliación del alcance</option>
                  </Select>
                </Field>
                <Field label="Título" htmlFor="cr-title">
                  <Input id="cr-title" name="title" required />
                </Field>
                <Field label="Describe lo que necesitas" htmlFor="cr-desc">
                  <Textarea id="cr-desc" name="description" required />
                </Field>
                <SubmitButton>Enviar solicitud</SubmitButton>
              </ActionForm>
            </Modal>
            {changes.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {changes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{c.title}</span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
