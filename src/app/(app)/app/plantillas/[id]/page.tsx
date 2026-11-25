import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { TEMPLATE_TYPE_LABELS } from "@/lib/templates";
import { ActionButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "../editor";
import { deleteTemplateAction, duplicateTemplateAction } from "../actions";

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("templates.manage");
  const t = await db.template.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!t || t.type === "FORM") notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/app/plantillas", label: "Plantillas" }}
        title={t.name}
        description={TEMPLATE_TYPE_LABELS[t.type]}
        actions={
          <>
            <ActionButton action={duplicateTemplateAction} fields={{ id: t.id }}>
              Duplicar
            </ActionButton>
            <ActionButton action={deleteTemplateAction} fields={{ id: t.id }} variant="danger" confirm="¿Eliminar la plantilla?">
              Eliminar
            </ActionButton>
          </>
        }
      />
      <TemplateEditor workspaceId={ctx.workspaceId} type={t.type} template={t} />
    </div>
  );
}
