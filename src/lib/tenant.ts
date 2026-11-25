import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { getSession } from "./auth";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "./permissions";

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para esta acción.") {
    super(message);
  }
}

/**
 * Contexto de la cuenta activa. TODA consulta de negocio usa ctx.workspaceId:
 * es la frontera de aislamiento entre cuentas.
 */
export const getWorkspaceContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { workspace: { include: { subscription: { include: { plan: true } } } }, customRole: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const membership = memberships.find((m) => m.workspaceId === session.workspaceId) ?? memberships[0];
  const permissions = new Set<Permission>(
    membership.role === "OWNER" || membership.role === "ADMIN" || !membership.customRole
      ? DEFAULT_ROLE_PERMISSIONS[membership.role]
      : (membership.customRole.permissions as Permission[]),
  );
  const workspace = membership.workspace;
  return {
    user: session.user,
    sessionId: session.id,
    membership,
    workspace,
    workspaceId: workspace.id,
    subscription: workspace.subscription,
    plan: workspace.subscription?.plan ?? null,
    isCompany: workspace.type === "COMPANY",
    workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, type: m.workspace.type })),
    permissions,
    can: (p: Permission) => permissions.has(p),
  };
});

export type WorkspaceContext = NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>;

export async function requireWorkspace(permission?: Permission) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    const session = await getSession();
    if (!session) redirect("/login");
    const portal = await db.portalAccess.findFirst({ where: { userId: session.userId, isActive: true } });
    redirect(portal ? "/portal" : session.user.isSuperadmin ? "/admin" : "/registro/cuenta");
  }
  if (ctx.workspace.isSuspended) redirect("/suspendida");
  if (permission && !ctx.can(permission)) throw new ForbiddenError();
  return ctx;
}

/** Para Server Actions: lanza en vez de redirigir cuando falta permiso. */
export async function actionContext(permission?: Permission) {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new ForbiddenError("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  if (ctx.workspace.isSuspended) throw new ForbiddenError("La cuenta está suspendida.");
  if (permission && !ctx.can(permission)) throw new ForbiddenError();
  return ctx;
}

/** Verifica que un cliente pertenece a la cuenta. */
export async function assertClient(workspaceId: string, clientId: string) {
  const client = await db.client.findFirst({ where: { id: clientId, workspaceId } });
  if (!client) throw new ForbiddenError("Cliente no encontrado en esta cuenta.");
  return client;
}

export async function assertProject(workspaceId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) throw new ForbiddenError("Proyecto no encontrado en esta cuenta.");
  return project;
}

/**
 * Contexto del portal de cliente: el usuario debe tener acceso activo a ese cliente.
 * Un miembro del equipo con permiso de portal puede previsualizarlo en solo lectura.
 */
export async function requirePortal(clientId: string) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/portal/${clientId}`);
  const access = await db.portalAccess.findFirst({
    where: { clientId, userId: session.userId, isActive: true },
    include: { client: { include: { workspace: true } } },
  });
  if (access) {
    return { user: session.user, client: access.client, workspace: access.client.workspace, workspaceId: access.workspaceId, clientId, preview: false };
  }
  const client = await db.client.findUnique({ where: { id: clientId }, include: { workspace: true } });
  if (client) {
    const m = await db.membership.findFirst({ where: { userId: session.userId, workspaceId: client.workspaceId }, include: { customRole: true } });
    const perms = m && (m.role === "OWNER" || m.role === "ADMIN" || !m.customRole ? DEFAULT_ROLE_PERMISSIONS[m.role] : (m.customRole.permissions as Permission[]));
    if (perms && perms.includes("portal.manage")) {
      return { user: session.user, client, workspace: client.workspace, workspaceId: client.workspaceId, clientId, preview: true };
    }
  }
  redirect("/portal");
}

export type PortalContext = Awaited<ReturnType<typeof requirePortal>>;

export async function portalActionContext(clientId: string) {
  const session = await getSession();
  if (!session) throw new ForbiddenError("Tu sesión ha caducado.");
  const access = await db.portalAccess.findFirst({
    where: { clientId, userId: session.userId, isActive: true },
    include: { client: { include: { workspace: true } } },
  });
  if (!access) throw new ForbiddenError("No tienes acceso a este portal.");
  return {
    user: session.user,
    access,
    client: access.client,
    workspace: access.client.workspace,
    workspaceId: access.workspaceId,
    clientId,
  };
}
