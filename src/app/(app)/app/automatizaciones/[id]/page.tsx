import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import type { ActionDef } from "@/lib/automations";
import { PageHeader } from "@/components/ui";
import { saveAutomationAction } from "../actions";
import { AutomationBuilder } from "../builder";
import { builderOptions } from "../options";

export default async function EditAutomation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("automations.manage");
  const a = await db.automation.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!a) notFound();
  const opts = await builderOptions(ctx.workspaceId);
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: "/app/automatizaciones", label: "Automatizaciones" }} title={a.name} />
      <AutomationBuilder
        action={saveAutomationAction}
        {...opts}
        initial={{ id: a.id, name: a.name, trigger: a.trigger, actions: a.actions as ActionDef[], conditions: (a.conditions ?? {}) as { minAmount?: number; clientTag?: string } }}
      />
    </div>
  );
}
