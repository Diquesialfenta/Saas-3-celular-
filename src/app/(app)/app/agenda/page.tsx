import Link from "next/link";
import { Video } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { appUrl } from "@/lib/config";
import { ActionForm, CopyButton, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Checkbox, EmptyState, Field, Input, PageHeader, StatusBadge, Textarea, Select, cx } from "@/components/ui";
import { createMeetingAction } from "../proyectos/actions";
import { saveBookingLinkAction } from "./actions";

export const metadata = { title: "Agenda" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const ctx = await requireWorkspace();
  const { mes } = await searchParams;
  const ref = mes ? new Date(`${mes}-01T12:00:00`) : new Date();
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const [meetings, tasks, links, clients] = await Promise.all([
    db.meeting.findMany({ where: { workspaceId: ctx.workspaceId, startsAt: { gte: gridStart, lte: new Date(last.getTime() + 7 * 86400_000) } }, orderBy: { startsAt: "asc" } }),
    db.task.findMany({ where: { workspaceId: ctx.workspaceId, assigneeId: ctx.user.id, status: { not: "DONE" }, dueDate: { gte: gridStart, lte: last } }, select: { id: true, title: true, dueDate: true, projectId: true } }),
    db.bookingLink.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "asc" } }),
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const prev = new Date(first.getFullYear(), first.getMonth() - 1, 1);
  const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today = key(new Date());
  const upcoming = meetings.filter((m) => m.startsAt >= new Date() && m.status === "SCHEDULED").slice(0, 6);
  const ics = appUrl(`/api/ics/${ctx.workspace.icsToken}`);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Reuniones, entregas y tu enlace público para que los clientes reserven la reunión inicial."
        actions={
          <Modal trigger="Programar reunión" title="Nueva reunión">
            <ActionForm action={createMeetingAction} className="grid gap-4">
              <Field label="Título" htmlFor="m-title">
                <Input id="m-title" name="title" required />
              </Field>
              <Field label="Cliente" htmlFor="m-client">
                <Select id="m-client" name="clientId">
                  <option value="">Interna</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha y hora" htmlFor="m-start">
                  <Input id="m-start" name="startsAt" type="datetime-local" required />
                </Field>
                <Field label="Duración (min)" htmlFor="m-dur">
                  <Input id="m-dur" name="duration" type="number" min={10} defaultValue={45} />
                </Field>
              </div>
              <Field label="Enlace de videollamada" htmlFor="m-video">
                <Input id="m-video" name="videoUrl" type="url" />
              </Field>
              <Checkbox name="visibleToClient" defaultChecked label="Mostrar en el portal del cliente" />
              <SubmitButton>Programar</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <h2 className="text-lg capitalize">{first.toLocaleDateString("es", { month: "long", year: "numeric" })}</h2>
            <div className="flex gap-1">
              <Link href={`/app/agenda?mes=${ym(prev)}`} className="press grid size-9 place-items-center rounded-full hover:bg-surface" aria-label="Mes anterior">
                ‹
              </Link>
              <Link href="/app/agenda" className="press h-9 px-3 inline-flex items-center rounded-full text-sm hover:bg-surface">
                Hoy
              </Link>
              <Link href={`/app/agenda?mes=${ym(next)}`} className="press grid size-9 place-items-center rounded-full hover:bg-surface" aria-label="Mes siguiente">
                ›
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 text-[12px] text-muted border-b border-line">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const k = key(d);
              const ms = meetings.filter((m) => key(m.startsAt) === k);
              const ts = tasks.filter((t) => t.dueDate && key(t.dueDate) === k);
              const out = d.getMonth() !== first.getMonth();
              return (
                <div key={k} className={cx("min-h-24 border-b border-r border-line p-1.5 text-[12px] [&:nth-child(7n)]:border-r-0", out && "bg-surface/60 text-faint")}>
                  <span className={cx("inline-grid size-6 place-items-center rounded-full", k === today && "bg-ink text-white")}>{d.getDate()}</span>
                  <ul className="mt-0.5 grid gap-0.5">
                    {ms.map((m) => (
                      <li key={m.id} className={cx("truncate rounded px-1 py-0.5", m.status === "CANCELED" ? "line-through text-faint" : "bg-accent/60 text-accent-ink")} title={m.title}>
                        {m.startsAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })} {m.title}
                      </li>
                    ))}
                    {ts.map((t) => (
                      <li key={t.id} className="truncate">
                        <Link href={`/app/proyectos/${t.projectId}?tarea=${t.id}`} className="block truncate rounded px-1 py-0.5 bg-surface-2 hover:bg-line" title={t.title}>
                          ◦ {t.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader title="Próximas reuniones" />
            {upcoming.length === 0 ? (
              <EmptyState title="Sin reuniones programadas" />
            ) : (
              <ul className="pb-3">
                {upcoming.map((m) => (
                  <li key={m.id} className="px-5 py-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-[13px] text-muted">{m.startsAt.toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    {m.videoUrl && (
                      <a href={m.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] hover:underline">
                        <Video className="size-3.5" /> Unirse
                      </a>
                    )}
                    {m.status !== "SCHEDULED" && <StatusBadge status={m.status} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Enlaces de reserva" description="Los clientes eligen hueco según tu disponibilidad" />
            <ul className="px-5 pb-4 grid gap-3">
              {links.map((l) => {
                const av = l.availability as { days: number[]; from: string; to: string };
                return (
                  <li key={l.id} className="rounded-[10px] border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{l.title}</p>
                      {!l.isActive && <Badge>Inactivo</Badge>}
                    </div>
                    <p className="text-[12px] text-muted">
                      {l.durationMin} min · {av.days.map((d) => DAYS[d].slice(0, 3)).join(", ")} · {av.from}–{av.to}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <CopyButton value={appUrl(`/agenda/${l.slug}`)} />
                      {ctx.can("settings.manage") && (
                        <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title="Editar enlace de reserva">
                          <BookingForm link={l} />
                        </Modal>
                      )}
                    </div>
                  </li>
                );
              })}
              {ctx.can("settings.manage") && (
                <Modal trigger="Crear enlace" triggerVariant="secondary" triggerSize="sm" title="Nuevo enlace de reserva">
                  <BookingForm />
                </Modal>
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium">Sincroniza con tu calendario</p>
            <p className="text-[13px] text-muted mt-1">Suscribe Google Calendar, Outlook o Apple Calendar a esta dirección privada para ver tus reuniones y entregas.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={ics} aria-label="Dirección del calendario" className="min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2.5 h-8 text-[12px] font-mono" />
              <CopyButton value={ics} label="Copiar" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function BookingForm({ link }: { link?: { id: string; title: string; description: string | null; durationMin: number; availability: unknown; videoUrl: string | null; isActive: boolean } }) {
  const av = (link?.availability as { days: number[]; from: string; to: string } | undefined) ?? { days: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" };
  return (
    <ActionForm action={saveBookingLinkAction} className="grid gap-4">
      {link && <input type="hidden" name="id" value={link.id} />}
      <Field label="Título" htmlFor="b-title">
        <Input id="b-title" name="title" defaultValue={link?.title ?? "Reunión estratégica inicial"} required />
      </Field>
      <Field label="Descripción" htmlFor="b-desc">
        <Textarea id="b-desc" name="description" defaultValue={link?.description ?? ""} />
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-2">Días disponibles</legend>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Checkbox key={d} name="days" value={String(d)} defaultChecked={av.days.includes(d)} label={DAYS[d].slice(0, 3)} />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Desde" htmlFor="b-from">
          <Input id="b-from" name="from" type="time" defaultValue={av.from} />
        </Field>
        <Field label="Hasta" htmlFor="b-to">
          <Input id="b-to" name="to" type="time" defaultValue={av.to} />
        </Field>
        <Field label="Duración" htmlFor="b-dur">
          <Input id="b-dur" name="durationMin" type="number" min={10} max={240} defaultValue={link?.durationMin ?? 45} />
        </Field>
      </div>
      <Field label="Enlace de videollamada" htmlFor="b-video">
        <Input id="b-video" name="videoUrl" type="url" defaultValue={link?.videoUrl ?? ""} placeholder="https://meet.google.com/…" />
      </Field>
      <Checkbox name="isActive" defaultChecked={link?.isActive ?? true} label="Activo" />
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}
