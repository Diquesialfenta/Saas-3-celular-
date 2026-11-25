import "server-only";
import type { Priority } from "@prisma/client";
import { db } from "../db";
import type { ProjectTemplate } from "../templates";
import { activity } from "../audit";
import { emit } from "../automations";

const addDays = (d: Date, n = 0) => new Date(d.getTime() + n * 86400_000);

export async function createProject(input: {
  workspaceId: string;
  clientId: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  budget?: number | null;
  managerId?: string | null;
  contractId?: string | null;
  createdById?: string | null;
}) {
  const start = input.startDate ?? new Date();
  let tpl: ProjectTemplate | null = null;
  if (input.templateId) {
    const t = await db.template.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId, type: "PROJECT" } });
    tpl = (t?.content as ProjectTemplate) ?? null;
  }
  const lastOffset = tpl
    ? Math.max(0, ...tpl.stages.flatMap((s) => s.tasks.map((t) => t.offsetDays ?? 0)), ...tpl.milestones.map((m) => m.offsetDays))
    : 0;
  const managerId =
    input.managerId ??
    input.createdById ??
    (await db.membership.findFirst({ where: { workspaceId: input.workspaceId, role: "OWNER" }, select: { userId: true } }))?.userId ??
    null;
  const project = await db.project.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      objectives: tpl?.objectives ?? [],
      status: "ACTIVE",
      startDate: start,
      dueDate: input.dueDate ?? (tpl && lastOffset ? addDays(start, lastOffset) : null),
      budget: input.budget ?? null,
      managerId,
      contractId: input.contractId ?? null,
    },
  });
  if (tpl) {
    for (const [si, stage] of tpl.stages.entries()) {
      const s = await db.stage.create({ data: { projectId: project.id, name: stage.name, sortOrder: si } });
      await db.task.createMany({
        data: stage.tasks.map((t, ti) => ({
          workspaceId: input.workspaceId,
          projectId: project.id,
          stageId: s.id,
          title: t.title,
          priority: (t.priority as Priority) ?? "MEDIUM",
          forClient: !!t.forClient,
          visibleToClient: !!t.forClient,
          dueDate: addDays(start, t.offsetDays ?? 0),
          sortOrder: ti,
          assigneeId: t.forClient ? null : managerId,
          createdById: input.createdById ?? null,
        })),
      });
    }
    await db.milestone.createMany({
      data: tpl.milestones.map((m) => ({ projectId: project.id, title: m.title, dueDate: addDays(start, m.offsetDays) })),
    });
  } else {
    for (const [i, name] of ["Por hacer", "En curso", "Entrega"].entries()) {
      await db.stage.create({ data: { projectId: project.id, name, sortOrder: i } });
    }
  }
  await activity({ workspaceId: input.workspaceId, clientId: input.clientId, projectId: project.id, content: `Proyecto "${project.name}" creado` });
  return project;
}

export async function projectProgress(projectId: string) {
  const [total, done] = await Promise.all([
    db.task.count({ where: { projectId, parentId: null } }),
    db.task.count({ where: { projectId, parentId: null, status: "DONE" } }),
  ]);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export async function completeProject(workspaceId: string, projectId: string) {
  const project = await db.project.update({
    where: { id: projectId, workspaceId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await activity({ workspaceId, clientId: project.clientId, projectId, content: `Proyecto "${project.name}" completado` });
  await emit(workspaceId, "project.completed", { clientId: project.clientId, projectId });
  return project;
}
