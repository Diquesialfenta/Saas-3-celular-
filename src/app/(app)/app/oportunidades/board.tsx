"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";

type Deal = { id: string; title: string; value: number; currency: string; stage: string; clientId: string; clientName: string; probability: number; expectedCloseDate: string | null };
type Stage = { id: string; label: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Act = (prev: any, fd: FormData) => Promise<{ ok?: boolean; error?: string; message?: string } | null>;

const fmt = (cents: number, cur: string) => new Intl.NumberFormat("es", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(cents / 100);

export function DealBoard({ deals, stages, move, currency }: { deals: Deal[]; stages: readonly Stage[]; move: Act; currency: string }) {
  const [optimistic, setOptimistic] = useOptimistic(deals, (state, u: { id: string; stage: string }) => state.map((d) => (d.id === u.id ? { ...d, stage: u.stage } : d)));
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const drop = (stage: string, id: string) => {
    const deal = optimistic.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    start(async () => {
      setOptimistic({ id, stage });
      const fd = new FormData();
      fd.set("id", id);
      fd.set("stage", stage);
      const r = await move(null, fd);
      if (r?.error) toast.error(r.error);
      else if (r?.message) toast.success(r.message);
    });
  };

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scroll-thin pb-4">
      <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 min-w-max lg:min-w-0">
        {stages.map((s) => {
          const items = optimistic.filter((d) => d.stage === s.id);
          const total = items.reduce((a, d) => a + d.value, 0);
          return (
            <section
              key={s.id}
              aria-label={s.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                drop(s.id, e.dataTransfer.getData("text/plain"));
              }}
              className={cx("flex flex-col rounded-[14px] border bg-surface-2/60 transition-colors min-h-[420px]", over === s.id ? "border-ink/40 bg-accent/20" : "border-transparent")}
            >
              <header className="flex items-baseline justify-between px-3.5 pt-3 pb-2">
                <h2 className="text-sm font-medium font-sans tracking-normal">
                  {s.label} <span className="text-faint tabular-nums">{items.length}</span>
                </h2>
                <span className="text-[12px] text-muted tabular-nums">{fmt(total, currency)}</span>
              </header>
              <ul className="grid gap-2 px-2 pb-2 content-start">
                {items.map((d) => (
                  <li
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", d.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(d.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cx("lift cursor-grab active:cursor-grabbing rounded-[10px] border border-line bg-white p-3 shadow-card", dragging === d.id && "opacity-50")}
                  >
                    <p className="text-sm font-medium leading-snug">{d.title}</p>
                    <Link href={`/app/clientes/${d.clientId}`} className="text-[13px] text-muted hover:text-ink">
                      {d.clientName}
                    </Link>
                    <div className="mt-2.5 flex items-center justify-between text-[12px]">
                      <span className="font-medium tabular-nums">{fmt(d.value, d.currency)}</span>
                      <span className="text-muted">{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString("es", { day: "numeric", month: "short" }) : `${d.probability}%`}</span>
                    </div>
                    <label className="sr-only" htmlFor={`stage-${d.id}`}>
                      Mover a
                    </label>
                    <select
                      id={`stage-${d.id}`}
                      value={d.stage}
                      onChange={(e) => drop(e.target.value, d.id)}
                      className="mt-2 w-full rounded-[8px] border border-line bg-surface px-2 h-8 text-[12px] lg:hidden"
                    >
                      {stages.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
