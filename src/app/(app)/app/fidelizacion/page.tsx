import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { date, relative } from "@/lib/format";
import { ActionButton, ActionForm, AutoSubmitSelect, LinkResultForm, Modal, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Checkbox, EmptyState, Field, Input, PageHeader, Select, Stat, StatusBadge, Tabs } from "@/components/ui";
import { createRenewalAction, moderateTestimonialAction, requestTestimonialAction, saveReferralRewardAction, saveSurveyAction, sendSurveyAction, updateReferralAction } from "./actions";

export const metadata = { title: "Fidelización" };

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireWorkspace("support.manage");
  const { vista = "satisfaccion" } = await searchParams;
  const ws = ctx.workspaceId;
  const clients = await db.client.findMany({ where: { workspaceId: ws, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const responses = await db.surveyResponse.findMany({ where: { workspaceId: ws, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 200 });
  const scores = responses.map((r) => r.score ?? 0);
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const nps = scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : null;
  const [testimonials, referrals] = await Promise.all([db.testimonial.count({ where: { workspaceId: ws, status: "APPROVED" } }), db.referral.count({ where: { workspaceId: ws } })]);
  const base = "/app/fidelizacion";
  const tabs = [
    { href: base, label: "Satisfacción" },
    { href: `${base}?vista=testimonios`, label: "Testimonios" },
    { href: `${base}?vista=referidos`, label: "Referidos" },
    { href: `${base}?vista=renovaciones`, label: "Renovaciones y oportunidades" },
  ];
  const current = vista === "satisfaccion" ? base : `${base}?vista=${vista}`;

  return (
    <>
      <PageHeader title="Fidelización" description="Mide la satisfacción, consigue testimonios, premia las recomendaciones y no dejes pasar una renovación." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="NPS" value={nps === null ? "—" : nps} hint={`${scores.length} respuestas`} tone={nps !== null ? (nps >= 30 ? "ok" : nps < 0 ? "danger" : undefined) : undefined} />
        <Stat label="Promotores" value={promoters} />
        <Stat label="Testimonios aprobados" value={testimonials} />
        <Stat label="Recomendaciones recibidas" value={referrals} />
      </div>
      <Tabs items={tabs} current={current} />
      {vista === "satisfaccion" && <Satisfaction workspaceId={ws} clients={clients} names={names} responses={responses} />}
      {vista === "testimonios" && <Testimonials workspaceId={ws} clients={clients} names={names} />}
      {vista === "referidos" && <Referrals workspaceId={ws} names={names} reward={ctx.workspace.referralReward} />}
      {vista === "renovaciones" && <Renewals workspaceId={ws} />}
    </>
  );
}

async function Satisfaction({ workspaceId, clients, names, responses }: { workspaceId: string; clients: { id: string; name: string }[]; names: Map<string, string>; responses: { id: string; clientId: string; score: number | null; comment: string | null; completedAt: Date | null }[] }) {
  const surveys = await db.survey.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
      <Card>
        <CardHeader title="Respuestas" />
        {responses.length === 0 ? (
          <EmptyState title="Aún no hay respuestas" description="Envía una encuesta a un cliente o deja que la automatización de cierre de proyecto lo haga." />
        ) : (
          <ul className="pb-2">
            {responses.map((r) => (
              <li key={r.id} className="flex gap-4 px-5 py-3 border-t border-line first:border-0">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-lg ${(r.score ?? 0) >= 9 ? "bg-ok-bg text-ok" : (r.score ?? 0) <= 6 ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"}`}>{r.score}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{names.get(r.clientId)}</span>
                  {r.comment && <span className="block text-sm text-ink-2 whitespace-pre-wrap">{r.comment}</span>}
                  <span className="block text-[12px] text-faint">{relative(r.completedAt!)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-4">
        <Card className="p-5">
          <p className="text-sm font-medium mb-3">Enviar encuesta</p>
          <LinkResultForm action={sendSurveyAction} className="grid gap-3" note="Enlace de la encuesta:">
            <Field label="Cliente" htmlFor="s-client">
              <Select id="s-client" name="clientId" required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Encuesta" htmlFor="s-survey">
              <Select id="s-survey" name="surveyId" required>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton variant="secondary">Enviar</SubmitButton>
          </LinkResultForm>
        </Card>
        <Card>
          <CardHeader
            title="Encuestas"
            action={
              <Modal trigger="Crear" triggerVariant="ghost" triggerSize="sm" title="Nueva encuesta">
                <SurveyForm />
              </Modal>
            }
          />
          <ul className="pb-3">
            {surveys.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                <span className="truncate">{s.name}</span>
                <Modal trigger="Editar" triggerVariant="ghost" triggerSize="sm" title="Editar encuesta">
                  <SurveyForm s={s} />
                </Modal>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function SurveyForm({ s }: { s?: { id: string; name: string; question: string; followUp: string | null; isActive: boolean } }) {
  return (
    <ActionForm action={saveSurveyAction} className="grid gap-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Nombre interno" htmlFor="sv-name">
        <Input id="sv-name" name="name" defaultValue={s?.name} required />
      </Field>
      <Field label="Pregunta (0 a 10)" htmlFor="sv-q">
        <Input id="sv-q" name="question" defaultValue={s?.question ?? "Del 0 al 10, ¿con qué probabilidad nos recomendarías?"} required />
      </Field>
      <Field label="Pregunta abierta" htmlFor="sv-f">
        <Input id="sv-f" name="followUp" defaultValue={s?.followUp ?? "¿Qué es lo que más valoraste y qué mejorarías?"} />
      </Field>
      <Checkbox name="isActive" defaultChecked={s?.isActive ?? true} label="Activa" />
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}

async function Testimonials({ workspaceId, clients, names }: { workspaceId: string; clients: { id: string; name: string }[]; names: Map<string, string> }) {
  const items = await db.testimonial.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <LinkResultForm action={requestTestimonialAction} className="flex flex-col sm:flex-row gap-2 items-end" note="Enlace para el cliente:">
          <Field label="Pedir testimonio a" htmlFor="t-client" className="flex-1">
            <Select id="t-client" name="clientId" required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton variant="secondary">Pedir testimonio</SubmitButton>
        </LinkResultForm>
      </Card>
      {items.length === 0 ? (
        <Card>
          <EmptyState title="Sin testimonios" />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <Card key={t.id} className="p-5 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{names.get(t.clientId)}</span>
                <StatusBadge status={t.status} label={{ REQUESTED: "Solicitado", SUBMITTED: "Por revisar", APPROVED: "Aprobado", REJECTED: "Descartado" }[t.status]} />
              </div>
              {t.content ? (
                <>
                  <blockquote className="mt-3 text-[15px] leading-relaxed flex-1">“{t.content}”</blockquote>
                  <p className="mt-3 text-[13px] text-muted">
                    {t.authorName}
                    {t.authorRole ? `, ${t.authorRole}` : ""} {t.rating ? `· ${"★".repeat(t.rating)}` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {t.status !== "APPROVED" && (
                      <ActionButton action={moderateTestimonialAction} fields={{ id: t.id, status: "APPROVED" }} variant="accent">
                        Aprobar
                      </ActionButton>
                    )}
                    {t.status !== "REJECTED" && (
                      <ActionButton action={moderateTestimonialAction} fields={{ id: t.id, status: "REJECTED" }} variant="ghost">
                        Descartar
                      </ActionButton>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">Esperando la respuesta del cliente (pedido {relative(t.createdAt)}).</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

async function Referrals({ workspaceId, names, reward }: { workspaceId: string; names: Map<string, string>; reward: string | null }) {
  const items = await db.referral.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <ActionForm action={saveReferralRewardAction} className="flex flex-col sm:flex-row gap-2 items-end">
          <Field label="Recompensa que ven tus clientes en su portal" htmlFor="reward" className="flex-1">
            <Input id="reward" name="referralReward" defaultValue={reward ?? ""} placeholder="Un mes de mantenimiento gratis por cada cliente que nos recomiendes" />
          </Field>
          <SubmitButton variant="secondary">Guardar</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        {items.length === 0 ? (
          <EmptyState title="Sin recomendaciones" description="Tus clientes pueden recomendarte desde la sección Servicios de su portal." />
        ) : (
          <ul>
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-line last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {r.name}
                    {r.company ? ` · ${r.company}` : ""}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {r.email} · recomendado por {names.get(r.referrerClientId)} · {date(r.createdAt)}
                  </span>
                  {r.note && <span className="block text-[13px] mt-1">{r.note}</span>}
                </span>
                {r.convertedClientId && (
                  <Link href={`/app/clientes/${r.convertedClientId}`} className="text-[13px] underline underline-offset-2">
                    Ver cliente
                  </Link>
                )}
                <ActionForm action={updateReferralAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <label htmlFor={`rs-${r.id}`} className="sr-only">
                    Estado
                  </label>
                  <AutoSubmitSelect id={`rs-${r.id}`} name="status" defaultValue={r.status}>
                    <option value="NEW">Nuevo</option>
                    <option value="CONTACTED">Contactado</option>
                    <option value="CONVERTED">Convertido en cliente</option>
                    <option value="REWARDED">Recompensado</option>
                    <option value="LOST">Descartado</option>
                  </AutoSubmitSelect>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function Renewals({ workspaceId }: { workspaceId: string }) {
  const in45 = new Date(Date.now() + 45 * 86400_000);
  const [completed, recurring, inactive] = await Promise.all([
    db.project.findMany({ where: { workspaceId, status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 120 * 86400_000) } }, include: { client: { include: { deals: { where: { status: "OPEN" } } } } }, orderBy: { completedAt: "desc" } }),
    db.recurringPlan.findMany({ where: { workspaceId, status: "ACTIVE", endsAt: { lte: in45, gte: new Date() } } }),
    db.client.findMany({ where: { workspaceId, status: "ACTIVE", projects: { none: { status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } } }, deals: { none: { status: "OPEN" } } }, take: 30 }),
  ]);
  const clientNames = new Map((await db.client.findMany({ where: { id: { in: recurring.map((r) => r.clientId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const Row = ({ clientId, name, detail, title, source }: { clientId: string; name: string; detail: string; title: string; source: string }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-line first:border-0">
      <span className="min-w-0">
        <Link href={`/app/clientes/${clientId}`} className="block text-sm font-medium hover:underline">
          {name}
        </Link>
        <span className="block text-[13px] text-muted">{detail}</span>
      </span>
      <ActionButton action={createRenewalAction} fields={{ clientId, title, source }}>
        Crear oportunidad
      </ActionButton>
    </li>
  );
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title="Proyectos cerrados sin siguiente paso" description="Buen momento para proponer una nueva fase, mantenimiento o mejora" />
        <ul>
          {completed.filter((p) => p.client.deals.length === 0).length === 0 && <li className="px-5 pb-4 text-sm text-muted">Nada pendiente.</li>}
          {completed
            .filter((p) => p.client.deals.length === 0)
            .map((p) => (
              <Row key={p.id} clientId={p.clientId} name={p.client.name} detail={`«${p.name}» terminado ${relative(p.completedAt!)}`} title={`Siguiente fase · ${p.name}`} source="UPSELL" />
            ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Servicios recurrentes que vencen pronto" description="Próximos 45 días" />
        <ul>
          {recurring.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Ningún servicio vence pronto.</li>}
          {recurring.map((r) => (
            <Row key={r.id} clientId={r.clientId} name={clientNames.get(r.clientId) ?? ""} detail={`${r.name} termina el ${date(r.endsAt)}`} title={`Renovación · ${r.name}`} source="RENEWAL" />
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Clientes activos sin trabajo en curso" />
        <ul>
          {inactive.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Todos tus clientes activos tienen trabajo en curso.</li>}
          {inactive.map((c) => (
            <Row key={c.id} clientId={c.id} name={c.name} detail="Sin proyectos ni oportunidades abiertas" title={`Nueva oportunidad · ${c.name}`} source="UPSELL" />
          ))}
        </ul>
      </Card>
      <p className="text-[13px] text-muted">
        <Badge>Consejo</Badge> La receta «Proyecto completado → fidelización» crea estas oportunidades automáticamente.
      </p>
    </div>
  );
}

