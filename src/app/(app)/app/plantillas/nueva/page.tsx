import { notFound } from "next/navigation";
import type { TemplateType } from "@prisma/client";
import { requireWorkspace } from "@/lib/tenant";
import { TEMPLATE_TYPE_LABELS } from "@/lib/templates";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "../editor";

export const metadata = { title: "Nueva plantilla" };

export default async function NewTemplate({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const ctx = await requireWorkspace("templates.manage");
  const { tipo } = await searchParams;
  if (!tipo || !(tipo in TEMPLATE_TYPE_LABELS) || tipo === "FORM") notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/app/plantillas", label: "Plantillas" }} title={`Nueva plantilla · ${TEMPLATE_TYPE_LABELS[tipo as TemplateType]}`} />
      <TemplateEditor workspaceId={ctx.workspaceId} type={tipo as TemplateType} />
    </div>
  );
}
