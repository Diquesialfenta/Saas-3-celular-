import { db } from "@/lib/db";
import { buildIcs } from "@/lib/ics";

/** Archivo .ics de una reunión concreta (enlace del correo de confirmación). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.meeting.findUnique({ where: { id } });
  if (!m) return new Response("No encontrado", { status: 404 });
  const body = buildIcs(m.title, [{ uid: `m-${m.id}@encauza`, title: m.title, start: m.startsAt, end: m.endsAt, description: m.description, url: m.videoUrl }]);
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="reunion.ics"' } });
}
