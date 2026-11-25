/**
 * Semilla de producción: solo crea los planes de suscripción y el superadministrador.
 * No crea clientes ni datos de ejemplo.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getPlatformProxy } from "wrangler";
import { DEFAULT_PLANS } from "../src/lib/default-plans";

async function main(db: PrismaClient) {
  for (const p of DEFAULT_PLANS) {
    await db.plan.upsert({ where: { code: p.code }, create: p, update: {} });
  }
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (email && password) {
    await db.user.upsert({
      where: { email },
      create: { email, name: "Administrador", passwordHash: await bcrypt.hash(password, 12), isSuperadmin: true },
      update: { isSuperadmin: true },
    });
    console.log(`Superadministrador listo: ${email}`);
  } else {
    console.log("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD no definidos: no se creó superadministrador.");
  }
  console.log(`${DEFAULT_PLANS.length} planes listos.`);
}

async function seedLocal() {
  const platform = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc" });
  const db = new PrismaClient({ adapter: new PrismaD1(platform.env.DB) });
  try {
    await main(db);
  } finally {
    await db.$disconnect();
    await platform.dispose();
  }
}

seedLocal().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
