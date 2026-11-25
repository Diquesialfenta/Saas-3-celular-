import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./crypto";

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./storage");
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Almacenamiento local por cuenta. Sustituible por S3 manteniendo esta interfaz. */
export async function putFile(workspaceId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo supera los 50 MB.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const key = `${workspaceId}/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}-${safe}`;
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return { key, size: file.size };
}

export async function getFile(key: string) {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  if (!full.startsWith(ROOT)) throw new Error("Ruta no válida");
  return readFile(full);
}

export async function deleteFile(key: string) {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  if (!full.startsWith(ROOT)) return;
  await unlink(full).catch(() => {});
}
