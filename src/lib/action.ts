import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

export type ActionState = { ok?: boolean; message?: string; error?: string; data?: Record<string, unknown>; at?: number } | null;

/**
 * Envuelve una Server Action: convierte errores en mensajes legibles y deja pasar redirect/notFound.
 * La función recibe el FormData y devuelve un mensaje de éxito opcional.
 */
export function action(fn: (fd: FormData) => Promise<string | void | { message?: string; data?: Record<string, unknown> }>, revalidate: string | string[] = "/", ) {
  return async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
    try {
      const r = await fn(fd);
      for (const p of Array.isArray(revalidate) ? revalidate : [revalidate]) revalidatePath(p, "layout");
      if (typeof r === "string") return { ok: true, message: r, at: Date.now() };
      if (r && typeof r === "object") return { ok: true, message: r.message, data: r.data, at: Date.now() };
      return { ok: true, at: Date.now() };
    } catch (e) {
      unstable_rethrow(e);
      if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos.", at: Date.now() };
      console.error(e);
      return { ok: false, error: e instanceof Error ? e.message : "Algo ha fallado.", at: Date.now() };
    }
  };
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string) {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function optDate(fd: FormData, key: string) {
  const v = str(fd, key);
  return v ? new Date(v.length === 10 ? `${v}T12:00:00` : v) : null;
}

export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function required(fd: FormData, key: string, label: string) {
  const v = str(fd, key);
  if (!v) throw new Error(`Escribe ${label}.`);
  return v;
}
