"use server";

import { db } from "@/lib/db";
import { action, optStr, str, required } from "@/lib/action";
import { actionContext } from "@/lib/tenant";
import { slugify } from "@/lib/format";
import { randomToken } from "@/lib/crypto";

export const saveBookingLinkAction = action(async (fd) => {
  const ctx = await actionContext("settings.manage");
  const days = fd.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  if (days.length === 0) throw new Error("Marca al menos un día disponible.");
  const from = str(fd, "from") || "09:00";
  const to = str(fd, "to") || "17:00";
  if (from >= to) throw new Error("La hora de fin debe ser posterior a la de inicio.");
  const data = {
    title: required(fd, "title", "el título"),
    description: optStr(fd, "description"),
    durationMin: Math.max(10, Math.min(240, Number(str(fd, "durationMin")) || 45)),
    availability: { days, from, to },
    videoUrl: optStr(fd, "videoUrl"),
    isActive: str(fd, "isActive") === "on",
  };
  const id = optStr(fd, "id");
  if (id) {
    await db.bookingLink.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data });
  } else {
    await db.bookingLink.create({ data: { ...data, workspaceId: ctx.workspaceId, slug: `${slugify(data.title) || "reunion"}-${randomToken(4).toLowerCase()}` } });
  }
  return "Enlace de agenda guardado";
}, "/app/agenda");
