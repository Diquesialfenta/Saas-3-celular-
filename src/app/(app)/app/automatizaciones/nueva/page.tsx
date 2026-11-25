import { requireWorkspace } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { saveAutomationAction } from "../actions";
import { AutomationBuilder } from "../builder";
import { builderOptions } from "../options";

export const metadata = { title: "Nueva automatización" };

export default async function NewAutomation() {
  const ctx = await requireWorkspace("automations.manage");
  const opts = await builderOptions(ctx.workspaceId);
  return (
    <div className="max-w-2xl">
      <PageHeader back={{ href: "/app/automatizaciones", label: "Automatizaciones" }} title="Nueva automatización" />
      <AutomationBuilder action={saveAutomationAction} {...opts} />
    </div>
  );
}
