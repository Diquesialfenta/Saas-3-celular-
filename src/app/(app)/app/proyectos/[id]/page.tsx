import { stringList } from "@/lib/string-list";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, inputDate, money } from "@/lib/format";
import { ActionButton, ActionForm, AutoSubmitSelect, Modal, SubmitButton } from "@/components/forms";
import { Card, Checkbox, Field, Input, PageHeader, Progress, Select, Tabs, Textarea, ButtonLink } from "@/components/ui";
import { createTaskAction, deleteProjectAction, setProjectStatusAction, setTaskStatusAction, updateProjectAction } from "../actions";
import { TaskBoard } from "./task-board";
import { TaskSheet } from "./task-sheet";
import { StagesView, MilestonesView, DeliverablesView, FilesView, DocumentsView, ChangesView, MeetingsView } from "./views";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vista?: string; tarea?: string; doc?: string }> }) {
  const { id } = await params;
  const { vista = "tablero", tarea, doc } = await searchParams;
  const ctx = await requireWorkspace();
  const project = await db.project.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      client: true,
      stages: { orderBy: { sortOrder: "asc" } },
      milestones: { orderBy: { dueDate: "asc" } },
      tasks: {
        where: { parentId: null },
        include: { subtasks: { select: { status: true } }, _count: { select: { comments: true } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!project) notFound();
  if (!ctx.can("projects.view_all") && project.managerId !== ctx.user.id && !project.tasks.some((t) => t.assigneeId === ctx.user.id)) notFound();
  const members = await db.membership.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { id: true, name: true } } } });
  const names = new Map(members.map((m) => [m.user.id, m.user.name]));
  const [counts, hours] = await Promise.all([
    Promise.all([
      db.deliverable.count({ where: { projectId: id } }),
      db.fileAsset.count({ where: { projectId: id, workspaceId: ctx.workspaceId } }),
      db.document.count({ where: { projectId: id, workspaceId: ctx.workspaceId } }),
      db.changeRequest.count({ where: { projectId: id, workspaceId: ctx.workspaceId, status: { in: ["OPEN", "QUOTED"] } } }),
      db.meeting.count({ where: { projectId: id, workspaceId: ctx.workspaceId } }),
    ]),
    db.timeEntry.aggregate({ where: { task: { projectId: id } }, _sum: { minutes: true } }),
  ]);
  const [nDeliv, nFiles, nDocs, nChanges, nMeet] = counts;
  const done = project.tasks.filter((t) => t.status === "DONE").length;
  const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0;
  const base = `/app/proyectos/${id}`;
  const tabs = [
    { href: base, label: "Tablero", count: project.tasks.length },
    { href: `${base}?vista=etapas`, label: "Etapas" },
    { href: `${base}?vista=hitos`, label: "Hitos", count: project.milestones.length },
    { href: `${base}?vista=entregables`, label: "Entregables", count: nDeliv },
    { href: `${base}?vista=archivos`, label: "Archivos", count: nFiles },
    { href: `${base}?vista=documentos`, label: "Documentos", count: nDocs },
    { href: `${base}?vista=cambios`, label: "Solicitudes", count: nChanges },
    { href: `${base}?vista=reuniones`, label: "Reuniones", count: nMeet },
  ];
  const current = vista === "tablero" ? base : `${base}?vista=${vista}`;
  const canManage = ctx.can("projects.manage");

  return (
    <>
      <PageHeader
        back={{ href: "/app/proyectos", label: "Proyectos" }}
        title={project.name}
        description={
          <>
            <Link href={`/app/clientes/${project.clientId}`} className="hover:underline underline-offset-2">
              {project.client.name}
            </Link>
            {project.dueDate && ` · entrega ${date(project.dueDate, { dateStyle: "long" })}`}
          </>
        }
        actions={
          <>
            {canManage && (
              <ActionForm action={setProjectStatusAction}>
                <input type="hidden" name="id" value={project.id} />
                <label htmlFor="p-status" className="sr-only">
                  Estado del proyecto
                </label>
                <AutoSubmitSelect id="p-status" name="status" defaultValue={project.status}>
                  <option value="PLANNING">Planificación</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="ON_HOLD">En pausa</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="CANCELED">Cancelado</option>
                </AutoSubmitSelect>
              </ActionForm>
            )}
            {ctx.can("billing.manage") && (
              <ButtonLink href={`/app/facturacion/nueva?cliente=${project.clientId}&proyecto=${project.id}`} variant="secondary">
                Facturar
              </ButtonLink>
            )}
            {canManage && (
              <Modal trigger="Editar" triggerVariant="secondary" title="Editar proyecto" wide>
                <ActionForm action={updateProjectAction} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={project.id} />
                  <input type="hidden" name="status" value={project.status} />
                  <Field label="Nombre" htmlFor="e-name" className="sm:col-span-2">
                    <Input id="e-name" name="name" defaultValue={project.name} required />
                  </Field>
                  <Field label="Responsable" htmlFor="e-manager">
                    <Select id="e-manager" name="managerId" defaultValue={project.managerId ?? ""}>
                      <option value="">Sin responsable</option>
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={`Presupuesto (${ctx.workspace.currency})`} htmlFor="e-budget">
                    <Input id="e-budget" name="budget" inputMode="decimal" defaultValue={project.budget ? (project.budget / 100).toFixed(2) : ""} />
                  </Field>
                  <Field label="Inicio" htmlFor="e-start">
                    <Input id="e-start" name="startDate" type="date" defaultValue={inputDate(project.startDate)} />
                  </Field>
                  <Field label="Entrega" htmlFor="e-due">
                    <Input id="e-due" name="dueDate" type="date" defaultValue={inputDate(project.dueDate)} />
                  </Field>
                  <Field label="Descripción" htmlFor="e-desc" className="sm:col-span-2">
                    <Textarea id="e-desc" name="description" defaultValue={project.description ?? ""} />
                  </Field>
                  <Field label="Objetivos (uno por línea)" htmlFor="e-obj" className="sm:col-span-2">
                    <Textarea id="e-obj" name="objectives" defaultValue={stringList(project.objectives).join("\n")} />
                  </Field>
                  <Checkbox name="visibleToClient" defaultChecked={project.visibleToClient} label="Visible en el portal del cliente" className="sm:col-span-2" />
                  <div className="sm:col-span-2 flex justify-end">
                    <SubmitButton>Guardar</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-6 border-t border-line pt-4">
                  <ActionButton action={deleteProjectAction} fields={{ id: project.id }} variant="danger" confirm="¿Eliminar el proyecto con todas sus tareas, entregables y archivos?">
                    Eliminar proyecto
                  </ActionButton>
                </div>
              </Modal>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="p-4 col-span-2">
          <div className="flex justify-between text-[13px] text-muted mb-2">
            <span>Progreso</span>
            <span className="tabular-nums">
              {done}/{project.tasks.length} tareas · {pct} %
            </span>
          </div>
          <Progress value={pct} />
          {stringList(project.objectives).length > 0 && <p className="text-[13px] text-muted mt-3 truncate">Objetivos: {stringList(project.objectives).join(" · ")}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Responsable</p>
          <p className="mt-1 text-sm font-medium truncate">{project.managerId ? names.get(project.managerId) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-muted">Horas registradas</p>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {((hours._sum.minutes ?? 0) / 60).toFixed(1)} h{project.budget ? ` · ${money(project.budget, ctx.workspace.currency)}` : ""}
          </p>
        </Card>
      </div>

      <Tabs items={tabs} current={current} />

      {vista === "tablero" && (
        <>
          {ctx.can("tasks.manage") && (
            <ActionForm action={createTaskAction} reset className="mb-4 flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="projectId" value={project.id} />
              <label htmlFor="quick-task" className="sr-only">
                Nueva tarea
              </label>
              <Input id="quick-task" name="title" placeholder="Añadir una tarea y pulsar Intro" required className="flex-1" />
              <label htmlFor="quick-assignee" className="sr-only">
                Responsable
              </label>
              <Select id="quick-assignee" name="assigneeId" defaultValue={ctx.user.id} className="sm:w-48">
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
              <label htmlFor="quick-due" className="sr-only">
                Fecha límite
              </label>
              <Input id="quick-due" name="dueDate" type="date" className="sm:w-44" />
              <SubmitButton variant="secondary">Añadir</SubmitButton>
            </ActionForm>
          )}
          <TaskBoard
            projectId={project.id}
            setStatus={setTaskStatusAction}
            tasks={project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate?.toISOString() ?? null,
              assignee: t.assigneeId ? (names.get(t.assigneeId) ?? null) : null,
              forClient: t.forClient,
              subtasks: t.subtasks.length,
              subtasksDone: t.subtasks.filter((s) => s.status === "DONE").length,
              comments: t._count.comments,
            }))}
          />
        </>
      )}
      {vista === "etapas" && <StagesView project={project} names={names} canManage={canManage} />}
      {vista === "hitos" && <MilestonesView project={project} canManage={canManage} />}
      {vista === "entregables" && <DeliverablesView projectId={project.id} workspaceId={ctx.workspaceId} canManage={canManage} />}
      {vista === "archivos" && <FilesView projectId={project.id} workspaceId={ctx.workspaceId} canManage={ctx.can("files.manage")} />}
      {vista === "documentos" && <DocumentsView projectId={project.id} workspaceId={ctx.workspaceId} canManage={canManage} aiEnabled={ctx.can("ai.use")} openDoc={doc} />}
      {vista === "cambios" && <ChangesView projectId={project.id} workspaceId={ctx.workspaceId} canManage={canManage} currency={ctx.workspace.currency} />}
      {vista === "reuniones" && <MeetingsView projectId={project.id} workspaceId={ctx.workspaceId} canManage={canManage} aiEnabled={ctx.can("ai.use")} />}

      {tarea && <TaskSheet taskId={tarea} workspaceId={ctx.workspaceId} projectId={project.id} stages={project.stages} members={members.map((m) => m.user)} closeHref={current} />}
    </>
  );
}
