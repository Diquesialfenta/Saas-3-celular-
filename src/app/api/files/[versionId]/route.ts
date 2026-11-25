import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getFile } from "@/lib/storage";

/** Descarga autorizada: miembro de la cuenta, o cliente con acceso al portal y archivo visible. */
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const version = await db.fileVersion.findUnique({ where: { id: versionId }, include: { file: true } });
  if (!version) return new Response("No encontrado", { status: 404 });
  const f = version.file;
  const member = await db.membership.findFirst({ where: { userId: session.userId, workspaceId: f.workspaceId } });
  let allowed = !!member;
  if (!allowed && f.clientId) {
    const access = await db.portalAccess.findFirst({ where: { userId: session.userId, clientId: f.clientId, isActive: true } });
    allowed = !!access && (f.visibleToClient || f.source === "CLIENT");
  }
  if (!allowed) return new Response("No autorizado", { status: 403 });
  const data = await getFile(version.storageKey);
  if (!data) return new Response("No encontrado", { status: 404 });
  const inline = /^(image\/(?:png|jpeg|gif|webp|avif)|application\/pdf|video\/[\w.+-]+|audio\/[\w.+-]+|text\/plain)$/.test(f.mimeType);
  return new Response(data.body, {
    headers: {
      "Content-Type": inline ? f.mimeType : "application/octet-stream",
      "Content-Length": String(data.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
