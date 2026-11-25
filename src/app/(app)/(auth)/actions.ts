"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { action, str } from "@/lib/action";
import { createSession, destroySession, getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { createWorkspace } from "@/lib/services/workspace";
import { randomToken, sha256 } from "@/lib/crypto";
import { emailLayout, sendEmail } from "@/lib/email";
import { appUrl, APP_NAME } from "@/lib/config";
import { audit } from "@/lib/audit";

const signupSchema = z.object({
  name: z.string().min(2, "Escribe tu nombre."),
  email: z.string().email("Escribe un correo válido con @."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  business: z.string().min(2, "Escribe el nombre de tu negocio o marca."),
  type: z.enum(["FREELANCER", "COMPANY"]),
  plan: z.string().optional(),
});

export const signupAction = action(async (fd) => {
  const data = signupSchema.parse({
    name: str(fd, "name"),
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    business: str(fd, "business"),
    type: str(fd, "type"),
    plan: str(fd, "plan") || undefined,
  });
  const exists = await db.user.findUnique({ where: { email: data.email } });
  if (exists) throw new Error("Ya existe una cuenta con ese correo. Inicia sesión.");
  const user = await db.user.create({ data: { email: data.email, name: data.name, passwordHash: await hashPassword(data.password) } });
  const ws = await createWorkspace({ userId: user.id, name: data.business, type: data.type, planCode: data.plan });
  await createSession(user.id, ws.id);
  await audit({ workspaceId: ws.id, userId: user.id, action: "workspace.created" });
  redirect("/app?bienvenida=1");
});

export const createOwnWorkspaceAction = action(async (fd) => {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = str(fd, "business");
  if (business.length < 2) throw new Error("Escribe el nombre de tu negocio o marca.");
  const type = str(fd, "type") === "COMPANY" ? "COMPANY" : "FREELANCER";
  const ws = await createWorkspace({ userId: session.userId, name: business, type, planCode: str(fd, "plan") || undefined });
  await db.session.update({ where: { id: session.id }, data: { workspaceId: ws.id } });
  redirect("/app?bienvenida=1");
});

export const loginAction = action(async (fd) => {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const next = str(fd, "next");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error("Correo o contraseña incorrectos.");
  if (user.isSuspended) throw new Error("Esta cuenta está suspendida. Contacta con soporte.");
  const membership = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  await createSession(user.id, membership?.workspaceId);
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  if (membership) redirect("/app");
  const portal = await db.portalAccess.findFirst({ where: { userId: user.id, isActive: true } });
  if (portal) redirect("/portal");
  redirect(user.isSuperadmin ? "/admin" : "/registro/cuenta");
});

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export const requestResetAction = action(async (fd) => {
  const email = str(fd, "email").toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = randomToken();
    await db.token.create({ data: { type: "PASSWORD_RESET", tokenHash: sha256(token), email, expiresAt: new Date(Date.now() + 3600_000) } });
    await sendEmail({
      to: email,
      subject: `Restablece tu contraseña de ${APP_NAME}`,
      html: emailLayout({ name: APP_NAME }, "Restablecer contraseña", "Pulsa el botón para elegir una contraseña nueva. El enlace caduca en una hora.", {
        label: "Elegir contraseña nueva",
        url: appUrl(`/recuperar/${token}`),
      }),
    });
  }
  return "Si el correo está registrado, te hemos enviado un enlace para restablecer la contraseña.";
});

export const resetPasswordAction = action(async (fd) => {
  const token = str(fd, "token");
  const password = str(fd, "password");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const t = await db.token.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date()) throw new Error("El enlace no es válido o ha caducado.");
  const user = await db.user.update({ where: { email: t.email }, data: { passwordHash: await hashPassword(password) } });
  await db.token.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  redirect("/app");
});

/** Acepta una invitación de equipo o de portal. Crea la cuenta de usuario si no existe. */
export const acceptInviteAction = action(async (fd) => {
  const raw = str(fd, "token");
  const t = await db.token.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!t || t.usedAt || t.expiresAt < new Date() || (t.type !== "PORTAL_INVITE" && t.type !== "TEAM_INVITE")) {
    throw new Error("La invitación no es válida o ha caducado. Pide una nueva.");
  }
  const session = await getSession();
  let user = await db.user.findUnique({ where: { email: t.email } });
  if (session && session.user.email !== t.email) throw new Error(`Esta invitación es para ${t.email}. Cierra sesión e inténtalo de nuevo.`);
  if (!session) {
    const password = str(fd, "password");
    if (user) {
      if (!(await verifyPassword(password, user.passwordHash))) throw new Error("Contraseña incorrecta para esta cuenta.");
    } else {
      const name = str(fd, "name");
      if (name.length < 2) throw new Error("Escribe tu nombre.");
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      user = await db.user.create({ data: { email: t.email, name, passwordHash: await hashPassword(password) } });
    }
  }
  user = user ?? session!.user;
  if (t.type === "PORTAL_INVITE" && t.clientId && t.workspaceId) {
    await db.portalAccess.upsert({
      where: { clientId_userId: { clientId: t.clientId, userId: user.id } },
      create: { workspaceId: t.workspaceId, clientId: t.clientId, userId: user.id },
      update: { isActive: true },
    });
    await db.token.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    if (!session) await createSession(user.id);
    redirect(`/portal/${t.clientId}`);
  }
  if (t.type === "TEAM_INVITE" && t.workspaceId) {
    const role = (["ADMIN", "MANAGER", "MEMBER"].includes(t.role ?? "") ? t.role : "MEMBER") as "ADMIN" | "MANAGER" | "MEMBER";
    const meta = (t.meta ?? {}) as { departmentId?: string; customRoleId?: string; title?: string };
    await db.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: t.workspaceId } },
      create: { userId: user.id, workspaceId: t.workspaceId, role, departmentId: meta.departmentId || null, customRoleId: meta.customRoleId || null, title: meta.title || null },
      update: {},
    });
    await db.token.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    if (session) await db.session.update({ where: { id: session.id }, data: { workspaceId: t.workspaceId } });
    else await createSession(user.id, t.workspaceId);
    redirect("/app");
  }
  throw new Error("Invitación no válida.");
});
