import type { Template, TemplateType } from "@prisma/client";
import { db } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai";
import { TEMPLATE_VARIABLES, type ContractTemplate, type DocumentTemplate, type EmailTemplate, type OnboardingTemplate, type ProjectTemplate, type ProposalTemplate } from "@/lib/templates";
import { itemsToText, projectToText, sectionsToText } from "@/lib/template-text";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveTemplateAction, aiWriteTemplate } from "./actions";
import { AiFill } from "./ai-fill";

export async function TemplateEditor({ workspaceId, type, template }: { workspaceId: string; type: TemplateType; template?: Template }) {
  const c = (template?.content ?? {}) as Record<string, unknown>;
  const ai = isAiConfigured();
  const [forms, projects, bookings] =
    type === "ONBOARDING"
      ? await Promise.all([
          db.form.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
          db.template.findMany({ where: { workspaceId, type: "PROJECT" }, select: { id: true, name: true } }),
          db.bookingLink.findMany({ where: { workspaceId }, select: { id: true, title: true } }),
        ])
      : [[], [], []];
  return (
    <ActionForm action={saveTemplateAction} className="grid gap-4">
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="type" value={type} />
      <Card className="p-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la plantilla" htmlFor="name">
          <Input id="name" name="name" defaultValue={template?.name} required />
        </Field>
        <Field label="Descripción" htmlFor="description">
          <Input id="description" name="description" defaultValue={template?.description ?? ""} />
        </Field>
      </Card>
      <Card className="p-5 grid gap-4">
        {type === "PROPOSAL" && (
          <>
            <Field label="Título de la propuesta" htmlFor="title">
              <Input id="title" name="title" defaultValue={(c as ProposalTemplate).title} required />
            </Field>
            <Field label="Resumen" htmlFor="summary">
              <Textarea id="summary" name="summary" defaultValue={(c as ProposalTemplate).summary} />
            </Field>
            {ai && <AiFill type="PROPOSAL" target="sections" generate={aiWriteTemplate} />}
            <Field label="Secciones" htmlFor="sections" hint="Cada sección empieza con «## Título» en su propia línea.">
              <Textarea id="sections" name="sections" defaultValue={sectionsToText((c as ProposalTemplate).sections ?? [])} className="min-h-64 font-mono text-[13px]" />
            </Field>
            <Field label="Conceptos" htmlFor="items" hint="Una línea por concepto: Nombre | precio | cantidad | opcional | mensual">
              <Textarea id="items" name="items" defaultValue={itemsToText((c as ProposalTemplate).items ?? [])} className="min-h-28 font-mono text-[13px]" />
            </Field>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <Field label="Anticipo %" htmlFor="depositPercent">
                <Input id="depositPercent" name="depositPercent" type="number" min={0} max={100} defaultValue={(c as ProposalTemplate).depositPercent ?? 50} />
              </Field>
              <Field label="Validez (días)" htmlFor="validDays">
                <Input id="validDays" name="validDays" type="number" min={1} defaultValue={(c as ProposalTemplate).validDays ?? 15} />
              </Field>
            </div>
          </>
        )}
        {type === "CONTRACT" && (
          <>
            <Field label="Título del contrato" htmlFor="title">
              <Input id="title" name="title" defaultValue={(c as ContractTemplate).title} required />
            </Field>
            {ai && <AiFill type="CONTRACT" target="body" generate={aiWriteTemplate} />}
            <Field label="Texto" htmlFor="body" hint={`Variables: ${TEMPLATE_VARIABLES.join(" ")}`}>
              <Textarea id="body" name="body" defaultValue={(c as ContractTemplate).body} className="min-h-[480px]" required />
            </Field>
          </>
        )}
        {type === "PROJECT" && (
          <>
            <Field label="Objetivos (uno por línea)" htmlFor="objectives">
              <Textarea id="objectives" name="objectives" defaultValue={((c as ProjectTemplate).objectives ?? []).join("\n")} />
            </Field>
            {ai && <AiFill type="PROJECT" target="structure" generate={aiWriteTemplate} />}
            <Field label="Estructura" htmlFor="structure" hint="«# Etapa», «- Tarea | días desde el inicio | HIGH | cliente», «@ Hito | días»">
              <Textarea id="structure" name="structure" defaultValue={template ? projectToText(c as ProjectTemplate) : "# Descubrimiento\n- Reunión inicial | 2 | HIGH\n- Completar el briefing | 3 | cliente\n\n# Producción\n- Primera versión | 10\n\n@ Entrega final | 20"} className="min-h-80 font-mono text-[13px]" required />
            </Field>
          </>
        )}
        {type === "DOCUMENT" && (
          <>
            <div className="grid sm:grid-cols-[1fr_200px] gap-3">
              <Field label="Título" htmlFor="title">
                <Input id="title" name="title" defaultValue={(c as DocumentTemplate).title} required />
              </Field>
              <Field label="Tipo" htmlFor="kind">
                <Select id="kind" name="kind" defaultValue={(c as DocumentTemplate).kind ?? "WELCOME"}>
                  <option value="WELCOME">Bienvenida</option>
                  <option value="BRIEF">Brief</option>
                  <option value="PLAN">Plan de trabajo</option>
                  <option value="REPORT">Informe</option>
                  <option value="OTHER">Otro</option>
                </Select>
              </Field>
            </div>
            {ai && <AiFill type="DOCUMENT" target="body" generate={aiWriteTemplate} />}
            <Field label="Contenido" htmlFor="body" hint="Puedes usar {{cliente.nombre}} y {{empresa.nombre}}.">
              <Textarea id="body" name="body" defaultValue={(c as DocumentTemplate).body} className="min-h-80" required />
            </Field>
          </>
        )}
        {type === "EMAIL" && (
          <>
            <Field label="Asunto" htmlFor="subject">
              <Input id="subject" name="subject" defaultValue={(c as EmailTemplate).subject} required />
            </Field>
            {ai && <AiFill type="EMAIL" target="body" generate={aiWriteTemplate} />}
            <Field label="Mensaje" htmlFor="body">
              <Textarea id="body" name="body" defaultValue={(c as EmailTemplate).body} className="min-h-48" required />
            </Field>
          </>
        )}
        {type === "ONBOARDING" && (
          <>
            <Field label="Título de bienvenida" htmlFor="welcomeTitle">
              <Input id="welcomeTitle" name="welcomeTitle" defaultValue={(c as OnboardingTemplate).welcomeTitle ?? "Bienvenido a {{empresa.nombre}}"} required />
            </Field>
            <Field label="Documento de bienvenida" htmlFor="welcomeBody">
              <Textarea id="welcomeBody" name="welcomeBody" defaultValue={(c as OnboardingTemplate).welcomeBody} className="min-h-48" required />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Formulario a solicitar" htmlFor="formId">
                <Select id="formId" name="formId" defaultValue={(c as OnboardingTemplate).formId ?? ""}>
                  <option value="">Ninguno</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Proyecto a crear" htmlFor="projectTemplateId">
                <Select id="projectTemplateId" name="projectTemplateId" defaultValue={(c as OnboardingTemplate).projectTemplateId ?? ""}>
                  <option value="">Ninguno</option>
                  {projects.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reunión inicial" htmlFor="bookingLinkId">
                <Select id="bookingLinkId" name="bookingLinkId" defaultValue={(c as OnboardingTemplate).bookingLinkId ?? ""}>
                  <option value="">Ninguna</option>
                  {bookings.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Archivos a pedir" htmlFor="fileRequest">
                <Input id="fileRequest" name="fileRequest" defaultValue={(c as OnboardingTemplate).fileRequest ?? ""} placeholder="Logotipos, accesos, fotografías" />
              </Field>
            </div>
          </>
        )}
      </Card>
      <div className="flex justify-end">
        <SubmitButton>Guardar plantilla</SubmitButton>
      </div>
    </ActionForm>
  );
}
