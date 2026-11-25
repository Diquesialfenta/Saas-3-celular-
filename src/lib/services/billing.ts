import "server-only";
import { db } from "../db";
import { nextNumber, activity, notifyTeam } from "../audit";
import { emit } from "../automations";
import { emailLayout, sendEmail } from "../email";
import { appUrl } from "../config";
import { money } from "../format";

export type LineInput = { description: string; quantity: number; unitPrice: number };

export function computeTotals(items: LineInput[], taxRate: number, discount: number) {
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const base = Math.max(0, subtotal - discount);
  const tax = Math.round((base * taxRate) / 100);
  return { subtotal, tax, total: base + tax };
}

export async function createInvoice(input: {
  workspaceId: string;
  clientId: string;
  items: LineInput[];
  dueDate: Date;
  currency: string;
  taxRate?: number;
  discount?: number;
  title?: string | null;
  notes?: string | null;
  kind?: string;
  projectId?: string | null;
  proposalId?: string | null;
  recurringPlanId?: string | null;
  installmentGroup?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
}) {
  const taxRate = input.taxRate ?? 0;
  const discount = input.discount ?? 0;
  const totals = computeTotals(input.items, taxRate, discount);
  const number = await nextNumber(input.workspaceId, "invoice");
  return db.invoice.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      number,
      title: input.title,
      notes: input.notes,
      kind: input.kind ?? "STANDARD",
      currency: input.currency,
      dueDate: input.dueDate,
      taxRate,
      discount,
      ...totals,
      projectId: input.projectId ?? null,
      proposalId: input.proposalId ?? null,
      recurringPlanId: input.recurringPlanId ?? null,
      installmentGroup: input.installmentGroup ?? null,
      installmentIndex: input.installmentIndex ?? null,
      installmentCount: input.installmentCount ?? null,
      items: { create: input.items.map((i, idx) => ({ ...i, sortOrder: idx })) },
    },
  });
}

/**
 * Genera las facturas de una propuesta aceptada respetando anticipo y fraccionamiento.
 * - anticipo (depositPercent) → factura DEPOSIT con vencimiento inmediato
 * - resto en N plazos mensuales (installments)
 */
export async function invoicesFromProposal(workspaceId: string, proposalId: string) {
  const p = await db.proposal.findFirst({ where: { id: proposalId, workspaceId }, include: { items: true } });
  if (!p) throw new Error("Propuesta no encontrada");
  const existing = await db.invoice.count({ where: { workspaceId, proposalId } });
  if (existing > 0) return [];
  const selected = p.items.filter((i) => !i.isOptional || i.isSelected).filter((i) => i.recurring === "NONE");
  const lines = selected.map((i) => ({ description: i.name, quantity: i.quantity, unitPrice: i.unitPrice }));
  const { total } = computeTotals(lines, p.taxRate, p.discount);
  if (total <= 0) return [];
  const created = [];
  const group = `prop-${p.id}`;
  const deposit = Math.round((total * p.depositPercent) / 100);
  const rest = total - deposit;
  const parts = Math.max(1, p.installments);
  const count = (deposit > 0 ? 1 : 0) + (rest > 0 ? parts : 0);
  let index = 0;
  const now = new Date();
  // Las facturas parciales se emiten como un concepto único con impuestos ya incluidos.
  if (deposit > 0) {
    index++;
    created.push(
      await createInvoice({
        workspaceId,
        clientId: p.clientId,
        proposalId: p.id,
        currency: p.currency,
        title: `Anticipo ${p.depositPercent}% · ${p.title}`,
        kind: "DEPOSIT",
        items: [{ description: `Anticipo del ${p.depositPercent}% de la propuesta ${p.number}`, quantity: 1, unitPrice: deposit }],
        dueDate: new Date(now.getTime() + 3 * 86400_000),
        installmentGroup: group,
        installmentIndex: index,
        installmentCount: count,
      }),
    );
  }
  if (rest > 0) {
    const base = Math.floor(rest / parts);
    for (let k = 0; k < parts; k++) {
      index++;
      const amount = k === parts - 1 ? rest - base * (parts - 1) : base;
      const due = new Date(now);
      due.setMonth(due.getMonth() + k + (deposit > 0 ? 1 : 0));
      due.setDate(due.getDate() + 7);
      created.push(
        await createInvoice({
          workspaceId,
          clientId: p.clientId,
          proposalId: p.id,
          currency: p.currency,
          title: parts > 1 ? `Plazo ${k + 1} de ${parts} · ${p.title}` : p.title,
          kind: parts > 1 ? "INSTALLMENT" : "STANDARD",
          items: [
            {
              description: parts > 1 ? `Plazo ${k + 1} de ${parts} de la propuesta ${p.number}` : `Saldo de la propuesta ${p.number}`,
              quantity: 1,
              unitPrice: amount,
            },
          ],
          dueDate: due,
          installmentGroup: group,
          installmentIndex: index,
          installmentCount: count,
        }),
      );
    }
  }
  // Conceptos recurrentes → plan de cobro recurrente
  const recurring = p.items.filter((i) => (!i.isOptional || i.isSelected) && i.recurring !== "NONE");
  for (const r of recurring) {
    await db.recurringPlan.create({
      data: {
        workspaceId,
        clientId: p.clientId,
        name: r.name,
        currency: p.currency,
        items: [{ description: r.name, quantity: r.quantity, unitPrice: r.unitPrice }],
        taxRate: p.taxRate,
        interval: r.recurring === "YEARLY" ? "YEAR" : "MONTH",
        nextRunAt: new Date(),
      },
    });
  }
  return created;
}

