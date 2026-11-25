import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { zonedDay, zonedToUtc } from "@/lib/tz";
import { BrandedShell } from "@/components/branded";
import { bookMeetingAction } from "../../actions";
import { BookingPicker } from "./picker";

export const metadata = { title: "Reservar reunión", robots: { index: false } };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cliente?: string }> }) {
  const { slug } = await params;
  const { cliente } = await searchParams;
  const link = await db.bookingLink.findUnique({ where: { slug } });
  if (!link || !link.isActive) notFound();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: link.workspaceId } });
  const client = cliente ? await db.client.findFirst({ where: { id: cliente, workspaceId: ws.id }, include: { contacts: { where: { isPrimary: true } } } }) : null;
  const av = link.availability as { days: number[]; from: string; to: string };
  const now = new Date();
  const horizon = new Date(now.getTime() + 21 * 86400_000);
  const busy = await db.meeting.findMany({ where: { workspaceId: ws.id, status: "SCHEDULED", endsAt: { gte: now }, startsAt: { lte: horizon } }, select: { startsAt: true, endsAt: true } });
  const days: { date: string; label: string; slots: string[] }[] = [];
  for (let i = 0; i < 21 && days.length < 10; i++) {
    const { date, weekday } = zonedDay(new Date(now.getTime() + i * 86400_000), ws.timezone);
    if (!av.days.includes(weekday) || days.some((d) => d.date === date)) continue;
    const slots: string[] = [];
    const [fh, fm] = av.from.split(":").map(Number);
    const [th, tm] = av.to.split(":").map(Number);
    for (let min = fh * 60 + fm; min + link.durationMin <= th * 60 + tm; min += 30) {
      const hhmm = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      const start = zonedToUtc(date, hhmm, ws.timezone);
      const end = new Date(start.getTime() + link.durationMin * 60_000);
      if (start.getTime() < now.getTime() + 2 * 3600_000) continue;
      if (busy.some((b) => b.startsAt < end && b.endsAt > start)) continue;
      slots.push(start.toISOString());
    }
    if (slots.length) {
      days.push({ date, label: new Date(`${date}T12:00:00Z`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }), slots });
    }
  }
  return (
    <BrandedShell brand={ws}>
      <h1 className="text-[32px] leading-tight tracking-[-0.03em]">{link.title}</h1>
      <p className="mt-2 text-muted">
        {link.durationMin} minutos con {ws.name}
        {link.description ? ` · ${link.description}` : ""}
      </p>
      <BookingPicker
        slug={slug}
        days={days}
        timeZone={ws.timezone}
        action={bookMeetingAction}
        clientId={client?.id}
        defaultName={client?.contacts[0]?.name ?? client?.name ?? ""}
        defaultEmail={client?.contacts[0]?.email ?? client?.email ?? ""}
        brandColor={ws.brandColor}
      />
    </BrandedShell>
  );
}
