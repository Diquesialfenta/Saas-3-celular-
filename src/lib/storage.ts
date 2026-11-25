import "server-only";
import { bindings } from "./bindings";
import { randomToken } from "./crypto";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function putFile(workspaceId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("El archivo supera los 50 MB.");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const key = `${workspaceId}/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}-${safe}`;
  await bindings().BUCKET.put(key, file.stream());
  return { key, size: file.size };
}

export function getFile(key: string) {
  return bindings().BUCKET.get(key);
}

export function deleteFile(key: string) {
  return bindings().BUCKET.delete(key);
}
