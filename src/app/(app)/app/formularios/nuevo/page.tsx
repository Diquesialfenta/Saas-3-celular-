import { requireWorkspace } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { saveFormAction } from "../actions";
import { FormBuilder } from "../builder";

export const metadata = { title: "Nuevo formulario" };

export default async function NewForm() {
  await requireWorkspace("templates.manage");
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/app/formularios", label: "Formularios" }} title="Nuevo formulario" />
      <FormBuilder action={saveFormAction} />
    </div>
  );
}
