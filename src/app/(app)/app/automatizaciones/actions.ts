"use server";

import { db } from "@/lib/db";
import { action, str, required } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { ACTIONS, RECIPES, TRIGGERS, type ActionDef } from "@/lib/automations";

export const saveAutomationAction = action(async (fd) => {
  const ctx = await actionContext("automations.manage");
  const trigger = str(fd, "trigger");
  if (!(trigger in TRIGGERS)) throw new Error("Elige un disparador.");
  const actions = JSON.parse(str(fd, "actions") || "[]") as ActionDef[];
  if (!Array.isArray(actions) || actions.length === 0) throw new Error("Añade al menos una acción.");
  for (const a of actions) if (!(a.type in ACTIONS)) throw new Error(`Acción no válida: ${a.type}`);
  const minAmount = Number(str(fd, "minAmount")) || 0;
  const clientTag = str(fd, "clientTag");
  const data = {
    name: required(fd, "name", "el nombre"),
    trigger,
    actions,
    conditions: { ...(minAmount ? { minAmount: Math.round(minAmount * 100) } : {}), ...(clientTag ? { clientTag } : {}) },
  };
  const id = str(fd, "id");
  if (id) await db.automation.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  else await db.automation.create({ data: { ...data, workspaceId: ctx.workspaceId } });
  return { message: "Automatización guardada", data: { href: "/app/automatizaciones" } };
}, "/app/automatizaciones");

export const toggleAutomationAction = action(async (fd) => {
  const ctx = await actionContext("automations.manage");
  const a = await db.automation.findFirst({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  if (!a) throw new Error("No encontrada");
  await db.automation.update({ where: { id: a.id }, data: { isActive: !a.isActive } });
  return a.isActive ? "Automatización pausada" : "Automatización activada";
}, "/app/automatizaciones");

export const deleteAutomationAction = action(async (fd) => {
  const ctx = await actionContext("automations.manage");
  await db.automation.deleteMany({ where: { id: str(fd, "id"), workspaceId: ctx.workspaceId } });
  return "Automatización eliminada";
}, "/app/automatizaciones");

export const installRecipeAction = action(async (fd) => {
  const ctx = await actionContext("automations.manage");
  const r = RECIPES[Number(str(fd, "index"))];
  if (!r) throw new Error("Receta no encontrada");
  await db.automation.create({ data: { workspaceId: ctx.workspaceId, name: r.name, trigger: r.trigger, actions: r.actions } });
  return "Receta activada";
}, "/app/automatizaciones");
