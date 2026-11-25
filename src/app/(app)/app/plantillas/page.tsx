import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { relative } from "@/lib/format";
import { TEMPLATE_TYPE_LABELS } from "@/lib/templates";
import { Badge, ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata = { title: "Plantillas" };

const DESCRIPTIONS: Record<string, string> = {
  PROPOSAL: "Secciones y conceptos de partida para tus propuestas.",
  CONTRACT: "Contratos con variables que se rellenan con el cliente y la propuesta.",
  PROJECT: "Etapas, tareas e hitos que se crean de golpe al abrir un proyecto.",
  DOCUMENT: "Bienvenida, guías y documentos que publicas en el portal.",
  EMAIL: "Textos de correo reutilizables para tus automatizaciones.",
  ONBOARDING: "Procesos completos de bienvenida: portal, formulario, archivos, proyecto y reunión.",
};

export default async function TemplatesPage() {
  const ctx = await requireWorkspace("templates.manage");
  const templates = await db.template.findMany({ where: { workspaceId: ctx.workspaceId, type: { not: "FORM" } }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader title="Plantillas" description="Todo lo que repites, preparado una vez. Las plantillas alimentan propuestas, contratos, proyectos, onboarding y automatizaciones." />
      <div className="grid gap-4 md:grid-cols-2">
        {(["PROPOSAL", "CONTRACT", "PROJECT", "ONBOARDING", "DOCUMENT", "EMAIL"] as const).map((type) => {
          const list = templates.filter((t) => t.type === type);
          return (
            <Card key={type}>
              <CardHeader
                title={TEMPLATE_TYPE_LABELS[type]}
                description={DESCRIPTIONS[type]}
                action={
                  <ButtonLink href={`/app/plantillas/nueva?tipo=${type}`} variant="secondary" size="sm">
                    Crear
                  </ButtonLink>
                }
              />
              <ul className="pb-2">
                {list.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Sin plantillas de este tipo.</li>}
                {list.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/plantillas/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-surface">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{t.name}</span>
                        {t.description && <span className="block truncate text-[12px] text-muted">{t.description}</span>}
                      </span>
                      <span className="text-[12px] text-faint shrink-0">{relative(t.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">
        Los formularios inteligentes se gestionan en{" "}
        <Link href="/app/formularios" className="underline underline-offset-2">
          Formularios
        </Link>
        . <Badge>Consejo</Badge> Duplica una plantilla antes de cambiarla mucho para conservar la original.
      </p>
    </>
  );
}
