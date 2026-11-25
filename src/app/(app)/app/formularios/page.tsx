import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const metadata = { title: "Formularios" };

export default async function FormsPage() {
  const ctx = await requireWorkspace("templates.manage");
  const [forms, requests] = await Promise.all([
    db.form.findMany({ where: { workspaceId: ctx.workspaceId }, include: { _count: { select: { requests: true } } }, orderBy: { updatedAt: "desc" } }),
    db.formRequest.findMany({ where: { workspaceId: ctx.workspaceId }, include: { form: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const clients = await db.client.findMany({ where: { id: { in: requests.map((r) => r.clientId) } }, select: { id: true, name: true } });
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return (
    <>
      <PageHeader title="Formularios" description="Cuestionarios para recoger la información del cliente: briefing, accesos, preferencias. Se envían solos en el onboarding o cuando tú quieras." actions={<ButtonLink href="/app/formularios/nuevo">Crear formulario</ButtonLink>} />
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader title="Tus formularios" />
          {forms.length === 0 ? (
            <EmptyState title="Sin formularios" />
          ) : (
            <ul className="pb-2">
              {forms.map((f) => (
                <li key={f.id}>
                  <Link href={`/app/formularios/${f.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block text-[12px] text-muted">{(f.fields as unknown[]).length} preguntas</span>
                    </span>
                    <span className="text-[12px] text-muted">{f._count.requests} envíos</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Respuestas recientes" />
          {requests.length === 0 ? (
            <EmptyState title="Aún no has enviado formularios" />
          ) : (
            <ul className="pb-2">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/formularios/${r.formId}?respuesta=${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{names.get(r.clientId)}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {r.form.name} · {relative(r.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={r.status === "PENDING" ? "PENDING" : "SUBMITTED"} label={r.status === "PENDING" ? "Pendiente" : "Respondido"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
