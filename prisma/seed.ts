/**
 * Semilla de producción: solo crea los planes de suscripción y el superadministrador.
 * No crea clientes ni datos de ejemplo.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PLANS = [
  {
    code: "independiente",
    name: "Independiente",
    accountType: "FREELANCER" as const,
    description: "Para profesionales que trabajan solos y quieren dar una imagen de empresa.",
    priceMonthly: 2900,
    priceYearly: 29000,
    features: [
      "CRM, propuestas y contratos con firma electrónica",
      "Facturas, anticipos, plazos y cobros recurrentes",
      "Portal privado con tu marca para cada cliente",
      "Onboarding y automatizaciones",
      "Asistente de IA (200 usos al mes)",
      "10 GB de almacenamiento",
    ],
    limits: { clients: 50, projects: 25, members: 1, storageMb: 10240, aiCredits: 200 },
    sortOrder: 1,
  },
  {
    code: "independiente-pro",
    name: "Independiente Pro",
    accountType: "FREELANCER" as const,
    description: "Sin límite de clientes para independientes con mucha cartera.",
    priceMonthly: 4900,
    priceYearly: 49000,
    features: ["Todo lo del plan Independiente", "Clientes y proyectos ilimitados", "IA: 1.000 usos al mes", "50 GB de almacenamiento", "Dominio propio del portal"],
    limits: { clients: -1, projects: -1, members: 1, storageMb: 51200, aiCredits: 1000 },
    sortOrder: 2,
  },
  {
    code: "empresa",
    name: "Empresa",
    accountType: "COMPANY" as const,
    description: "Para equipos: departamentos, roles, permisos, carga de trabajo y analítica.",
    priceMonthly: 9900,
    priceYearly: 99000,
    features: [
      "Todo lo del plan Independiente Pro",
      "Hasta 10 miembros del equipo",
      "Departamentos, roles y permisos",
      "Carga de trabajo y productividad",
      "Analítica empresarial avanzada",
      "IA: 3.000 usos al mes",
      "200 GB de almacenamiento",
    ],
    limits: { clients: -1, projects: -1, members: 10, storageMb: 204800, aiCredits: 3000 },
    sortOrder: 3,
  },
  {
    code: "empresa-plus",
    name: "Empresa Plus",
    accountType: "COMPANY" as const,
    description: "Equipos grandes con varias áreas y alto volumen de clientes.",
    priceMonthly: 24900,
    priceYearly: 249000,
    features: ["Todo lo del plan Empresa", "Miembros ilimitados", "IA: 10.000 usos al mes", "1 TB de almacenamiento", "Soporte prioritario"],
    limits: { clients: -1, projects: -1, members: -1, storageMb: 1048576, aiCredits: 10000 },
    sortOrder: 4,
  },
];

async function main() {
  for (const p of PLANS) {
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
  console.log(`${PLANS.length} planes listos.`);
}

main().finally(() => db.$disconnect());
