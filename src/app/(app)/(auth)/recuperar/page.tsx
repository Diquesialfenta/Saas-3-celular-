import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { requestResetAction } from "../actions";
import { AuthAside, AuthShell } from "../auth-shell";

export const metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <AuthShell title="Recupera tu contraseña" description="Te enviaremos un enlace para elegir una nueva." aside={<AuthAside />}>
      <ActionForm action={requestResetAction} className="grid gap-4" reset>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton size="lg">Enviar el enlace</SubmitButton>
      </ActionForm>
      <Link href="/login" className="mt-6 inline-block text-sm text-muted hover:text-ink">
        ← Volver a iniciar sesión
      </Link>
    </AuthShell>
  );
}
