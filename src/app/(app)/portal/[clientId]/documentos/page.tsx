import Link from "next/link";
import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { date } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, Input, StatusBadge } from "@/components/ui";
import { portalUploadAction } from "../../actions";

export const metadata = { title: "Documentos" };

const KIND: Record<string, string> = { WELCOME: "Bienvenida", BRIEF: "Brief", PLAN: "Plan de trabajo", REPORT: "Informe", MEETING_NOTES: "Acta de reunión", OTHER: "Documento" };

export default async function PortalDocs({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { clientId } = await params;
  const { doc } = await searchParams;
  const ctx = await requirePortal(clientId);
  const [docs, files, forms] = await Promise.all([
    db.document.findMany({ where: { workspaceId: ctx.workspaceId, clientId, visibleToClient: true }, orderBy: { publishedAt: "desc" } }),
    db.fileAsset.findMany({ where: { workspaceId: ctx.workspaceId, clientId, OR: [{ visibleToClient: true }, { source: "CLIENT" }] }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } }),
    db.formRequest.findMany({ where: { workspaceId: ctx.workspaceId, clientId }, include: { form: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const open = docs.find((d) => d.id === doc);
  return (
    <div className="grid gap-6">
      <h1 className="text-[30px] tracking-[-0.03em]">Documentos</h1>
      {open && (
        <Card className="p-6 sm:p-10 pop">
          <Badge>{KIND[open.kind] ?? "Documento"}</Badge>
          <h2 className="text-2xl mt-3">{open.title}</h2>
          <p className="text-[13px] text-muted mt-1">{date(open.publishedAt, { dateStyle: "long" })}</p>
          <div className="prose-doc mt-6 text-ink-2">{open.body}</div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader title="Documentos e informes" />
          {docs.length === 0 ? (
            <EmptyState title="Sin documentos todavía" />
          ) : (
            <ul className="pb-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link href={`/portal/${clientId}/documentos?doc=${d.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.title}</span>
                      <span className="block text-[12px] text-muted">{KIND[d.kind] ?? "Documento"}</span>
                    </span>
                    <span className="text-[13px] text-muted shrink-0">{date(d.publishedAt, { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Formularios" />
            {forms.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin formularios.</p>
            ) : (
              <ul className="pb-2">
                {forms.map((f) => (
                  <li key={f.id}>
                    <Link href={`/formulario/${f.token}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface text-sm">
                      <span>{f.form.name}</span>
                      <StatusBadge status={f.status === "PENDING" ? "PENDING" : "SUBMITTED"} label={f.status === "PENDING" ? "Pendiente" : "Enviado"} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Archivos" />
            <ul className="pb-2">
              {files.length === 0 && <li className="px-5 pb-3 text-sm text-muted">Sin archivos.</li>}
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/${f.versions[0]?.id}`} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-surface text-sm">
                    <span className="truncate">{f.name}</span>
                    <span className="text-[12px] text-muted shrink-0">{f.source === "CLIENT" ? "Enviado por ti" : date(f.updatedAt, { day: "numeric", month: "short" })}</span>
                  </a>
                </li>
              ))}
            </ul>
            <ActionForm action={portalUploadAction} reset className="grid gap-2 border-t border-line p-4">
              <input type="hidden" name="clientId" value={clientId} />
              <label htmlFor="upload" className="text-[13px] font-medium">
                Enviar archivos (logotipos, accesos, materiales)
              </label>
              <Input id="upload" name="file" type="file" multiple required className="h-auto py-2" />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Subiendo">
                Enviar archivos
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