export async function sendInvoice(workspaceId: string, invoiceId: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, workspaceId }, include: { client: true, workspace: true } });
  if (!inv) throw new Error("Factura no encontrada");
  const url = appUrl(`/i/${inv.publicToken}`);
  let email: Awaited<ReturnType<typeof sendEmail>> | null = null;
  if (inv.client.email) {
    email = await sendEmail({
      workspaceId,
      to: inv.client.email,
      subject: `Factura ${inv.number} de ${inv.workspace.name}`,
      html: emailLayout(
        inv.workspace,
        `Factura ${inv.number}`,
        `Hola ${inv.client.name},\n\nTe enviamos la factura ${inv.number} por ${money(inv.total, inv.currency)}, con vencimiento el ${inv.dueDate.toLocaleDateString("es")}.`,
        { label: "Ver y pagar la factura", url },
      ),
    });
  }
  await db.invoice.update({
    where: { id: inv.id },
    data: { sentAt: new Date(), status: inv.status === "DRAFT" ? "SENT" : inv.status },
  });
  return { url, email };
}

export async function recordPayment(input: {
  workspaceId: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date;
  recordedById?: string | null;
}) {
  const inv = await db.invoice.findFirst({ where: { id: input.invoiceId, workspaceId: input.workspaceId } });
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.status === "VOID") throw new Error("La factura está anulada.");
  if (input.amount <= 0) throw new Error("El importe debe ser mayor que cero.");
  if (input.reference) {
    const dup = await db.payment.findFirst({ where: { invoiceId: inv.id, reference: input.reference } });
    if (dup) return { invoice: inv, duplicated: true };
  }
  await db.payment.create({
    data: {
      workspaceId: input.workspaceId,
      invoiceId: inv.id,
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      paidAt: input.paidAt ?? new Date(),
      recordedById: input.recordedById ?? null,
    },
  });
  const amountPaid = inv.amountPaid + input.amount;
  const paid = amountPaid >= inv.total;
  const updated = await db.invoice.update({
    where: { id: inv.id },
    data: { amountPaid, status: paid ? "PAID" : "PARTIAL", paidAt: paid ? new Date() : null },
  });
  await activity({
    workspaceId: inv.workspaceId,
    clientId: inv.clientId,
    content: `Cobro de ${money(input.amount, inv.currency)} en la factura ${inv.number}${paid ? " (pagada)" : ""}`,
  });
  if (paid) {
    await notifyTeam(inv.workspaceId, { title: `Factura ${inv.number} pagada`, link: `/app/facturacion/${inv.id}` });
    await emit(inv.workspaceId, "invoice.paid", { clientId: inv.clientId, invoiceId: inv.id, projectId: inv.projectId ?? undefined, proposalId: inv.proposalId ?? undefined });
  }
  return { invoice: updated, duplicated: false };
}

export function addInterval(d: Date, interval: string) {
  const n = new Date(d);
  if (interval === "WEEK") n.setDate(n.getDate() + 7);
  else if (interval === "QUARTER") n.setMonth(n.getMonth() + 3);
  else if (interval === "YEAR") n.setFullYear(n.getFullYear() + 1);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

/** Ejecuta los planes recurrentes vencidos (llamado por /api/cron y al abrir facturación). */
export async function runRecurringPlans(workspaceId?: string) {
  const due = await db.recurringPlan.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: new Date() }, ...(workspaceId ? { workspaceId } : {}) },
  });
  let created = 0;
  for (const plan of due) {
    if (plan.endsAt && plan.endsAt < new Date()) {
      await db.recurringPlan.update({ where: { id: plan.id }, data: { status: "CANCELED" } });
      continue;
    }
    const items = (plan.items as LineInput[]) ?? [];
    const inv = await createInvoice({
      workspaceId: plan.workspaceId,
      clientId: plan.clientId,
      items,
      currency: plan.currency,
      taxRate: plan.taxRate,
      title: plan.name,
      kind: "RECURRING",
      recurringPlanId: plan.id,
      dueDate: new Date(Date.now() + plan.dueDays * 86400_000),
    });
    if (plan.autoSend) await sendInvoice(plan.workspaceId, inv.id);
    await db.recurringPlan.update({ where: { id: plan.id }, data: { nextRunAt: addInterval(plan.nextRunAt, plan.interval) } });
    created++;
  }
  // Marca vencidas
  await db.invoice.updateMany({
    where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: new Date() }, ...(workspaceId ? { workspaceId } : {}) },
    data: { status: "OVERDUE" },
  });
  return created;
}
