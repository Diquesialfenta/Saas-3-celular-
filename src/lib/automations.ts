import { stringList } from "@/lib/string-list";
import "server-only";
import { db } from "./db";

export const TRIGGERS = {
  "client.created": "Se crea un cliente",
  "proposal.accepted": "Se acepta una propuesta",
  "proposal.declined": "Se rechaza una propuesta",
  "contract.signed": "Se firma un contrato (todas las partes)",
  "invoice.paid": "Se confirma el pago de una factura",
  "deliverable.approved": "El cliente aprueba un entregable",
  "deliverable.changes_requested": "El cliente pide cambios en un entregable",
  "project.completed": "Se completa un proyecto",
  "form.submitted": "El cliente envía un formulario",
  "ticket.created": "Se abre un ticket de soporte",
  "change_request.created": "El cliente solicita una ampliación o un servicio",
} as const;

export type Trigger = keyof typeof TRIGGERS;

export const ACTIONS = {
  send_email: { label: "Enviar correo al cliente", fields: ["subject", "body"] },
  notify_team: { label: "Notificar al equipo", fields: ["title"] },
  send_whatsapp: { label: "Enviar WhatsApp al cliente", fields: ["body"] },
  create_contract: { label: "Generar contrato desde la propuesta", fields: ["templateId", "autoSend"] },
  create_invoices: { label: "Generar facturas (anticipo y plazos) de la propuesta", fields: ["autoSend"] },
  start_onboarding: { label: "Iniciar onboarding automático", fields: ["templateId"] },
  create_project: { label: "Crear proyecto desde plantilla", fields: ["templateId"] },
  invite_portal: { label: "Activar el portal del cliente", fields: [] },
  create_task: { label: "Crear tarea en el proyecto", fields: ["title", "dueInDays"] },
  request_form: { label: "Solicitar formulario al cliente", fields: ["formId"] },
  send_survey: { label: "Enviar encuesta de satisfacción", fields: ["surveyId"] },
  request_testimonial: { label: "Pedir testimonio", fields: [] },
  set_client_status: { label: "Cambiar estado del cliente", fields: ["status"] },
  create_deal: { label: "Crear oportunidad (renovación o venta adicional)", fields: ["title", "source"] },
  complete_project: { label: "Marcar el proyecto como completado", fields: [] },
  webhook: { label: "Llamar a un webhook externo", fields: [] },
} as const;

export type ActionType = keyof typeof ACTIONS;
export type ActionDef = { type: ActionType; config: Record<string, string | boolean | number | null | undefined> };

export type EventPayload = {
  clientId?: string;
  proposalId?: string;
  contractId?: string;
  invoiceId?: string;
  projectId?: string;
  deliverableId?: string;
  formRequestId?: string;
  ticketId?: string;
  changeRequestId?: string;
  userId?: string;
};

type Conditions = { minAmount?: number; clientTag?: string };

const MAX_DEPTH = 3;
let depth = 0;

/**
 * Emite un evento de negocio: ejecuta todas las automatizaciones activas de la cuenta
 * suscritas a ese disparador. Cada ejecución queda registrada en AutomationRun.
 * Nunca lanza: un fallo en una automatización no rompe la acción que la originó.
 */
