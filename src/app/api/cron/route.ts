import { db } from "@/lib/db";
import { runRecurringPlans } from "@/lib/services/billing";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/config";

/**
 * Tareas periódicas. Llamar cada hora con: Authorization: Bearer {CRON_SECRET}
 * - genera y envía las facturas recurrentes vencidas y marca las vencidas
 * - caduca propuestas fuera de plazo
 * - recuerda al cliente las facturas que vencen en 3 días (una vez)
 * - limpia sesiones e invitaciones caducadas
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.APP_SECRET;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("No autorizado", { status: 401 });
  const created = await runRecurringPlans();
  const expired = await db.proposal.updateMany({ where: { status: { in: ["SENT", "VIEWED"] }, validUntil: { lt: new Date() } }, data: { status: "EXPIRED" } });
  const soon = await db.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { gte: new Date(), lte: new Date(Date.now() + 3 * 86400_000) } },
    include: { client: true, workspace: true },
  });
  let reminders = 0;
  for (const inv of soon) {
    const already = await db.emailLog.findFirst({ where: { workspaceId: inv.workspaceId, subject: { contains: `Recordatorio: factura ${inv.number}` } } });
    if (already || !inv.client.email) continue;
    await sendEmail({
      workspaceId: inv.workspaceId,
      to: inv.client.email,
      subject: `Recordatorio: factura ${inv.number} de ${inv.workspace.name}`,
      html: emailLayout(inv.workspace, `Tu factura ${inv.number} vence pronto`, `Hola ${inv.client.name},\n\nTe recordamos que la factura ${inv.number} vence el ${inv.dueDate.toLocaleDateString("es")}.`, { label: "Ver y pagar", url: appUrl(`/i/${inv.publicToken}`) }),
    });
    reminders++;
  }
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.token.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  return Response.json({ recurringInvoices: created, expiredProposals: expired.count, reminders });
}
