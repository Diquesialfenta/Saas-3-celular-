import "server-only";
import { headers } from "next/headers";
import { bindings } from "./bindings";
import { db } from "./db";

export async function getInitialOwner() {
  const email = process.env.SITES_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const identity = await headers();
  if (!identity.get("oai-authenticated-user-id") || identity.get("oai-authenticated-user-email")?.trim().toLowerCase() !== email) return null;
  if (await db.user.findFirst({ where: { isSuperadmin: true }, select: { id: true } })) return null;
  return email;
}

export async function provisionInitialOwner(user: { id: string; email: string; passwordHash: string }) {
  const { DB } = bindings();
  const now = new Date().toISOString();
  // La condición y la escritura son una sola sentencia, incluso si llegan dos peticiones.
  const result = await DB.prepare(`
    INSERT INTO "User" ("id", "email", "name", "passwordHash", "isSuperadmin", "createdAt", "updatedAt")
    SELECT ?, ?, 'Administrador', ?, 1, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "isSuperadmin" = 1)
    ON CONFLICT ("email") DO NOTHING
  `).bind(user.id, user.email, user.passwordHash, now, now).run();
  return result.meta.changes === 1;
}
