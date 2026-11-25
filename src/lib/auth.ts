import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "enc_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, workspaceId?: string | null) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      workspaceId: workspaceId ?? null,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300),
      ip: clientIp(h),
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

/** Sesión actual (memoizada por petición). */
export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.isSuspended) return null;
  return session;
});

export async function getCurrentUser() {
  return (await getSession())?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionWorkspace(workspaceId: string) {
  const session = await getSession();
  if (!session) return;
  await db.session.update({ where: { id: session.id }, data: { workspaceId } });
}

export async function requireSuperadmin() {
  const user = await requireUser();
  if (!user.isSuperadmin) redirect("/app");
  return user;
}
