import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CheckSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date } from "@/lib/format";
import { ActionButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, PriorityDot, StatusBadge, Tabs, cx } from "@/components/ui";
import { setTaskStatusAction } from "../proyectos/actions";

export const metadata = { title: "Mis tareas" };

export default async function MyTasks({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace();
  const { vista } = await searchParams;
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 86400_000);
  const base: Prisma.TaskWhereInput = { workspaceId: ctx.workspaceId, assigneeId: ctx.user.id };
  const where: Prisma.TaskWhereInput =
    vista === "hechas" ? { ...base, status: "DONE" } : vista === "cliente" ? { workspaceId: ctx.workspaceId, forClient: true, status: { not: "DONE" }, project: ctx.can("projects.view_all") ? {} : { managerId: ctx.user.id } } : { ...base, status: { not: "DONE" } };
  const tasks = await db.task.findMany({
    where,
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } }, parent: { select: { title: true } } },
    orderBy: vista === "hechas" ? { completedAt: "desc" } : [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
    take: 200,
  });
  const groups =
    vista === "hechas" || vista === "cliente"
      ? [{ label: null as string | null, items: tasks }]
      : [
          { label: "Atrasadas", items: tasks.filter((t) => t.dueDate && t.dueDate < new Date(now.toDateString())) },
          { label: "Esta semana", items: tasks.filter((t) => t.dueDate && t.dueDate >= new Date(now.toDateString()) && t.dueDate <= endOfWeek) },
          { label: "Más adelante", items: tasks.filter((t) => t.dueDate && t.dueDate > endOfWeek) },
          { label: "Sin fecha", items: tasks.filter((t) => !t.dueDate) },
        ];
  return (
    <>
      <PageHeader title="Mis tareas" description="Todo lo que tienes asignado en todos los proyectos." />
      <Tabs
        current={vista ? `/app/tareas?vista=${vista}` : "/app/tareas"}
        items={[
          { href: "/app/tareas", label: "Pendientes" },
          { href: "/app/tareas?vista=cliente", label: "Pendientes del cliente" },
          { href: "/app/tareas?vista=hechas", label: "Hechas" },
        ]}
      />
      {tasks.length === 0 ? (
        <Card>
          <EmptyState icon={<CheckSquare className="size-5" />} title="Nada por aquí" description="Cuando te asignen tareas aparecerán ordenadas por fecha." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <Card key={g.label ?? "all"}>
                {g.label && <p className={cx("px-5 pt-4 pb-1 text-[13px] font-medium", g.label === "Atrasadas" ? "text-danger" : "text-muted")}>{g.label}</p>}
                <ul className="py-1">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-3 sm:px-5 py-2 hover:bg-surface/60">
                      {vista !== "cliente" && (
                        <ActionButton action={setTaskStatusAction} fields={{ id: t.id, status: t.status === "DONE" ? "TODO" : "DONE" }} variant="ghost" className="px-1.5">
                          <span className={`grid size-[18px] place-items-center rounded-full border ${t.status === "DONE" ? "bg-ink border-ink text-white text-[10px]" : "border-line-strong"}`} aria-hidden>
                            {t.status === "DONE" ? "✓" : ""}
                          </span>
                          <span className="sr-only">{t.status === "DONE" ? "Reabrir" : "Completar"}</span>
                        </ActionButton>
                      )}
                      <Link href={`/app/proyectos/${t.project.id}?tarea=${t.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{t.title}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {t.project.client.name} · {t.project.name}
                          {t.parent ? ` · ${t.parent.title}` : ""}
                        </span>
                      </Link>
                      <span className="hidden sm:block">
                        <StatusBadge status={t.status} />
                      </span>
                      <PriorityDot priority={t.priority} />
                      <span className="w-16 text-right text-[13px] text-muted tabular-nums">{t.dueDate ? date(t.dueDate, { day: "numeric", month: "short" }) : "—"}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}
