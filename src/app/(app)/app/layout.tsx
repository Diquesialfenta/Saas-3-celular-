import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { isAiConfigured } from "@/lib/ai";
import { AssistantChat } from "@/components/assistant";
import { logoutAction } from "../(auth)/actions";
import { AppShell, type NavGroup } from "./shell";
import { askTeamAssistant, readNotificationsAction, switchWorkspaceAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const [notifications, openTickets, unreadMessages, history] = await Promise.all([
    db.notification.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ctx.can("support.manage") ? db.ticket.count({ where: { workspaceId: ctx.workspaceId, status: "OPEN" } }) : 0,
    db.message.count({ where: { workspaceId: ctx.workspaceId, authorType: "CLIENT", readAt: null } }),
    db.assistantMessage.findMany({ where: { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "TEAM" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const c = ctx.can;
  const raw: NavGroup[] = [
    {
      items: [
        { href: "/app", label: "Inicio", icon: "LayoutDashboard" },
        { href: "/app/tareas", label: "Mis tareas", icon: "CheckSquare" },
        { href: "/app/mensajes", label: "Mensajes", icon: "MessageSquare", badge: unreadMessages },
        { href: "/app/agenda", label: "Agenda", icon: "CalendarDays" },
      ],
    },
    {
      label: "Ventas",
      items: [
        ...(c("clients.view") ? [{ href: "/app/clientes", label: "Clientes", icon: "Users" }] : []),
        ...(c("sales.manage") ? [{ href: "/app/oportunidades", label: "Oportunidades", icon: "KanbanSquare" }] : []),
        ...(c("sales.manage") ? [{ href: "/app/propuestas", label: "Propuestas", icon: "FileText" }] : []),
        ...(c("contracts.manage") ? [{ href: "/app/contratos", label: "Contratos", icon: "FileSignature" }] : []),
        ...(c("billing.view") ? [{ href: "/app/facturacion", label: "Facturación", icon: "Receipt" }] : []),
      ],
    },
    {
      label: "Entrega",
      items: [
        { href: "/app/proyectos", label: "Proyectos", icon: "FolderKanban" },
        ...(c("templates.manage") ? [{ href: "/app/formularios", label: "Formularios", icon: "ClipboardList" }] : []),
        ...(c("support.manage") ? [{ href: "/app/soporte", label: "Soporte", icon: "LifeBuoy", badge: openTickets }] : []),
        ...(c("support.manage") ? [{ href: "/app/fidelizacion", label: "Fidelización", icon: "HeartHandshake" }] : []),
      ],
    },
    {
      label: "Sistema",
      items: [
        ...(c("automations.manage") ? [{ href: "/app/automatizaciones", label: "Automatizaciones", icon: "Workflow" }] : []),
        ...(c("templates.manage") ? [{ href: "/app/plantillas", label: "Plantillas", icon: "LayoutTemplate" }] : []),
        ...(ctx.isCompany && c("team.manage") ? [{ href: "/app/equipo", label: "Equipo", icon: "UsersRound" }] : []),
        ...(c("analytics.view") ? [{ href: "/app/analitica", label: "Analítica", icon: "BarChart3" }] : []),
        ...(c("settings.manage") ? [{ href: "/app/integraciones", label: "Integraciones", icon: "Plug" }] : []),
        ...(c("settings.manage") ? [{ href: "/app/configuracion", label: "Configuración", icon: "Settings" }] : []),
      ],
    },
  ];
  const groups = raw.filter((g) => g.items.length > 0);

  const trialDaysLeft =
    ctx.subscription?.status === "TRIALING" && ctx.subscription.trialEndsAt
      ? Math.max(0, Math.ceil((ctx.subscription.trialEndsAt.getTime() - Date.now()) / 86400_000))
      : null;

  return (
    <AppShell
      groups={groups}
      user={{ name: ctx.user.name, email: ctx.user.email, isSuperadmin: ctx.user.isSuperadmin }}
      workspace={{ id: ctx.workspace.id, name: ctx.workspace.name, type: ctx.workspace.type, planName: ctx.plan?.name, trialDaysLeft }}
      workspaces={ctx.workspaces}
      notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }))}
      switchAction={switchWorkspaceAction}
      logoutAction={logoutAction}
      readNotificationsAction={readNotificationsAction}
      assistant={
        <AssistantChat
          configured={isAiConfigured() && c("ai.use")}
          initial={history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content }))}
          ask={askTeamAssistant}
          suggestions={["¿Qué debería priorizar hoy?", "¿Qué facturas están vencidas y cuánto suman?", "Redacta un seguimiento para las propuestas sin respuesta"]}
        />
      }
    >
      {children}
    </AppShell>
  );
}
