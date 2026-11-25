import { db } from "@/lib/db";
import { inputDate, relative } from "@/lib/format";
import { RouteSheet } from "@/components/route-sheet";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Checkbox, Field, Input, Select, Textarea, StatusBadge } from "@/components/ui";
import { addCommentAction, createTaskAction, deleteTaskAction, logTimeAction, setTaskStatusAction, updateTaskAction } from "../actions";

export async function TaskSheet({
  taskId,
  workspaceId,
  projectId,
  stages,
  members,
  closeHref,
}: {
  taskId: string;
  workspaceId: string;
  projectId: string;
  stages: { id: string; name: string }[];
  members: { id: string; name: string }[];
  closeHref: string;
}) {
  const t = await db.task.findFirst({
    where: { id: taskId, workspaceId, projectId },
    include: { subtasks: { orderBy: { createdAt: "asc" } }, comments: { orderBy: { createdAt: "asc" } }, timeEntries: true, parent: true },
  });
  if (!t) return null;
  const names = new Map(members.map((m) => [m.id, m.name]));
  const hours = t.timeEntries.reduce((s, e) => s + e.minutes, 0) / 60;
  return (
    <RouteSheet closeHref={closeHref} title={t.parent ? `Subtarea de «${t.parent.title}»` : "Tarea"}>
      <ActionForm action={updateTaskAction} className="grid gap-4">
        <input type="hidden" name="id" value={t.id} />
        <Field label="Título" htmlFor="t-title">
          <Input id="t-title" name="title" defaultValue={t.title} required className="font-medium" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado" htmlFor="t-status">
            <Select id="t-status" name="status" defaultValue={t.status}>
              <option value="TODO">Por hacer</option>
              <option value="IN_PROGRESS">En curso</option>
              <option value="REVIEW">En revisión</option>
              <option value="BLOCKED">Bloqueada</option>
              <option value="DONE">Hecha</option>
            </Select>
          </Field>
          <Field label="Prioridad" htmlFor="t-prio">
            <Select id="t-prio" name="priority" defaultValue={t.priority}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </Select>
          </Field>
          <Field label="Responsable" htmlFor="t-assignee">
            <Select id="t-assignee" name="assigneeId" defaultValue={t.assigneeId ?? ""}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Etapa" htmlFor="t-stage">
            <Select id="t-stage" name="stageId" defaultValue={t.stageId ?? ""}>
              <option value="">Sin etapa</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Inicio" htmlFor="t-start">
            <Input id="t-start" name="startDate" type="date" defaultValue={inputDate(t.startDate)} />
          </Field>
          <Field label="Fecha límite" htmlFor="t-due">
            <Input id="t-due" name="dueDate" type="date" defaultValue={inputDate(t.dueDate)} />
          </Field>
          <Field label="Estimación (h)" htmlFor="t-est">
            <Input id="t-est" name="estimateHours" type="number" min={0} step={0.25} defaultValue={t.estimateHours ?? ""} />
          </Field>
          <div className="grid content-end pb-2 text-sm text-muted">{hours > 0 ? `${hours.toFixed(2)} h registradas` : "Sin horas registradas"}</div>
        </div>
        <Field label="Descripción" htmlFor="t-desc">
          <Textarea id="t-desc" name="description" defaultValue={t.description ?? ""} />
        </Field>
        <Checkbox name="forClient" defaultChecked={t.forClient} label="Es una tarea pendiente del cliente (aparece en su portal)" />
        <Checkbox name="visibleToClient" defaultChecked={t.visibleToClient} label="Visible en el cronograma del portal" />
        <div className="flex justify-end gap-2">
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </ActionForm>
      <div className="mt-3">
        <ActionButton action={deleteTaskAction} fields={{ id: t.id }} variant="danger" confirm="¿Eliminar esta tarea y sus subtareas?">
          Eliminar tarea
        </ActionButton>
      </div>

      {!t.parentId && (
        <section className="mt-8">
          <h3 className="text-sm font-medium font-sans tracking-normal mb-2">Subtareas</h3>
          <ul className="grid gap-1.5 mb-2">
            {t.subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <ActionButton action={setTaskStatusAction} fields={{ id: s.id, status: s.status === "DONE" ? "TODO" : "DONE" }} variant="ghost" className="px-1.5">
                  <span className={`grid size-4 place-items-center rounded border ${s.status === "DONE" ? "bg-ink border-ink text-white" : "border-line-strong"}`} aria-hidden>
                    {s.status === "DONE" ? "✓" : ""}
                  </span>
                  <span className="sr-only">{s.status === "DONE" ? "Reabrir" : "Completar"}</span>
                </ActionButton>
                <span className={`flex-1 text-sm ${s.status === "DONE" ? "line-through text-muted" : ""}`}>{s.title}</span>
                {s.assigneeId && <span className="text-[12px] text-muted">{names.get(s.assigneeId)?.split(" ")[0]}</span>}
              </li>
            ))}
          </ul>
          <ActionForm action={createTaskAction} reset className="flex gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="parentId" value={t.id} />
            <input type="hidden" name="stageId" value={t.stageId ?? ""} />
            <label htmlFor="sub-title" className="sr-only">
              Nueva subtarea
            </label>
            <Input id="sub-title" name="title" placeholder="Añadir subtarea" required />
            <SubmitButton variant="secondary">Añadir</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="mt-8">
        <h3 className="text-sm font-medium font-sans tracking-normal mb-2">Registrar tiempo</h3>
        <ActionForm action={logTimeAction} reset className="grid grid-cols-[90px_1fr_auto] gap-2">
          <input type="hidden" name="taskId" value={t.id} />
          <label htmlFor="hours" className="sr-only">
            Horas
          </label>
          <Input id="hours" name="hours" inputMode="decimal" placeholder="Horas" required />
          <label htmlFor="time-note" className="sr-only">
            Nota
          </label>
          <Input id="time-note" name="note" placeholder="Qué hiciste (opcional)" />
          <SubmitButton variant="secondary">Registrar</SubmitButton>
        </ActionForm>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-medium font-sans tracking-normal mb-3">Comentarios</h3>
        <ol className="grid gap-4 mb-3">
          {t.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={names.get(c.userId) ?? "?"} size={26} />
              <div className="min-w-0">
                <p className="text-[13px]">
                  <span className="font-medium">{names.get(c.userId) ?? "Usuario"}</span> <span className="text-faint">{relative(c.createdAt)}</span>
                </p>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <ActionForm action={addCommentAction} reset className="grid gap-2">
          <input type="hidden" name="taskId" value={t.id} />
          <label htmlFor="comment" className="sr-only">
            Comentario
          </label>
          <Textarea id="comment" name="body" placeholder="Escribe un comentario" className="min-h-16" required />
          <SubmitButton variant="secondary" size="sm" className="justify-self-end">
            Comentar
          </SubmitButton>
        </ActionForm>
      </section>
      <p className="mt-6 text-[12px] text-faint">
        Estado actual: <StatusBadge status={t.status} />
      </p>
    </RouteSheet>
  );
}
