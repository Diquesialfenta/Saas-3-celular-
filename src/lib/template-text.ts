/**
 * Formato de texto editable para plantillas estructuradas.
 * Proyecto:
 *   # Etapa
 *   - Tarea | 3 | HIGH | cliente
 *   @ Hito | 10
 * Propuesta (secciones):
 *   ## Título
 *   Texto…
 * Propuesta (conceptos):
 *   Nombre | precio | cantidad | opcional | mensual
 */
import type { ProjectTemplate, ProposalTemplate } from "./templates";

export function projectToText(t: ProjectTemplate) {
  const out: string[] = [];
  for (const s of t.stages) {
    out.push(`# ${s.name}`);
    for (const k of s.tasks) out.push(`- ${k.title} | ${k.offsetDays ?? 0}${k.priority && k.priority !== "MEDIUM" ? ` | ${k.priority}` : ""}${k.forClient ? " | cliente" : ""}`);
    out.push("");
  }
  for (const m of t.milestones) out.push(`@ ${m.title} | ${m.offsetDays}`);
  return out.join("\n").trim();
}

export function textToProject(text: string, objectives: string[]): ProjectTemplate {
  const stages: ProjectTemplate["stages"] = [];
  const milestones: ProjectTemplate["milestones"] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) stages.push({ name: line.replace(/^#+/, "").trim(), tasks: [] });
    else if (line.startsWith("@")) {
      const [title, days] = line.slice(1).split("|").map((s) => s.trim());
      milestones.push({ title, offsetDays: Number(days) || 0 });
    } else if (line.startsWith("-")) {
      const parts = line.slice(1).split("|").map((s) => s.trim());
      if (!stages.length) stages.push({ name: "General", tasks: [] });
      const priority = parts.find((p) => ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p.toUpperCase()));
      stages[stages.length - 1].tasks.push({
        title: parts[0],
        offsetDays: Number(parts[1]) || 0,
        priority: priority?.toUpperCase(),
        forClient: parts.some((p) => p.toLowerCase() === "cliente"),
      });
    }
  }
  if (!stages.length) throw new Error("Añade al menos una etapa con «# Nombre de la etapa».");
  return { objectives, stages, milestones };
}

export function sectionsToText(sections: { title: string; body: string }[]) {
  return sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n");
}

export function textToSections(text: string) {
  const out: { title: string; body: string }[] = [];
  for (const block of text.split(/^##\s+/m)) {
    if (!block.trim()) continue;
    const [title, ...rest] = block.split("\n");
    out.push({ title: title.trim(), body: rest.join("\n").trim() });
  }
  return out;
}

export function itemsToText(items: ProposalTemplate["items"]) {
  return items
    .map((i) => [i.name, (i.unitPrice / 100).toFixed(2), i.quantity, i.isOptional ? "opcional" : "", i.recurring === "MONTHLY" ? "mensual" : i.recurring === "YEARLY" ? "anual" : ""].filter((x) => x !== "").join(" | "))
    .join("\n");
}

export function textToItems(text: string): ProposalTemplate["items"] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const p = l.split("|").map((s) => s.trim());
      const flags = p.slice(3).map((x) => x.toLowerCase());
      return {
        name: p[0],
        unitPrice: Math.round((Number((p[1] ?? "0").replace(",", ".")) || 0) * 100),
        quantity: Number(p[2]) || 1,
        isOptional: flags.includes("opcional"),
        recurring: flags.includes("mensual") ? "MONTHLY" : flags.includes("anual") ? "YEARLY" : "NONE",
      };
    });
}
