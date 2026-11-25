import "server-only";
import type { AccountType } from "@prisma/client";
import { db } from "../db";
import { bindings } from "../bindings";
import { ensurePlanCatalog } from "../plan-catalog";
import { slugify } from "../format";
import { STARTER_FORM, STARTER_TEMPLATES } from "../templates";
import { RECIPES } from "../automations";
import { randomToken } from "../crypto";

type WorkspaceOwner = { userId: string } | { newUser: { email: string; name: string; passwordHash: string } };

/** Crea la cuenta, el propietario y sus datos iniciales en un único lote D1. */
export async function createWorkspace(input: WorkspaceOwner & { name: string; type: AccountType; planCode?: string }) {
  await ensurePlanCatalog();
  const base = slugify(input.name) || "cuenta";
  let slug = base;
  while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${randomToken(6).toLowerCase()}`;
  }
  const plan =
    (input.planCode && (await db.plan.findFirst({ where: { code: input.planCode, accountType: input.type, isActive: true } }))) ||
    (await db.plan.findFirst({ where: { accountType: input.type, isActive: true }, orderBy: { sortOrder: "asc" } }));
  if (!plan) throw new Error("No hay planes activos para este tipo de cuenta. El administrador debe crear uno.");

  const { DB } = bindings();
  const workspaceId = randomToken(18);
  const userId = "userId" in input ? input.userId : randomToken(18);
  const formId = randomToken(18);
  const now = new Date().toISOString();
  const trial = plan.priceMonthly !== 0;
  const template = (type: string, name: string, description: string, content: unknown) =>
    DB.prepare('INSERT INTO "Template" ("id", "workspaceId", "type", "name", "description", "content", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, type, name, description, JSON.stringify(content), now, now);

  const statements = [];
  if ("newUser" in input) {
    const { email, name, passwordHash } = input.newUser;
    statements.push(DB.prepare('INSERT INTO "User" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, email, name, passwordHash, now, now));
  }
  statements.push(
    DB.prepare('INSERT INTO "Workspace" ("id", "slug", "name", "type", "portalTitle", "icsToken", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(workspaceId, slug, input.name, input.type, `Portal de clientes de ${input.name}`, randomToken(), now, now),
    DB.prepare('INSERT INTO "Membership" ("id", "workspaceId", "userId", "role", "createdAt") VALUES (?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, userId, "OWNER", now),
    DB.prepare('INSERT INTO "Subscription" ("id", "workspaceId", "planId", "status", "trialEndsAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, plan.id, trial ? "TRIALING" : "ACTIVE", trial ? new Date(Date.now() + plan.trialDays * 86400_000).toISOString() : null, now, now),
    ...STARTER_TEMPLATES.map((item) => template(item.type, item.name, item.description, item.content)),
    DB.prepare('INSERT INTO "Form" ("id", "workspaceId", "name", "description", "fields", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(formId, workspaceId, STARTER_FORM.name, STARTER_FORM.description, JSON.stringify(STARTER_FORM.fields), now, now),
    template("FORM", STARTER_FORM.name, "Formulario de información inicial", { formId }),
    DB.prepare('INSERT INTO "Survey" ("id", "workspaceId", "name", "kind", "question", "followUp", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, "Satisfacción al cierre", "NPS", "Del 0 al 10, ¿con qué probabilidad nos recomendarías?", "¿Qué es lo que más valoraste y qué mejorarías?", now),
    DB.prepare('INSERT INTO "BookingLink" ("id", "workspaceId", "slug", "title", "description", "durationMin", "availability", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, `reunion-${randomToken(5).toLowerCase()}`, "Reunión estratégica inicial", "Revisamos objetivos, calendario y próximos pasos.", 45, JSON.stringify({ days: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" }), now),
    ...RECIPES.map((recipe) => DB.prepare('INSERT INTO "Automation" ("id", "workspaceId", "name", "trigger", "actions", "isActive", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(randomToken(18), workspaceId, recipe.name, recipe.trigger, JSON.stringify(recipe.actions), 1, now, now)),
  );
  await DB.batch(statements);
  return { id: workspaceId, userId };
}

export type PlanLimits = { clients: number; projects: number; members: number; storageMb: number; aiCredits: number };

/** -1 = ilimitado. */
export async function checkLimit(workspaceId: string, key: keyof PlanLimits) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  const limits = (sub?.plan.limits ?? {}) as Partial<PlanLimits>;
  const limit = limits[key] ?? -1;
  if (limit < 0) return { ok: true, limit, used: 0 };
  let used = 0;
  if (key === "clients") used = await db.client.count({ where: { workspaceId, status: { not: "ARCHIVED" } } });
  if (key === "projects") used = await db.project.count({ where: { workspaceId, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } } });
  if (key === "members") used = await db.membership.count({ where: { workspaceId } });
  if (key === "storageMb") {
    const agg = await db.fileVersion.aggregate({ where: { file: { workspaceId } }, _sum: { size: true } });
    used = Math.round((agg._sum.size ?? 0) / 1024 / 1024);
  }
  if (key === "aiCredits") {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    used = await db.aiUsage.count({ where: { workspaceId, createdAt: { gte: start } } });
  }
  return { ok: used < limit, limit, used };
}

export async function assertLimit(workspaceId: string, key: keyof PlanLimits, label: string) {
  const r = await checkLimit(workspaceId, key);
  if (!r.ok) throw new Error(`Has alcanzado el límite de ${label} de tu plan (${r.limit}). Mejora tu plan para continuar.`);
}

/**
 * Convierte una cuenta de independiente en empresa conservando todos los datos:
 * es la misma cuenta (mismo id), solo cambian el tipo y el plan.
 */
export async function upgradeToCompany(workspaceId: string, planId: string) {
  const plan = await db.plan.findFirst({ where: { id: planId, accountType: "COMPANY", isActive: true } });
  if (!plan) throw new Error("Plan de empresa no válido");
  await updateWorkspaceSubscription(workspaceId, {
    planId: plan.id,
    type: "COMPANY",
    upgradedAt: new Date(),
    status: "TRIALING",
    trialEndsAt: new Date(Date.now() + plan.trialDays * 86400_000),
  });
}

export async function updateWorkspaceSubscription(workspaceId: string, input: {
  planId: string; type: AccountType; upgradedAt: Date | null; status: string;
  trialEndsAt: Date | null; currentPeriodEnd?: Date | null;
}) {
  const { DB } = bindings();
  const now = new Date().toISOString();
  await DB.batch([
    DB.prepare(`
      UPDATE "Subscription" SET "planId" = ?, "status" = ?, "trialEndsAt" = ?,
        "currentPeriodEnd" = CASE WHEN ? THEN ? ELSE "currentPeriodEnd" END, "updatedAt" = ?
        WHERE "workspaceId" = ?
    `).bind(input.planId, input.status, input.trialEndsAt?.toISOString() ?? null,
      Number(input.currentPeriodEnd !== undefined), input.currentPeriodEnd?.toISOString() ?? null, now, workspaceId),
    DB.prepare(`
      UPDATE "Workspace" SET "type" = ?, "upgradedAt" = ?, "updatedAt" = ?
        WHERE "id" = ? AND EXISTS (SELECT 1 FROM "Subscription" WHERE "workspaceId" = ?)
    `).bind(input.type, input.upgradedAt?.toISOString() ?? null, now, workspaceId, workspaceId),
  ]);
}
