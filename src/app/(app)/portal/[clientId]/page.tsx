import Link from "next/link";
import { ArrowRight, FileSignature, ClipboardList, PackageCheck, CreditCard, CheckSquare, Video } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { date, dateTime, money } from "@/lib/format";
import { appUrl } from "@/lib/config";
import { ActionButton } from "@/components/forms";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui";
import { completeClientTaskAction } from "../actions";

export default async function PortalHome({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const ws = ctx.workspaceId;
  const [projects, forms, deliverables, signers, invoices, tasks, meetings, welcome] = await Promise.all([
    db.project.findMany({ where: { workspaceId: ws, clientId, visibleToClient: true, status: { not: "CANCELED" } }, include: { tasks: { where: { parentId: null }, select: { status: true } } }, orderBy: { createdAt: "desc" } }),
    db.formRequest.findMany({ where: { workspaceId: ws, clientId, status: "PENDING" }, include: { form: true } }),
    db.deliverable.findMany({ where: { workspaceId: ws, status: "IN_REVIEW", project: { clientId, visibleToClient: true } }, include: { project: { select: { id: true, name: true } } } }),
    db.contractSigner.findMany({ where: { party: "CLIENT", signedAt: null, contract: { workspaceId: ws, clientId, status: { in: ["SENT", "PARTIALLY_SIGNED"] } } }, include: { contract: true } }),
    db.invoice.findMany({ where: { workspaceId: ws, clientId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, orderBy: { dueDate: "asc" } }),
    db.task.findMany({ where: { workspaceId: ws, forClient: true, status: { not: "DONE" }, project: { clientId } }, include: { project: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    db.meeting.findMany({ where: { workspaceId: ws, clientId, visibleToClient: true, status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 }),
    db.document.findFirst({ where: { workspaceId: ws, clientId, kind: "WELCOME", visibleToClient: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const todo: { key: string; icon: typeof FileSignature; label: string; meta?: string; href: string; external: boolean }[] = [
    ...signers.map((s) => ({ key: s.id, icon: FileSignature, label: `Firmar el contrato «${s.contract.title}»`, href: appUrl(`/firmar/${s.token}`), external: true })),
    ...forms.map((f) => ({ key: f.id, icon: ClipboardList, label: `Completar «${f.form.name}»`, meta: f.dueDate ? `antes del ${date(f.dueDate)}` : undefined, href: `/formulario/${f.token}`, external: false })),
    ...deliverables.map((d) => ({ key: d.id, icon: PackageCheck, label: `Revisar la entrega «${d.title}»`, meta: d.project.name, href: `/portal/${clientId}/proyectos/${d.project.id}`, external: false })),
    ...invoices.map((i) => ({ key: i.id, icon: CreditCard, label: `Pagar la factura ${i.number} · ${money(i.total - i.amountPaid, i.currency)}`, meta: `vence ${date(i.dueDate)}`, href: `/i/${i.publicToken}`, external: false })),
  ];
  return (
    <div className="grid gap-6">
      <div className="stagger">
        <p className="text-[13px] text-muted">{ctx.workspace.portalTitle ?? `Portal de ${ctx.workspace.name}`}</p>
        <h1 className="text-[30px] sm:text-[38px] leading-tight tracking-[-0.03em] mt-1">Hola, {ctx.user.name.split(" ")[0]}</h1>
        <p className="text-muted mt-1 max-w-2xl">{ctx.workspace.portalWelcome ?? `Aquí tienes todo lo que estamos haciendo para ${ctx.client.name}.`}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Pendiente de tu parte" description={todo.length + tasks.length === 0 ? "Estás al día." : `${todo.length + tasks.length} asunto(s)`} />
            <ul className="pb-2">
              {todo.map((t) => (
                <li key={t.key}>
                  <a href={t.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors">
                    <span className="grid size-9 place-items-center rounded-full text-white shrink-0" style={{ background: ctx.workspace.brandColor }}>
                      <t.icon className="size-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{t.label}</span>
                      {t.meta && <span className="block text-[12px] text-muted">{t.meta}</span>}
                    </span>
                    <ArrowRight className="size-4 text-muted" />
                  </a>
                </li>
              ))}
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-surface shrink-0">
                    <CheckSquare className="size-4 text-muted" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="block text-[12px] text-muted">
                      {t.project.name}
                      {t.dueDate ? ` · antes del ${date(t.dueDate)}` : ""}
                    </span>
                  </span>
                  {t.title.startsWith("Subir archivos") ? (
                    <Link href={`/portal/${clientId}/documentos`} className="text-[13px] font-medium underline underline-offset-2">
                      Subir
                    </Link>
                  ) : (
                    <ActionButton action={completeClientTaskAction} fields={{ clientId, id: t.id }}>
                      Hecho
                    </ActionButton>
                  )}
                </li>
              ))}
              {todo.length + tasks.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No tienes nada pendiente. Te avisaremos cuando necesitemos algo.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Tus proyectos" />
            {projects.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Tu proyecto aparecerá aquí en cuanto empecemos.</p>
            ) : (
              <ul className="pb-2">
                {projects.map((p) => {
                  const done = p.tasks.filter((t) => t.status === "DONE").length;
                  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/portal/${clientId}/proyectos/${p.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface transition-colors">
                        <span className="font-medium">{p.name}</span>
                        <StatusBadge status={p.status} />
                        <Progress value={pct} />
                        <span className="text-[12px] text-muted tabular-nums">{pct} %</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-4">
          {welcome && (
            <Card className="p-5">
              <p className="text-[13px] text-muted">Para empezar</p>
              <Link href={`/portal/${clientId}/documentos?doc=${welcome.id}`} className="mt-1 flex items-center justify-between gap-2 font-medium hover:underline underline-offset-2">
                {welcome.title} <ArrowRight className="size-4" />
              </Link>
            </Card>
          )}
          <Card>
            <CardHeader title="Próximas reuniones" />
            {meetings.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin reuniones programadas.</p>
            ) : (
              <ul className="pb-3">
                {meetings.map((m) => (
                  <li key={m.id} className="px-5 py-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-[13px] text-muted">{dateTime(m.startsAt)}</p>
                    {m.videoUrl && (
                      <a href={m.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] underline underline-offset-2">
                        <Video className="size-3.5" /> Unirse
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium">¿Necesitas algo?</p>
            <p className="text-[13px] text-muted mt-1">Escríbenos o abre un ticket de soporte. Respondemos desde aquí mismo.</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/portal/${clientId}/mensajes`} className="press h-9 px-4 inline-flex items-center rounded-full text-sm text-white" style={{ background: ctx.workspace.brandColor }}>
                Escribir al equipo
              </Link>
              <Link href={`/portal/${clientId}/soporte`} className="press h-9 px-4 inline-flex items-center rounded-full text-sm border border-line-strong hover:bg-surface">
                Abrir ticket
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
