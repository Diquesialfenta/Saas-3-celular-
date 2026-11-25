"use server";

import { notFound, redirect } from "next/navigation";
import { action } from "@/lib/action";
import { createSession, hashPassword } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { getInitialOwner, provisionInitialOwner } from "@/lib/owner-setup";

export const setupOwnerAction = action(async (form) => {
  const email = await getInitialOwner();
  if (!email) notFound();
  const password = form.get("password");
  if (typeof password !== "string" || password.length < 12 || new TextEncoder().encode(password).length > 72 || password.trim() !== password) {
    throw new Error("Usa entre 12 y 72 bytes para la contraseña, sin espacios al principio ni al final.");
  }
  const id = randomToken(18);
  if (!(await provisionInitialOwner({ id, email, passwordHash: await hashPassword(password) }))) {
    throw new Error("El administrador ya está configurado o ese correo ya tiene una cuenta en Encauza.");
  }
  await createSession(id);
  redirect("/admin");
});
