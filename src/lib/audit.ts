import "server-only";
import { db } from "./db";

export async function audit(entry: {
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      workspaceId: entry.workspaceId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: (entry.meta ?? undefined) as object | undefined,
    },
  });
}

export async function activity(entry: {
  workspaceId: string;
  clientId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
  type?: string;
  content: string;
  userId?: string | null;
}) {
  await db.activity.create({
    data: {
      workspaceId: entry.workspaceId,
      clientId: entry.clientId ?? null,
      dealId: entry.dealId ?? null,
      projectId: entry.projectId ?? null,
      type: entry.type ?? "SYSTEM",
      content: entry.content,
      userId: entry.userId ?? null,
    },
  });
}

/** Notifica a los miembros de la cuenta (o a uno). */
export async function notifyTeam(workspaceId: string, n: { title: string; body?: string; link?: string; userId?: string | null }) {
  const userIds = n.userId
    ? [n.userId]
    : (await db.membership.findMany({ where: { workspaceId, role: { in: ["OWNER", "ADMIN", "MANAGER"] } }, select: { userId: true } })).map(
        (m) => m.userId,
      );
  if (userIds.length === 0) return;
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, workspaceId, title: n.title, body: n.body, link: n.link })),
  });
}

export async function nextNumber(workspaceId: string, kind: "proposal" | "contract" | "invoice") {
  const field = `${kind}Seq` as const;
  const ws = await db.workspace.update({
    where: { id: workspaceId },
    data: { [field]: { increment: 1 } },
    select: { proposalSeq: true, contractSeq: true, invoiceSeq: true },
  });
  const n = ws[field];
  const prefix = kind === "proposal" ? "PRO" : kind === "contract" ? "CON" : "FAC";
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}
