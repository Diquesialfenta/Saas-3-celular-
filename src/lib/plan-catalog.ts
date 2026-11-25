import "server-only";
import { bindings } from "./bindings";
import { DEFAULT_PLANS } from "./default-plans";

const INITIALIZED = "default-plans-initialized";

export async function ensurePlanCatalog() {
  const { DB } = bindings();
  const marker = await DB.prepare('SELECT 1 FROM "PlatformSetting" WHERE "key" = ?').bind(INITIALIZED).first();
  if (marker) return;

  const now = new Date().toISOString();
  await DB.batch([
    ...DEFAULT_PLANS.map((plan) => DB.prepare(`
      INSERT INTO "Plan" ("id", "code", "name", "accountType", "description", "priceMonthly", "priceYearly", "features", "limits", "sortOrder", "createdAt", "updatedAt")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT("code") DO NOTHING
    `).bind(
      `plan-${plan.code}`, plan.code, plan.name, plan.accountType, plan.description,
      plan.priceMonthly, plan.priceYearly, JSON.stringify(plan.features), JSON.stringify(plan.limits),
      plan.sortOrder, now, now,
    )),
    DB.prepare('INSERT INTO "PlatformSetting" ("key", "value", "updatedAt") VALUES (?, ?, ?) ON CONFLICT("key") DO NOTHING')
      .bind(INITIALIZED, "true", now),
  ]);
}
