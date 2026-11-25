export const PERMISSIONS = {
  "clients.view": "Ver clientes",
  "clients.manage": "Crear y editar clientes",
  "sales.manage": "Oportunidades y propuestas",
  "contracts.manage": "Contratos y firmas",
  "billing.view": "Ver facturación",
  "billing.manage": "Emitir facturas y registrar cobros",
  "projects.view_all": "Ver todos los proyectos",
  "projects.manage": "Crear y editar proyectos",
  "tasks.manage": "Gestionar tareas",
  "files.manage": "Subir y gestionar archivos",
  "portal.manage": "Gestionar portales de clientes",
  "templates.manage": "Plantillas y formularios",
  "automations.manage": "Automatizaciones",
  "support.manage": "Tickets y posventa",
  "analytics.view": "Ver analítica",
  "team.manage": "Equipo, roles y departamentos",
  "settings.manage": "Configuración de la cuenta",
  "ai.use": "Usar el asistente de IA",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_LABELS = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MANAGER: "Responsable",
  MEMBER: "Colaborador",
} as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<keyof typeof ROLE_LABELS, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS.filter((p) => p !== "team.manage" && p !== "settings.manage"),
  MEMBER: ["clients.view", "tasks.manage", "files.manage", "support.manage", "ai.use"],
};
