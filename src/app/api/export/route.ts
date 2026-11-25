import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/tenant";

/** Exportación completa de los datos de la cuenta (portabilidad). Solo con permiso de configuración. */
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx || !ctx.can("settings.manage")) return new Response("No autorizado", { status: 403 });
  const where = { workspaceId: ctx.workspaceId };
  const [clients, contacts, deals, proposals, contracts, invoices, payments, projects, tasks, deliverables, documents, meetings, tickets, templates, forms, formRequests] = await Promise.all([
    db.client.findMany({ where }),
    db.contact.findMany({ where }),
    db.deal.findMany({ where }),
    db.proposal.findMany({ where, include: { items: true } }),
    db.contract.findMany({ where, include: { signers: { select: { party: true, name: true, email: true, signedAt: true, typedName: true, ip: true, hashAtSigning: true } } } }),
    db.invoice.findMany({ where, include: { items: true } }),
    db.payment.findMany({ where }),
    db.project.findMany({ where, include: { stages: true, milestones: true } }),
    db.task.findMany({ where }),
    db.deliverable.findMany({ where, include: { reviews: true } }),
    db.document.findMany({ where }),
    db.meeting.findMany({ where }),
    db.ticket.findMany({ where, include: { messages: true } }),
    db.template.findMany({ where }),
    db.form.findMany({ where }),
    db.formRequest.findMany({ where }),
  ]);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), workspace: { name: ctx.workspace.name, type: ctx.workspace.type }, clients, contacts, deals, proposals, contracts, invoices, payments, projects, tasks, deliverables, documents, meetings, tickets, templates, forms, formRequests },
    null,
    2,
  );
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="encauza-${ctx.workspace.slug}-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
