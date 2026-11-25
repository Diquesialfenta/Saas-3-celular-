import "server-only";
import type { AccountType } from "@prisma/client";
import { db } from "../db";
import { slugify } from "../format";
import { STARTER_FORM, STARTER_TEMPLATES } from "../templates";
import { RECIPES } from "../automations";
import { randomToken } from "../crypto";

/** Crea una cuenta nueva con su suscripción de prueba y el material inicial reutilizable. */
export async function createWorkspace(input: { userId: string; name: string; type: AccountType; planCode?: string }) {
  const base = slugify(input.name) || "cuenta";
  let slug = base;
  for (let i = 0; await db.workspace.findUnique({ where: { slug } }); i++) slug = `${base}-${randomToken(3).toLowerCase()}`;
  const plan =
    (input.planCode && (await db.plan.findFirst({ where: { code: input.planCode, accountType: input.type, isActive: true } }))) ||
    (await db.plan.findFirst({ where: { accountType: input.type, isActive: true }, orderBy: { sortOrder: "asc" } }));
  if (!plan) throw new Error("No hay planes activos para este tipo de cuenta. El administrador debe crear uno.");

  const ws = await db.workspace.create({
    data: {
      name: input.name,
      slug,
      type: input.type,
      portalTitle: `Portal de clientes de ${input.name}`,
      memberships: { create: { userId: input.userId, role: "OWNER" } },
      subscription: {
        create: {
          planId: plan.id,
          status: plan.priceMonthly === 0 ? "ACTIVE" : "TRIALING",
          trialEndsAt: plan.priceMonthly === 0 ? null : new Date(Date.now() + plan.trialDays * 86400_000),
        },
      },
    },
  });
  await seedWorkspaceDefaults(ws.id);
  return ws;
}

export async function seedWorkspaceDefaults(workspaceId: string) {
  for (const t of STARTER_TEMPLATES) {
    await db.template.create({ data: { workspaceId, type: t.type, name: t.name, description: t.description, content: t.content as object } });
  }
  const form = await db.form.create({ data: { workspaceId, ...STARTER_FORM } });
  await db.template.create({ data: { workspaceId, type: "FORM", name: form.name, description: "Formulario de información inicial", content: { formId: form.id } } });
  await db.survey.create({
    data: { workspaceId, name: "Satisfacción al cierre", kind: "NPS", question: "Del 0 al 10, ¿con qué probabilidad nos recomendarías?", followUp: "¿Qué es lo que más valoraste y qué mejorarías?" },
  });
  await db.bookingLink.create({
    data: {
      workspaceId,
      slug: `reunion-${randomToken(5).toLowerCase()}`,
      title: "Reunión estratégica inicial",
      description: "Revisamos objetivos, calendario y próximos pasos.",
      durationMin: 45,
      availability: { days: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" },
    },
  });
  for (const r of RECIPES) {
    await db.automation.create({ data: { workspaceId, name: r.name, trigger: r.trigger, actions: r.actions, isActive: true } });
  }
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
  await db.$transaction([
    db.workspace.update({ where: { id: workspaceId }, data: { type: "COMPANY", upgradedAt: new Date() } }),
    db.subscription.update({
      where: { workspaceId },
      data: { planId: plan.id, status: "TRIALING", trialEndsAt: new Date(Date.now() + plan.trialDays * 86400_000) },
    }),
  ]);
}
