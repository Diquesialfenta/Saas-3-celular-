"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Textarea, cx } from "@/components/ui";

type Act = Parameters<typeof ActionForm>[0]["action"];

export function BookingPicker(p: {
  slug: string;
  days: { date: string; label: string; slots: string[] }[];
  timeZone: string;
  action: Act;
  clientId?: string;
  defaultName: string;
  defaultEmail: string;
  brandColor: string;
}) {
  const [day, setDay] = useState(p.days[0]?.date);
  const [slot, setSlot] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const current = p.days.find((d) => d.date === day);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: p.timeZone });
  if (done) {
    return (
      <Card className="mt-8 p-6 bg-ok-bg border-ok/20">
        <p className="font-medium text-ok">Reunión confirmada</p>
        <p className="text-sm mt-1">
          {slot && new Date(slot).toLocaleString("es", { dateStyle: "full", timeStyle: "short", timeZone: p.timeZone })}. Te enviamos los detalles y el enlace por correo.
        </p>
      </Card>
    );
  }
  if (p.days.length === 0) return <Card className="mt-8 p-6 text-muted">No hay huecos disponibles en las próximas semanas. Escribe directamente al proveedor.</Card>;
  return (
    <div className="mt-8 grid gap-6">
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-1" role="tablist" aria-label="Días">
        {p.days.map((d) => (
          <button
            key={d.date}
            role="tab"
            aria-selected={d.date === day}
            onClick={() => {
              setDay(d.date);
              setSlot(null);
            }}
            className={cx("press shrink-0 rounded-[12px] border px-4 py-2.5 text-left text-sm capitalize transition-colors", d.date === day ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-surface")}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div>
        <p className="text-[13px] text-muted mb-2">Horario de {p.timeZone.replace("_", " ")}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {current?.slots.map((s) => (
            <button key={s} onClick={() => setSlot(s)} className={cx("press h-11 rounded-[10px] border text-sm tabular-nums transition-colors", slot === s ? "border-ink bg-accent" : "border-line bg-white hover:bg-surface")}>
              {time(s)}
            </button>
          ))}
        </div>
      </div>
      {slot && (
        <Card className="pop p-6">
          <ActionForm action={p.action} className="grid gap-4" onDone={() => setDone(true)}>
            <input type="hidden" name="slug" value={p.slug} />
            <input type="hidden" name="slot" value={slot} />
            {p.clientId && <input type="hidden" name="clientId" value={p.clientId} />}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre" htmlFor="name">
                <Input id="name" name="name" defaultValue={p.defaultName} autoComplete="name" required />
              </Field>
              <Field label="Correo" htmlFor="email">
                <Input id="email" name="email" type="email" defaultValue={p.defaultEmail} autoComplete="email" required />
              </Field>
            </div>
            <Field label="¿Algo que debamos saber antes?" htmlFor="notes">
              <Textarea id="notes" name="notes" />
            </Field>
            <SubmitButton size="lg" className="justify-self-start" style={{ background: p.brandColor, borderColor: p.brandColor }}>
              Confirmar la reunión
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
