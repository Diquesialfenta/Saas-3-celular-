import Link from "next/link";
import { Download, Eye, EyeOff, Trash2, Upload, Sparkles, Video } from "lucide-react";
import type { Milestone, Stage, Task } from "@prisma/client";
import { db } from "@/lib/db";
import { date, dateTime, money, relative } from "@/lib/format";
import { isAiConfigured } from "@/lib/ai";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Checkbox, EmptyState, Field, Input, PriorityDot, Select, StatusBadge, Textarea } from "@/components/ui";
import {
  addMilestoneAction, addStageAction, createDeliverableAction, createMeetingAction, deleteDeliverableAction, deleteDocumentAction, deleteFileAction, deleteStageAction,
  generateDocumentAction, respondChangeRequestAction, saveDocumentAction, submitDeliverableAction, summarizeMeetingAction, toggleFileVisibilityAction, toggleMilestoneAction,
  updateMeetingAction, uploadFileAction,
} from "../actions";

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function StagesView({ project, names, canManage }: { project: { id: string; stages: Stage[]; tasks: (Task & { subtasks: { status: string }[] })[] }; names: Map<string, string>; canManage: boolean }) {
  const groups = [...project.stages.map((s) => ({ stage: s, tasks: project.tasks.filter((t) => t.stageId === s.id) })), { stage: null, tasks: project.tasks.filter((t) => !t.stageId) }];
  return (
    <div className="grid gap-4">
      {groups
        .filter((g) => g.stage || g.tasks.length)
        .map((g) => {
          const done = g.tasks.filter((t) => t.status === "DONE").length;
          return (
            <Card key={g.stage?.id ?? "none"}>
              <CardHeader
                title={g.stage?.name ?? "Sin etapa"}
                description={`${done}/${g.tasks.length} completadas${g.stage?.dueDate ? ` · hasta ${date(g.stage.dueDate)}` : ""}`}
                action={
                  canManage &&
                  g.stage && (
                    <ActionButton action={deleteStageAction} fields={{ id: g.stage.id }} variant="ghost" confirm="¿Eliminar la etapa? Sus tareas pasarán a «Sin etapa».">
                      Eliminar
                    </ActionButton>
                  )
                }
              />
              <ul className="pb-2">
                {g.tasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/proyectos/${project.id}?vista=etapas&tarea=${t.id}`} scroll={false} className="flex items-center gap-3 px-5 py-2 hover:bg-surface">
                      <StatusBadge status={t.status} />
                      <span className="flex-1 truncate text-sm">{t.title}</span>
                      {t.forClient && <Badge tone="accent">Cliente</Badge>}
                      <PriorityDot priority={t.priority} />
                      <span className="hidden sm:block w-28 truncate text-right text-[13px] text-muted">{t.assigneeId ? names.get(t.assigneeId) : "—"}</span>
                      <span className="w-16 text-right text-[13px] text-muted">{t.dueDate ? date(t.dueDate, { day: "numeric", month: "short" }) : "—"}</span>
                    </Link>
                  </li>
                ))}
                {g.tasks.length === 0 && <li className="px-5 pb-3 text-sm text-muted">Sin tareas.</li>}
              </ul>
            </Card>
          );
        })}
      {canManage && (
        <Card className="p-4">
          <ActionForm action={addStageAction} reset className="flex flex-col sm:flex-row gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label htmlFor="stage-name" className="sr-only">
              Nombre de la etapa
            </label>
            <Input id="stage-name" name="name" placeholder="Nueva etapa (p. ej. Lanzamiento)" required />
            <label htmlFor="stage-due" className="sr-only">
              Fecha
            </label>
            <Input id="stage-due" name="dueDate" type="date" className="sm:w-44" />
            <SubmitButton variant="secondary">Añadir etapa</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

export function MilestonesView({ project, canManage }: { project: { id: string; milestones: Milestone[] }; canManage: boolean }) {
  return (
    <Card>
      <CardHeader title="Hitos" description="Los hitos visibles aparecen en el cronograma del portal del cliente" />
      {project.milestones.length === 0 ? (
        <EmptyState title="Sin hitos" />
      ) : (
        <ol className="px-5 pb-4 relative">
          {project.milestones.map((m) => {
            const late = !m.completedAt && m.dueDate && m.dueDate < new Date();
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                {canManage ? (
                  <ActionButton action={toggleMilestoneAction} fields={{ id: m.id }} variant="ghost" className="px-1.5">
                    <span className={`grid size-5 place-items-center rounded-full border ${m.completedAt ? "bg-accent border-accent-strong text-accent-ink" : "border-line-strong"}`} aria-hidden>
                      {m.completedAt ? "✓" : ""}
                    </span>
                    <span className="sr-only">{m.completedAt ? "Reabrir hito" : "Marcar hito como alcanzado"}</span>
                  </ActionButton>
                ) : (
                  <span className={`size-3 rounded-full ${m.completedAt ? "bg-accent-strong" : "bg-line-strong"}`} />
                )}
                <span className={`flex-1 text-sm ${m.completedAt ? "text-muted" : ""}`}>{m.title}</span>
                {!m.visibleToClient && <Badge>Interno</Badge>}
                <span className={`text-[13px] ${late ? "text-danger" : "text-muted"}`}>{m.completedAt ? `Hecho ${date(m.completedAt, { day: "numeric", month: "short" })}` : date(m.dueDate)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {canManage && (
        <ActionForm action={addMilestoneAction} reset className="flex flex-col sm:flex-row gap-2 p-4 border-t border-line">
          <input type="hidden" name="projectId" value={project.id} />
          <label htmlFor="ms-title" className="sr-only">
            Hito
          </label>
          <Input id="ms-title" name="title" placeholder="Nuevo hito" required />
          <label htmlFor="ms-due" className="sr-only">
            Fecha
          </label>
          <Input id="ms-due" name="dueDate" type="date" className="sm:w-44" />
          <Checkbox name="visibleToClient" defaultChecked label="Visible" className="sm:px-2" />
          <SubmitButton variant="secondary">Añadir</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

export async function DeliverablesView({ projectId, workspaceId, canManage }: { projectId: string; workspaceId: string; canManage: boolean }) {
  const [items, files] = await Promise.all([
    db.deliverable.findMany({ where: { projectId, workspaceId }, include: { reviews: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } }),
    db.fileAsset.findMany({ where: { projectId, workspaceId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
  ]);
  const fileMap = new Map(files.map((f) => [f.id, f]));
  return (
    <div className="grid gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Modal trigger="Crear entregable" title="Nuevo entregable" description="Adjunta un archivo del proyecto o un enlace. Al enviarlo, el cliente podrá aprobarlo o pedir cambios desde su portal.">
            <ActionForm action={createDeliverableAction} className="grid gap-4">
              <input type="hidden" name="projectId" value={projectId} />
              <Field label="Título" htmlFor="dl-title">
                <Input id="dl-title" name="title" required />
              </Field>
              <Field label="Descripción" htmlFor="dl-desc">
                <Textarea id="dl-desc" name="description" />
              </Field>
              <Field label="Archivo del proyecto" htmlFor="dl-file">
                <Select id="dl-file" name="fileId">
                  <option value="">Ninguno</option>
                  {files.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} (v{f.versions[0]?.version})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Enlace (Figma, Drive, web de pruebas…)" htmlFor="dl-link">
                <Input id="dl-link" name="link" type="url" />
              </Field>
              <Field label="Fecha prevista" htmlFor="dl-due">
                <Input id="dl-due" name="dueDate" type="date" />
              </Field>
              <SubmitButton>Crear entregable</SubmitButton>
            </ActionForm>
          </Modal>
        </div>
      )}
      {items.length === 0 ? (
        <Card>
          <EmptyState title="Sin entregables" description="Crea un entregable y envíalo al cliente para su aprobación." />
        </Card>
      ) : (
        items.map((d) => {
          const f = d.fileId ? fileMap.get(d.fileId) : null;
          return (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{d.title}</p>
                  {d.description && <p className="text-sm text-muted mt-0.5">{d.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                    {f?.versions[0] && (
                      <a href={`/api/files/${f.versions[0].id}`} className="inline-flex items-center gap-1 hover:underline underline-offset-2">
                        <Download className="size-3.5" /> {f.name} · v{f.versions[0].version}
                      </a>
                    )}
                    {d.link && (
                      <a href={d.link} target="_blank" rel="noreferrer" className="hover:underline underline-offset-2">
                        Abrir enlace
                      </a>
                    )}
                    {d.dueDate && <span className="text-muted">Previsto {date(d.dueDate)}</span>}
                    {d.revisionCount > 0 && <span className="text-muted">{d.revisionCount} revisión(es)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {canManage && (d.status === "DRAFT" || d.status === "CHANGES_REQUESTED") && (
                    <ActionButton action={submitDeliverableAction} fields={{ id: d.id }} variant="primary">
                      {d.status === "DRAFT" ? "Enviar a revisión" : "Reenviar"}
                    </ActionButton>
                  )}
                  {canManage && (
                    <ActionButton action={deleteDeliverableAction} fields={{ id: d.id }} variant="ghost" confirm="¿Eliminar el entregable?">
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Eliminar</span>
                    </ActionButton>
                  )}
                </div>
              </div>
              {d.reviews.length > 0 && (
                <ul className="mt-4 grid gap-2 border-t border-line pt-3">
                  {d.reviews.map((r) => (
                    <li key={r.id} className="text-sm">
                      <Badge tone={r.decision === "APPROVED" ? "ok" : "danger"}>{r.decision === "APPROVED" ? "Aprobado" : "Cambios"}</Badge>{" "}
                      <span className="text-muted">
                        {r.reviewerName} · {relative(r.createdAt)}
                      </span>
                      {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

export async function FilesView({ projectId, workspaceId, canManage }: { projectId: string; workspaceId: string; canManage: boolean }) {
  const files = await db.fileAsset.findMany({ where: { projectId, workspaceId }, include: { versions: { orderBy: { version: "desc" } } }, orderBy: [{ folder: "asc" }, { name: "asc" }] });
  const folders = [...new Set(files.map((f) => f.folder))];
  return (
    <div className="grid gap-4">
      {canManage && (
        <Card className="p-4">
          <ActionForm action={uploadFileAction} reset className="grid gap-3 sm:grid-cols-[1fr_180px_auto_auto] items-end">
            <input type="hidden" name="projectId" value={projectId} />
            <Field label="Archivos" htmlFor="up-file">
              <Input id="up-file" name="file" type="file" multiple required className="py-2 h-auto" />
            </Field>
            <Field label="Carpeta" htmlFor="up-folder">
              <Input id="up-folder" name="folder" defaultValue="General" list="folders" />
            </Field>
            <datalist id="folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <Checkbox name="visibleToClient" label="Visible para el cliente" className="pb-2.5" />
            <SubmitButton pendingLabel="Subiendo">
              <Upload className="size-4" /> Subir
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
      {files.length === 0 ? (
        <Card>
          <EmptyState title="Sin archivos" description="Los archivos que suba el cliente desde su portal también aparecerán aquí." />
        </Card>
      ) : (
        folders.map((folder) => (
          <Card key={folder}>
            <CardHeader title={folder} />
            <ul className="pb-2">
              {files
                .filter((f) => f.folder === folder)
                .map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 border-t border-line first:border-0">
                    <div className="min-w-0 flex-1">
                      <a href={`/api/files/${f.versions[0]?.id}`} className="text-sm font-medium hover:underline underline-offset-2 break-all">
                        {f.name}
                      </a>
                      <p className="text-[12px] text-muted">
                        v{f.versions[0]?.version} · {size(f.versions[0]?.size ?? 0)} · {relative(f.updatedAt)}
                        {f.source === "CLIENT" && " · subido por el cliente"}
                      </p>
                      {f.versions.length > 1 && (
                        <details className="mt-1 text-[12px]">
                          <summary className="cursor-pointer text-muted">Versiones anteriores</summary>
                          <ul className="mt-1 grid gap-0.5">
                            {f.versions.slice(1).map((v) => (
                              <li key={v.id}>
                                <a href={`/api/files/${v.id}`} className="hover:underline">
                                  v{v.version} · {dateTime(v.createdAt)}
                                  {v.note ? ` · ${v.note}` : ""}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <ActionButton action={toggleFileVisibilityAction} fields={{ id: f.id }} variant="ghost">
                          {f.visibleToClient ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          <span className="text-[12px]">{f.visibleToClient ? "Visible" : "Interno"}</span>
                        </ActionButton>
                        <Modal trigger="Nueva versión" triggerVariant="ghost" triggerSize="sm" title={`Nueva versión de ${f.name}`}>
                          <ActionForm action={uploadFileAction} className="grid gap-4">
                            <input type="hidden" name="projectId" value={projectId} />
                            <input type="hidden" name="fileId" value={f.id} />
                            <Field label="Archivo" htmlFor={`v-${f.id}`}>
                              <Input id={`v-${f.id}`} name="file" type="file" required className="py-2 h-auto" />
                            </Field>
                            <Field label="Qué cambia" htmlFor={`vn-${f.id}`}>
                              <Input id={`vn-${f.id}`} name="note" />
                            </Field>
                            <SubmitButton>Subir versión {f.versions[0]?.version + 1}</SubmitButton>
                          </ActionForm>
                        </Modal>
                        <ActionButton action={deleteFileAction} fields={{ id: f.id }} variant="ghost" confirm={`¿Eliminar ${f.name} y todas sus versiones?`}>
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </ActionButton>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

const DOC_KIND: Record<string, string> = { WELCOME: "Bienvenida", BRIEF: "Brief", PLAN: "Plan de trabajo", REPORT: "Informe", MEETING_NOTES: "Acta de reunión", OTHER: "Documento" };

export async function DocumentsView({ projectId, workspaceId, canManage, aiEnabled, openDoc }: { projectId: string; workspaceId: string; canManage: boolean; aiEnabled: boolean; openDoc?: string }) {
  const docs = await db.document.findMany({ where: { projectId, workspaceId }, orderBy: { updatedAt: "desc" } });
  const ai = aiEnabled && isAiConfigured();
  const docForm = (d?: (typeof docs)[number]) => (
    <ActionForm action={saveDocumentAction} className="grid gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      {d && <input type="hidden" name="id" value={d.id} />}
      <div className="grid sm:grid-cols-[1fr_180px] gap-3">
        <Field label="Título" htmlFor={`dt-${d?.id ?? "new"}`}>
          <Input id={`dt-${d?.id ?? "new"}`} name="title" defaultValue={d?.title} required />
        </Field>
        <Field label="Tipo" htmlFor={`dk-${d?.id ?? "new"}`}>
          <Select id={`dk-${d?.id ?? "new"}`} name="kind" defaultValue={d?.kind ?? "REPORT"}>
            {Object.entries(DOC_KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Contenido" htmlFor={`db-${d?.id ?? "new"}`}>
        <Textarea id={`db-${d?.id ?? "new"}`} name="body" defaultValue={d?.body} className="min-h-80" required />
      </Field>
      <Checkbox name="visibleToClient" defaultChecked={d?.visibleToClient} label="Publicar en el portal del cliente" />
      <SubmitButton>Guardar documento</SubmitButton>
    </ActionForm>
  );
  return (
    <div className="grid gap-4">
      {canManage && (
        <div className="flex flex-wrap gap-2 justify-end">
          {ai &&
            (["BRIEF", "PLAN", "REPORT"] as const).map((k) => (
              <Modal key={k} trigger={<><Sparkles className="size-3.5" /> {DOC_KIND[k]} con IA</>} triggerVariant="secondary" triggerSize="sm" title={`Generar ${DOC_KIND[k].toLowerCase()}`} description="La IA usa las tareas, hitos, entregables y respuestas del cliente de este proyecto.">
                <ActionForm action={generateDocumentAction} className="grid gap-4">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="kind" value={k} />
                  <Field label="Indicaciones (opcional)" htmlFor={`ai-${k}`}>
                    <Textarea id={`ai-${k}`} name="notes" placeholder="Tono, puntos que destacar, periodo del informe…" />
                  </Field>
                  <SubmitButton pendingLabel="Redactando">Generar borrador</SubmitButton>
                </ActionForm>
              </Modal>
            ))}
          <Modal trigger="Crear documento" triggerSize="sm" title="Nuevo documento" wide>
            {docForm()}
          </Modal>
        </div>
      )}
      {docs.length === 0 ? (
        <Card>
          <EmptyState title="Sin documentos" description="Briefs, planes de trabajo, informes de resultados y actas de reunión. Publícalos en el portal cuando estén listos." />
        </Card>
      ) : (
        docs.map((d) => (
          <Card key={d.id} className="p-5">
            <details open={openDoc === d.id}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                <span className="font-medium flex-1 min-w-0">{d.title}</span>
                <Badge>{DOC_KIND[d.kind] ?? d.kind}</Badge>
                {d.visibleToClient ? <Badge tone="accent">Publicado</Badge> : <Badge tone="warn">Borrador</Badge>}
                <span className="text-[12px] text-muted">{relative(d.updatedAt)}</span>
              </summary>
              <div className="mt-4 prose-doc text-ink-2 border-t border-line pt-4">{d.body}</div>
              {canManage && (
                <div className="mt-4 flex gap-2">
                  <Modal trigger="Editar" triggerVariant="secondary" triggerSize="sm" title="Editar documento" wide>
                    {docForm(d)}
                  </Modal>
                  <ActionButton action={deleteDocumentAction} fields={{ id: d.id }} variant="ghost" confirm="¿Eliminar el documento?">
                    Eliminar
                  </ActionButton>
                </div>
              )}
            </details>
          </Card>
        ))
      )}
    </div>
  );
}

const CR_TYPE: Record<string, string> = { MODIFICATION: "Modificación", SCOPE_EXTENSION: "Ampliación", NEW_SERVICE: "Nuevo servicio" };

export async function ChangesView({ projectId, workspaceId, canManage, currency }: { projectId: string; workspaceId: string; canManage: boolean; currency: string }) {
  const items = await db.changeRequest.findMany({ where: { projectId, workspaceId }, orderBy: { createdAt: "desc" } });
  return items.length === 0 ? (
    <Card>
      <EmptyState title="Sin solicitudes" description="Cuando el cliente pida una modificación o ampliación desde su portal aparecerá aquí para presupuestarla." />
    </Card>
  ) : (
    <div className="grid gap-3">
      {items.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{c.title}</p>
              <p className="text-[13px] text-muted">
                {CR_TYPE[c.type] ?? c.type} · {relative(c.createdAt)}
                {c.estimateAmount ? ` · ${money(c.estimateAmount, currency)}` : ""}
              </p>
              <p className="text-sm mt-2 whitespace-pre-wrap">{c.description}</p>
              {c.response && <p className="text-sm mt-2 text-muted whitespace-pre-wrap">Respuesta: {c.response}</p>}
              {c.proposalId && (
                <Link href={`/app/propuestas/${c.proposalId}`} className="text-[13px] underline underline-offset-2 mt-2 inline-block">
                  Ver propuesta de ampliación
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={c.status} />
              {canManage && (
                <Modal trigger="Responder" triggerVariant="secondary" triggerSize="sm" title="Responder solicitud">
                  <ActionForm action={respondChangeRequestAction} className="grid gap-4">
                    <input type="hidden" name="id" value={c.id} />
                    <Field label="Estado" htmlFor={`cs-${c.id}`}>
                      <Select id={`cs-${c.id}`} name="status" defaultValue={c.status}>
                        <option value="OPEN">Abierta</option>
                        <option value="QUOTED">Presupuestada</option>
                        <option value="APPROVED">Aprobada</option>
                        <option value="REJECTED">Rechazada</option>
                        <option value="DONE">Completada</option>
                      </Select>
                    </Field>
                    <Field label={`Presupuesto (${currency})`} htmlFor={`ce-${c.id}`}>
                      <Input id={`ce-${c.id}`} name="estimate" inputMode="decimal" defaultValue={c.estimateAmount ? (c.estimateAmount / 100).toFixed(2) : ""} />
                    </Field>
                    <Field label="Mensaje para el cliente" htmlFor={`cr-${c.id}`}>
                      <Textarea id={`cr-${c.id}`} name="response" defaultValue={c.response ?? ""} />
                    </Field>
                    {!c.proposalId && <Checkbox name="createProposal" label="Crear una propuesta de ampliación con este presupuesto" />}
                    <SubmitButton>Guardar y avisar al cliente</SubmitButton>
                  </ActionForm>
                </Modal>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export async function MeetingsView({ projectId, workspaceId, canManage, aiEnabled }: { projectId: string; workspaceId: string; canManage: boolean; aiEnabled: boolean }) {
  const meetings = await db.meeting.findMany({ where: { projectId, workspaceId }, orderBy: { startsAt: "desc" } });
  const ai = aiEnabled && isAiConfigured();
  return (
    <div className="grid gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Modal trigger="Programar reunión" title="Nueva reunión">
            <ActionForm action={createMeetingAction} className="grid gap-4">
              <input type="hidden" name="projectId" value={projectId} />
              <Field label="Título" htmlFor="m-title">
                <Input id="m-title" name="title" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha y hora" htmlFor="m-start">
                  <Input id="m-start" name="startsAt" type="datetime-local" required />
                </Field>
                <Field label="Duración" htmlFor="m-dur">
                  <Select id="m-dur" name="duration" defaultValue="45">
                    {[15, 30, 45, 60, 90, 120].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Enlace de videollamada" htmlFor="m-video" hint="Si lo dejas vacío se usa tu sala por defecto de Integraciones.">
                <Input id="m-video" name="videoUrl" type="url" placeholder="https://meet.google.com/…" />
              </Field>
              <Field label="Orden del día" htmlFor="m-desc">
                <Textarea id="m-desc" name="description" />
              </Field>
              <Checkbox name="visibleToClient" defaultChecked label="Mostrar en el portal del cliente" />
              <SubmitButton>Programar</SubmitButton>
            </ActionForm>
          </Modal>
        </div>
      )}
      {meetings.length === 0 ? (
        <Card>
          <EmptyState title="Sin reuniones" />
        </Card>
      ) : (
        meetings.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-[13px] text-muted">{dateTime(m.startsAt)}</p>
                {m.videoUrl && (
                  <a href={m.videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] hover:underline underline-offset-2">
                    <Video className="size-3.5" /> Unirse
                  </a>
                )}
              </div>
              <StatusBadge status={m.status} />
            </div>
            {m.summary && <div className="mt-4 rounded-[10px] bg-surface p-4 prose-doc text-sm">{m.summary}</div>}
            {canManage && (
              <ActionForm action={updateMeetingAction} className="mt-4 grid gap-2">
                <input type="hidden" name="id" value={m.id} />
                <label htmlFor={`notes-${m.id}`} className="text-[13px] font-medium text-ink-2">
                  Notas o transcripción
                </label>
                <Textarea id={`notes-${m.id}`} name="notes" defaultValue={m.notes ?? ""} className="min-h-24" />
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`ms-${m.id}`} className="sr-only">
                    Estado
                  </label>
                  <Select id={`ms-${m.id}`} name="status" defaultValue={m.status} className="w-40 h-9">
                    <option value="SCHEDULED">Programada</option>
                    <option value="DONE">Realizada</option>
                    <option value="CANCELED">Cancelada</option>
                  </Select>
                  <SubmitButton variant="secondary" size="sm">
                    Guardar
                  </SubmitButton>
                </div>
              </ActionForm>
            )}
            {canManage && ai && m.notes && (
              <div className="mt-2">
                <ActionButton action={summarizeMeetingAction} fields={{ id: m.id }}>
                  <Sparkles className="size-3.5" /> Resumir con IA
                </ActionButton>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