export async function emit(workspaceId: string, trigger: Trigger, payload: EventPayload) {
  if (depth >= MAX_DEPTH) return;
  depth++;
  try {
    const automations = await db.automation.findMany({ where: { workspaceId, trigger, isActive: true }, orderBy: { createdAt: "asc" } });
    for (const a of automations) {
      if (!(await matches(workspaceId, a.conditions as Conditions, payload))) continue;
      const log: { action: string; ok: boolean; detail: string }[] = [];
      for (const action of (a.actions as ActionDef[]) ?? []) {
        try {
          const detail = await runAction(workspaceId, action, payload);
          log.push({ action: action.type, ok: true, detail });
        } catch (e) {
          log.push({ action: action.type, ok: false, detail: e instanceof Error ? e.message : String(e) });
        }
      }
      const failed = log.filter((l) => !l.ok).length;
      await db.automationRun.create({
        data: { automationId: a.id, workspaceId, event: trigger, status: failed === 0 ? "SUCCESS" : failed === log.length ? "FAILED" : "PARTIAL", log },
      });
      await db.automation.update({ where: { id: a.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    }
  } catch (e) {
    console.error("[automations]", trigger, e);
  } finally {
    depth--;
  }
}

async function matches(workspaceId: string, c: Conditions | null, p: EventPayload) {
  if (!c) return true;
  if (c.clientTag && p.clientId) {
    const client = await db.client.findFirst({ where: { id: p.clientId, workspaceId } });
    if (!stringList(client?.tags).includes(c.clientTag)) return false;
  }
  if (c.minAmount && p.invoiceId) {
    const inv = await db.invoice.findFirst({ where: { id: p.invoiceId, workspaceId } });
    if (!inv || inv.total < c.minAmount) return false;
  }
  return true;
}

async function runAction(workspaceId: string, action: ActionDef, p: EventPayload): Promise<string> {
  const cfg = action.config ?? {};
  // Imports diferidos para evitar ciclos (los servicios también emiten eventos).
  switch (action.type) {
    case "send_email": {
      const { sendEmail, emailLayout } = await import("./email");
      const { fillTemplate } = await import("./format");
      const { appUrl } = await import("./config");
      const client = await needClient(workspaceId, p);
      const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const to = client.contacts.find((c) => c.isPrimary)?.email || client.contacts[0]?.email || client.email;
      if (!to) throw new Error("El cliente no tiene correo");
      const vars = { cliente: { nombre: client.name }, empresa: { nombre: ws.name } };
      const access = await db.portalAccess.findFirst({ where: { clientId: client.id, isActive: true } });
      const r = await sendEmail({
        workspaceId,
        to,
        subject: fillTemplate(String(cfg.subject || `Novedades de ${ws.name}`), vars),
        html: emailLayout(ws, fillTemplate(String(cfg.subject || ""), vars), fillTemplate(String(cfg.body || ""), vars), access ? { label: "Abrir mi portal", url: appUrl(`/portal/${client.id}`) } : undefined),
      });
      return r.ok ? `Correo enviado a ${to}` : `Correo registrado (SMTP no configurado) para ${to}`;
    }
    case "notify_team": {
      const { notifyTeam } = await import("./audit");
      await notifyTeam(workspaceId, { title: String(cfg.title || "Automatización ejecutada"), link: p.clientId ? `/app/clientes/${p.clientId}` : undefined });
      return "Equipo notificado";
    }
    case "send_whatsapp": {
      const { sendWhatsApp } = await import("./email");
      const client = await needClient(workspaceId, p);
      const phone = client.contacts.find((c) => c.isPrimary)?.phone || client.phone;
      if (!phone) throw new Error("El cliente no tiene teléfono");
      const r = await sendWhatsApp(workspaceId, phone, String(cfg.body || ""));
      if (!r.ok) throw new Error(r.reason === "NOT_CONFIGURED" ? "WhatsApp Business no está configurado" : r.reason);
      return `WhatsApp enviado a ${phone}`;
    }
    case "create_contract": {
      if (!p.proposalId) throw new Error("El evento no tiene propuesta");
      const exists = await db.contract.findFirst({ where: { workspaceId, proposalId: p.proposalId } });
      if (exists) return `Ya existía el contrato ${exists.number}`;
      const { createContract, sendContract } = await import("./services/contracts");
      const owner = await db.membership.findFirstOrThrow({ where: { workspaceId, role: "OWNER" }, include: { user: true } });
      const proposal = await db.proposal.findFirstOrThrow({ where: { id: p.proposalId, workspaceId } });
      const tplId = (cfg.templateId as string) || (await db.template.findFirst({ where: { workspaceId, type: "CONTRACT" } }))?.id;
      const c = await createContract({ workspaceId, clientId: proposal.clientId, proposalId: proposal.id, templateId: tplId, providerName: owner.user.name, providerEmail: owner.user.email });
      if (cfg.autoSend !== false) await sendContract(workspaceId, c.id);
      return `Contrato ${c.number} generado${cfg.autoSend !== false ? " y enviado" : ""}`;
    }
    case "create_invoices": {
      const proposalId = p.proposalId ?? (p.contractId ? (await db.contract.findFirst({ where: { id: p.contractId, workspaceId } }))?.proposalId : null);
      if (!proposalId) throw new Error("No hay propuesta asociada");
      const { invoicesFromProposal, sendInvoice } = await import("./services/billing");
      const invoices = await invoicesFromProposal(workspaceId, proposalId);
      if (cfg.autoSend !== false && invoices[0]) await sendInvoice(workspaceId, invoices[0].id);
      return invoices.length ? `${invoices.length} factura(s) generada(s)` : "Las facturas ya existían";
    }
    case "start_onboarding": {
      const client = await needClient(workspaceId, p);
      const already = await db.onboardingRun.findFirst({ where: { workspaceId, clientId: client.id, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
      if (already) return "El onboarding ya se inició hoy";
      const { startOnboarding } = await import("./services/onboarding");
      await startOnboarding({ workspaceId, clientId: client.id, templateId: (cfg.templateId as string) || null });
      return "Onboarding completado";
    }
    case "create_project": {
      const client = await needClient(workspaceId, p);
      const { createProject } = await import("./services/projects");
      const proposal = p.proposalId ? await db.proposal.findFirst({ where: { id: p.proposalId, workspaceId } }) : null;
      const project = await createProject({ workspaceId, clientId: client.id, name: proposal?.title ?? `Proyecto de ${client.name}`, templateId: (cfg.templateId as string) || null });
      return `Proyecto "${project.name}" creado`;
    }
    case "invite_portal": {
      const client = await needClient(workspaceId, p);
      const email = client.contacts.find((c) => c.isPrimary)?.email || client.contacts[0]?.email || client.email;
      if (!email) throw new Error("El cliente no tiene correo");
      const has = await db.portalAccess.count({ where: { clientId: client.id, isActive: true } });
      if (has) return "El cliente ya tiene portal";
      const { invitePortal } = await import("./services/portal");
      await invitePortal(workspaceId, client.id, email);
      return `Invitación enviada a ${email}`;
    }
    case "create_task": {
      const projectId = p.projectId ?? (p.clientId ? (await db.project.findFirst({ where: { workspaceId, clientId: p.clientId, status: { in: ["ACTIVE", "PLANNING"] } }, orderBy: { createdAt: "desc" } }))?.id : null);
      if (!projectId) throw new Error("No hay proyecto activo");
      const days = Number(cfg.dueInDays ?? 3);
      const t = await db.task.create({ data: { workspaceId, projectId, title: String(cfg.title || "Tarea automática"), dueDate: new Date(Date.now() + days * 86400_000) } });
      return `Tarea "${t.title}" creada`;
    }
    case "request_form": {
      const client = await needClient(workspaceId, p);
      const form = await db.form.findFirst({ where: { id: String(cfg.formId || ""), workspaceId } });
      if (!form) throw new Error("Formulario no encontrado");
      await db.formRequest.create({ data: { workspaceId, formId: form.id, clientId: client.id, projectId: p.projectId ?? null } });
      return `Formulario "${form.name}" solicitado`;
    }
    case "send_survey": {
      const client = await needClient(workspaceId, p);
      const surveyId = String(cfg.surveyId || "") || (await db.survey.findFirst({ where: { workspaceId, isActive: true } }))?.id;
      if (!surveyId) throw new Error("No hay encuestas activas");
      const { sendSurvey } = await import("./services/loyalty");
      await sendSurvey(workspaceId, surveyId, client.id, p.projectId);
      return "Encuesta enviada";
    }
    case "request_testimonial": {
      const client = await needClient(workspaceId, p);
      const { requestTestimonial } = await import("./services/loyalty");
      await requestTestimonial(workspaceId, client.id);
      return "Testimonio solicitado";
    }
    case "set_client_status": {
      const client = await needClient(workspaceId, p);
      const status = String(cfg.status || "ACTIVE") as "LEAD" | "ACTIVE" | "INACTIVE";
      await db.client.update({ where: { id: client.id }, data: { status } });
      return `Estado del cliente: ${status}`;
    }
    case "create_deal": {
      const client = await needClient(workspaceId, p);
      const d = await db.deal.create({
        data: { workspaceId, clientId: client.id, title: String(cfg.title || `Renovación · ${client.name}`), source: String(cfg.source || "RENEWAL"), stage: "QUALIFIED", probability: 40 },
      });
      return `Oportunidad "${d.title}" creada`;
    }
    case "complete_project": {
      if (!p.projectId) throw new Error("El evento no tiene proyecto");
      await db.project.update({ where: { id: p.projectId, workspaceId }, data: { status: "COMPLETED", completedAt: new Date() } });
      return "Proyecto completado";
    }
    case "webhook": {
      const { getIntegration } = await import("./integrations");
      const cfgw = await getIntegration(workspaceId, "WEBHOOK");
      if (!cfgw) throw new Error("No hay webhook configurado en Integraciones");
      const { createHmac } = await import("node:crypto");
      const body = JSON.stringify({ event: "automation", payload: p, at: new Date().toISOString() });
      const res = await fetch(cfgw.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfgw.secret ? { "X-Encauza-Signature": createHmac("sha256", cfgw.secret).update(body).digest("hex") } : {}),
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`El webhook respondió ${res.status}`);
      return "Webhook llamado";
    }
  }
}

async function needClient(workspaceId: string, p: EventPayload) {
  if (!p.clientId) throw new Error("El evento no tiene cliente");
  const c = await db.client.findFirst({ where: { id: p.clientId, workspaceId }, include: { contacts: true } });
  if (!c) throw new Error("Cliente no encontrado");
  return c;
}

/** Recetas listas para activar en un clic. */
export const RECIPES: { name: string; trigger: Trigger; actions: ActionDef[]; description: string }[] = [
  {
    name: "Propuesta aceptada → contrato y facturas",
    trigger: "proposal.accepted",
    description: "Genera el contrato desde tu plantilla y lo envía a firmar; crea la factura del anticipo y los plazos.",
    actions: [
      { type: "create_contract", config: { autoSend: true } },
      { type: "create_invoices", config: { autoSend: true } },
      { type: "notify_team", config: { title: "Propuesta aceptada: contrato y facturas generados" } },
    ],
  },
  {
    name: "Contrato firmado → onboarding automático",
    trigger: "contract.signed",
    description: "Activa el portal, publica la bienvenida, pide el formulario y los archivos, crea el proyecto y comparte la agenda.",
    actions: [{ type: "start_onboarding", config: {} }],
  },
  {
    name: "Pago confirmado → aviso y agradecimiento",
    trigger: "invoice.paid",
    description: "Avisa al equipo y envía al cliente la confirmación del pago.",
    actions: [
      { type: "notify_team", config: { title: "Pago confirmado" } },
      { type: "send_email", config: { subject: "Hemos recibido tu pago", body: "Hola {{cliente.nombre}},\n\nConfirmamos la recepción de tu pago. ¡Gracias!" } },
    ],
  },
  {
    name: "Entregable aprobado → siguiente paso",
    trigger: "deliverable.approved",
    description: "Notifica al equipo y crea la tarea de seguimiento.",
    actions: [
      { type: "notify_team", config: { title: "El cliente aprobó un entregable" } },
      { type: "create_task", config: { title: "Preparar la siguiente entrega", dueInDays: 3 } },
    ],
  },
  {
    name: "Proyecto completado → fidelización",
    trigger: "project.completed",
    description: "Envía la encuesta, pide un testimonio y abre una oportunidad de renovación.",
    actions: [
      { type: "send_survey", config: {} },
      { type: "request_testimonial", config: {} },
      { type: "create_deal", config: { title: "Renovación o siguiente fase", source: "RENEWAL" } },
    ],
  },
];
