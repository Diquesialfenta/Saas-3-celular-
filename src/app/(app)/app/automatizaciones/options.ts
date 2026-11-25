import "server-only";
import { db } from "@/lib/db";
import { ACTIONS, TRIGGERS } from "@/lib/automations";

export async function builderOptions(workspaceId: string) {
  const [templates, forms, surveys] = await Promise.all([
    db.template.findMany({ where: { workspaceId, type: { in: ["CONTRACT", "PROJECT", "ONBOARDING"] } }, select: { id: true, name: true, type: true } }),
    db.form.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    db.survey.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
  ]);
  return {
    triggers: Object.entries(TRIGGERS).map(([value, label]) => ({ value, label })),
    actions: Object.entries(ACTIONS).map(([value, a]) => ({ value, label: a.label, fields: [...a.fields] })),
    templates,
    forms: forms.map((f) => ({ value: f.id, label: f.name })),
    surveys: surveys.map((s) => ({ value: s.id, label: s.name })),
  };
}

