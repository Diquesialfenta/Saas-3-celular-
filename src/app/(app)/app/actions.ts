"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, setSessionWorkspace } from "@/lib/auth";
import { actionContext } from "@/lib/tenant";
import { chat } from "@/lib/ai";
import { teamContext } from "@/lib/assistant-context";

export async function switchWorkspaceAction(fd: FormData) {
  const session = await getSession();
  if (!session) return;
  const id = String(fd.get("workspaceId") ?? "");
  const m = await db.membership.findFirst({ where: { userId: session.userId, workspaceId: id } });
  if (m) await setSessionWorkspace(id);
  revalidatePath("/app", "layout");
}

export async function readNotificationsAction() {
  const session = await getSession();
  if (!session) return;
  await db.notification.updateMany({ where: { userId: session.userId, readAt: null }, data: { readAt: new Date() } });
}

export async function askTeamAssistant(message: string): Promise<{ reply?: string; error?: string }> {
  try {
    const ctx = await actionContext("ai.use");
    const q = message.trim().slice(0, 4000);
    if (!q) return { error: "Escribe una pregunta." };
    const history = await db.assistantMessage.findMany({
      where: { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "TEAM" },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const reply = await chat({
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      scope: "TEAM",
      system: `Eres el asistente interno de ${ctx.workspace.name} dentro de la plataforma de gestión de clientes. Ayudas a ${ctx.user.name} a priorizar, redactar mensajes y entender el estado de clientes, proyectos y cobros. Responde breve y concreto, en español.`,
      context: await teamContext(ctx),
      history: [...history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content })), { role: "user", content: q }],
    });
    await db.assistantMessage.createMany({
      data: [
        { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "TEAM", role: "user", content: q },
        { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "TEAM", role: "assistant", content: reply },
      ],
    });
    return { reply };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo responder." };
  }
}
