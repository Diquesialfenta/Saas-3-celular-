import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { getInitialOwner } from "@/lib/owner-setup";
import { AuthAside, AuthShell } from "../auth-shell";
import { setupOwnerAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurar administrador" };

export default async function SetupOwnerPage() {
  const email = await getInitialOwner();
  if (!email) notFound();

  return (
    <AuthShell title="Configura tu acceso" description="Crea la contraseña del primer superadministrador de Encauza." aside={<AuthAside />}>
      <ActionForm action={setupOwnerAction} className="grid gap-4">
        <Field label="Correo" htmlFor="email">
          <Input id="email" type="email" value={email} readOnly />
        </Field>
        <Field label="Contraseña" htmlFor="password" hint="Al menos 12 caracteres.">
          <Input id="password" name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" required />
        </Field>
        <SubmitButton size="lg" pendingLabel="Configurando">Crear administrador</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
