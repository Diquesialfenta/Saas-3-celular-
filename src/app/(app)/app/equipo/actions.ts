"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/config";
import { emailLayout, sendEmail } from "@/lib/email";
import { assertLimit } from "@/lib/services/workspace";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

async function companyCtx() {
  const ctx = await actionContext("team.manage");
  if (!ctx.isCompany) throw new Error("La gestión de equipos está disponible en las cuentas de empresa.");
  return ctx;
}

export const inviteMemberAction = action(async (fd) => {
  const ctx = await companyCtx();
  await assertLimit(ctx.workspaceId, "members", "miembros");
  const email = required(fd, "email", "el correo").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Escribe un correo válido.");
  const existing = await db.membership.findFirst({ where: { workspaceId: ctx.workspaceId, user: { email } } });
  if (existing) throw new Error("Esa persona ya forma parte del equipo.");
  const role = ["ADMIN", "MANAGER", "MEMBER"].includes(str(fd, "role")) ? str(fd, "role") : "MEMBER";
  if (role === "ADMIN" && ctx.membership.role !== "OWNER") throw new Error("Solo el propietario puede invitar administradores.");
  const token = randomToken();
  await db.token.create({
    data: {
      type: "TEAM_INVITE",
      tokenHash: sha256(token),
      email,
      workspaceId: ctx.workspaceId,
      role,
      meta: { departmentId: optStr(fd, "departmentId"), customRoleId: optStr(fd, "customRoleId"), title: optStr(fd, "title") },
      expiresAt: new Date(Date.now() + 7 * 86400_000),
    },
  });
  const url = appUrl(`/invitacion/${token}`);
  const r = await sendEmail({
    workspaceId: ctx.workspaceId,
    to: email,
    subject: `${ctx.user.name} te invita al equipo de ${ctx.workspace.name}`,
    html: emailLayout(ctx.workspace, `Únete a ${ctx.workspace.name}`, `${ctx.user.name} te ha invitado a trabajar en ${ctx.workspace.name}. El enlace caduca en 7 días.`, { label: "Aceptar la invitación", url }),
  });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "team.invited", meta: { email, role } });
  return { message: r.ok ? `Invitación enviada a ${email}` : "Invitación creada. Copia el enlace y envíaselo.", data: { url } };
}, "/app/equipo");

export const updateMemberAction = action(async (fd) => {
  const ctx = await companyCtx();
  const m = await db.membership.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!m) throw new Error("Miembro no encontrado");
  if (m.role === "OWNER" && ctx.membership.role !== "OWNER") throw new Error("No puedes modificar al propietario.");
  const role = str(fd, "role");
  const departmentId = optStr(fd, "departmentId");
  const customRoleId = optStr(fd, "customRoleId");
  if (departmentId && !(await db.department.findFirst({ where: { id: departmentId, workspaceId: ctx.workspaceId } }))) throw new Error("Departamento no válido");
  if (customRoleId && !(await db.role.findFirst({ where: { id: customRoleId, workspaceId: ctx.workspaceId } }))) throw new Error("Rol no válido");
  await db.membership.update({
    where: { id: m.id },
    data: {
      role: m.role === "OWNER" ? "OWNER" : ["ADMIN", "MANAGER", "MEMBER"].includes(role) ? (role as "ADMIN" | "MANAGER" | "MEMBER") : m.role,
      departmentId,
      customRoleId,
      title: optStr(fd, "title"),
      capacityHours: Math.max(1, Math.min(80, Number(str(fd, "capacityHours")) || m.capacityHours)),
    },
  });
  return "Miembro actualizado";
}, "/app/equipo");

export const removeMemberAction = action(async (fd) => {
  const ctx = await companyCtx();
  const m = await db.membership.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!m) throw new Error("Miembro no encontrado");
  if (m.role === "OWNER") throw new Error("No se puede quitar al propietario.");
  if (m.userId === ctx.user.id) throw new Error("No puedes quitarte a ti mismo.");
  await db.task.updateMany({ where: { workspaceId: ctx.workspaceId, assigneeId: m.userId, status: { not: "DONE" } }, data: { assigneeId: null } });
  await db.membership.delete({ where: { id: m.id } });
  await audit({ workspaceId: ctx.workspaceId, userId: ctx.user.id, action: "team.removed", meta: { userId: m.userId } });
  return "Miembro eliminado. Sus tareas abiertas quedaron sin asignar.";
}, "/app/equipo");

export const saveRoleAction = action(async (fd) => {
  const ctx = await companyCtx();
  const permissions = fd.getAll("permissions").map(String).filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
  const data = { name: required(fd, "name", "el nombre del rol"), description: optStr(fd, "description"), permissions };
  const id = optStr(fd, "id");
  if (id) await db.role.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  else await db.role.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return "Rol guardado";
}, "/app/equipo");

export const deleteRoleAction = action(async (fd) => {
  const ctx = await companyCtx();
  await db.role.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Rol eliminado";
}, "/app/equipo");

export const saveDepartmentAction = action(async (fd) => {
  const ctx = await companyCtx();
  const leadUserId = optStr(fd, "leadUserId");
  const data = { name: required(fd, "name", "el nombre"), description: optStr(fd, "description"), leadUserId };
  const id = optStr(fd, "id");
  if (id) await db.department.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  else await db.department.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return "Departamento guardado";
}, "/app/equipo");

export const deleteDepartmentAction = action(async (fd) => {
  const ctx = await companyCtx();
  await db.department.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Departamento eliminado";
}, "/app/equipo");
