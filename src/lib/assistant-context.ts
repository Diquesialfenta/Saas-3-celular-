import "server-only";
import { db } from "./db";
import { money, date } from "./format";
import type { WorkspaceContext } from "./tenant";

/** Contexto del asistente del equipo: solo lo que los permisos del usuario le dejan ver. */
export async function teamContext(ctx: WorkspaceContext) {
  const ws = ctx.workspaceId;
  const lines: string[] = [`Cuenta: ${ctx.workspace.name} (${ctx.isCompany ? "empresa" : "profesional independiente"}). Usuario: ${ctx.user.name}. Hoy: ${date(new Date())}.`];
  if (ctx.can("clients.view")) {
    const clients = await db.client.findMany({ where: { workspaceId: ws, status: { not: "ARCHIVED" } }, take: 60, orderBy: { updatedAt: "desc" } });
    lines.push(`\nClientes (${clients.length}):`, ...clients.map((c) => `- ${c.name} · ${c.status}${c.industry ? ` · ${c.industry}` : ""}`));
  }
  if (ctx.can("sales.manage")) {
    const deals = await db.deal.findMany({ where: { workspaceId: ws, status: "OPEN" }, include: { client: true }, take: 40 });
    lines.push(`\nOportunidades abiertas:`, ...deals.map((d) => `- ${d.title} (${d.client.name}) · etapa ${d.stage} · ${money(d.value, d.currency)} · ${d.probability}%`));
    const props = await db.proposal.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "VIEWED"] } }, include: { client: true }, take: 30 });
    lines.push(`\nPropuestas pendientes de respuesta:`, ...props.map((p) => `- ${p.number} ${p.title} (${p.client.name}) · ${p.status}${p.sentAt ? ` · enviada ${date(p.sentAt)}` : ""}`));
  }
  if (ctx.can("billing.view")) {
    const invs = await db.invoice.findMany({ where: { workspaceId: ws, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, include: { client: true }, take: 40 });
    lines.push(`\nFacturas por cobrar:`, ...invs.map((i) => `- ${i.number} ${i.client.name} · ${money(i.total - i.amountPaid, i.currency)} pendiente · vence ${date(i.dueDate)} · ${i.status}`));
  }
  const projectWhere = ctx.can("projects.view_all") ? { workspaceId: ws } : { workspaceId: ws, tasks: { some: { assigneeId: ctx.user.id } } };
  const projects = await db.project.findMany({ where: { ...projectWhere, status: { in: ["ACTIVE", "PLANNING", "ON_HOLD"] } }, include: { client: true }, take: 30 });
  lines.push(`\nProyectos en curso:`, ...projects.map((p) => `- ${p.name} (${p.client.name}) · ${p.status}${p.dueDate ? ` · entrega ${date(p.dueDate)}` : ""}`));
  const tasks = await db.task.findMany({
    where: { workspaceId: ws, assigneeId: ctx.user.id, status: { not: "DONE" } },
    include: { project: true },
    orderBy: { dueDate: "asc" },
    take: 40,
  });
  lines.push(`\nMis tareas pendientes:`, ...tasks.map((t) => `- ${t.title} · ${t.project.name} · ${t.priority}${t.dueDate ? ` · vence ${date(t.dueDate)}` : ""}`));
  if (ctx.can("support.manage")) {
    const tickets = await db.ticket.findMany({ where: { workspaceId: ws, status: { in: ["OPEN", "PENDING"] } }, take: 20 });
    lines.push(`\nTickets abiertos:`, ...tickets.map((t) => `- #${t.number} ${t.subject} · ${t.status}`));
  }
  return lines.join("\n");
}

/** Contexto del asistente del portal: solo los datos de ese cliente visibles para él. */
export async function portalContext(workspaceId: string, clientId: string) {
  const client = await db.client.findFirstOrThrow({ where: { id: clientId, workspaceId }, include: { workspace: true } });
  const [projects, invoices, contracts, deliverables, meetings, docs, forms, tasks] = await Promise.all([
    db.project.findMany({ where: { workspaceId, clientId, visibleToClient: true }, include: { milestones: { where: { visibleToClient: true } } } }),
    db.invoice.findMany({ where: { workspaceId, clientId, status: { not: "DRAFT" } } }),
    db.contract.findMany({ where: { workspaceId, clientId, status: { not: "DRAFT" } } }),
    db.deliverable.findMany({ where: { workspaceId, project: { clientId, visibleToClient: true }, status: { not: "DRAFT" } }, include: { project: true } }),
    db.meeting.findMany({ where: { workspaceId, clientId, visibleToClient: true, startsAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
    db.document.findMany({ where: { workspaceId, clientId, visibleToClient: true } }),
    db.formRequest.findMany({ where: { workspaceId, clientId, status: "PENDING" }, include: { form: true } }),
    db.task.findMany({ where: { workspaceId, project: { clientId }, forClient: true, status: { not: "DONE" } } }),
  ]);
  return [
    `Proveedor: ${client.workspace.name}. Cliente: ${client.name}. Hoy: ${date(new Date())}.`,
    `\nProyectos:`,
    ...projects.map((p) => `- ${p.name} · ${p.status}${p.dueDate ? ` · entrega prevista ${date(p.dueDate)}` : ""}${p.milestones.length ? ` · hitos: ${p.milestones.map((m) => `${m.title} (${m.completedAt ? "hecho" : date(m.dueDate)})`).join(", ")}` : ""}`),
    `\nEntregables:`,
    ...deliverables.map((d) => `- ${d.title} (${d.project.name}) · ${d.status}`),
    `\nFacturas:`,
    ...invoices.map((i) => `- ${i.number} · ${money(i.total, i.currency)} · pagado ${money(i.amountPaid, i.currency)} · vence ${date(i.dueDate)} · ${i.status}`),
    `\nContratos:`,
    ...contracts.map((c) => `- ${c.number} ${c.title} · ${c.status}`),
    `\nReuniones:`,
    ...meetings.map((m) => `- ${m.title} · ${date(m.startsAt, { dateStyle: "medium", timeStyle: "short" })} · ${m.status}`),
    `\nDocumentos: ${docs.map((d) => d.title).join(", ") || "ninguno"}`,
    `\nPendiente del cliente: ${[...forms.map((f) => `formulario "${f.form.name}"`), ...tasks.map((t) => t.title)].join("; ") || "nada"}`,
  ].join("\n");
}
