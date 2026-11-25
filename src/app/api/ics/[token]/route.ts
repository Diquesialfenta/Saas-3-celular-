import { db } from "@/lib/db";
import { buildIcs } from "@/lib/ics";

/** Calendario privado de la cuenta (suscripción desde Google, Outlook o Apple Calendar). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = await db.workspace.findUnique({ where: { icsToken: token } });
  if (!ws) return new Response("No encontrado", { status: 404 });
  const since = new Date(Date.now() - 60 * 86400_000);
  const [meetings, milestones] = await Promise.all([
    db.meeting.findMany({ where: { workspaceId: ws.id, startsAt: { gte: since }, status: { not: "CANCELED" } } }),
    db.milestone.findMany({ where: { project: { workspaceId: ws.id }, dueDate: { gte: since } }, include: { project: { select: { name: true } } } }),
  ]);
  const body = buildIcs(ws.name, [
    ...meetings.map((m) => ({ uid: `m-${m.id}@encauza`, title: m.title, start: m.startsAt, end: m.endsAt, description: m.description, url: m.videoUrl })),
    ...milestones.filter((m) => m.dueDate).map((m) => ({ uid: `h-${m.id}@encauza`, title: `Hito: ${m.title} (${m.project.name})`, start: m.dueDate!, end: m.dueDate!, allDay: true })),
  ]);
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
