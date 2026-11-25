"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare, ListTree, User } from "lucide-react";
import { cx, PriorityDot } from "@/components/ui";

type Task = { id: string; title: string; status: string; priority: string; dueDate: string | null; assignee: string | null; forClient: boolean; subtasks: number; subtasksDone: number; comments: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Act = (prev: any, fd: FormData) => Promise<{ ok?: boolean; error?: string } | null>;

const COLUMNS = [
  { id: "TODO", label: "Por hacer" },
  { id: "IN_PROGRESS", label: "En curso" },
  { id: "REVIEW", label: "En revisión" },
  { id: "BLOCKED", label: "Bloqueadas" },
  { id: "DONE", label: "Hechas" },
];

export function TaskBoard({ tasks, projectId, setStatus }: { tasks: Task[]; projectId: string; setStatus: Act }) {
  const [list, setOpt] = useOptimistic(tasks, (s, u: { id: string; status: string }) => s.map((t) => (t.id === u.id ? { ...t, status: u.status } : t)));
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const move = (id: string, status: string) => {
    if (list.find((t) => t.id === id)?.status === status) return;
    start(async () => {
      setOpt({ id, status });
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", status);
      const r = await setStatus(null, fd);
      if (r?.error) toast.error(r.error);
    });
  };
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scroll-thin pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(250px,1fr)] gap-3">
        {COLUMNS.map((c) => {
          const items = list.filter((t) => t.status === c.id);
          return (
            <section
              key={c.id}
              aria-label={c.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(c.id);
              }}
              onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(e.dataTransfer.getData("text/plain"), c.id);
              }}
              className={cx("rounded-[14px] border p-2 min-h-[360px] transition-colors", over === c.id ? "border-ink/40 bg-accent/20" : "border-transparent bg-surface-2/60")}
            >
              <h3 className="px-1.5 pt-1 pb-2 text-sm font-medium font-sans tracking-normal">
                {c.label} <span className="text-faint tabular-nums">{items.length}</span>
              </h3>
              <ul className="grid gap-2">
                {items.map((t) => {
                  const late = t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < new Date();
                  return (
                    <li
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                      className="lift rounded-[10px] border border-line bg-white shadow-card"
                    >
                      <Link href={`/app/proyectos/${projectId}?tarea=${t.id}`} scroll={false} className="block p-3">
                        <p className={cx("text-sm leading-snug", t.status === "DONE" && "text-muted line-through decoration-line-strong")}>{t.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                          <PriorityDot priority={t.priority} />
                          {t.dueDate && <span className={late ? "text-danger" : ""}>{new Date(t.dueDate).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>}
                          {t.subtasks > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <ListTree className="size-3" /> {t.subtasksDone}/{t.subtasks}
                            </span>
                          )}
                          {t.comments > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="size-3" /> {t.comments}
                            </span>
                          )}
                          {t.forClient ? (
                            <span className="rounded-full bg-accent px-1.5 text-accent-ink">Cliente</span>
                          ) : (
                            t.assignee && (
                              <span className="inline-flex items-center gap-1">
                                <User className="size-3" /> {t.assignee.split(" ")[0]}
                              </span>
                            )
                          )}
                        </div>
                      </Link>
                      <label className="sr-only" htmlFor={`st-${t.id}`}>
                        Estado
                      </label>
                      <select id={`st-${t.id}`} value={t.status} onChange={(e) => move(t.id, e.target.value)} className="mx-3 mb-3 w-[calc(100%-24px)] rounded-[8px] border border-line bg-surface px-2 h-8 text-[12px] lg:hidden">
                        {COLUMNS.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
