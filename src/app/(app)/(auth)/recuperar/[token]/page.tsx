import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { resetPasswordAction } from "../../actions";
import { AuthAside, AuthShell } from "../../auth-shell";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell title="Elige una contraseña nueva" aside={<AuthAside />}>
      <ActionForm action={resetPasswordAction} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Contraseña nueva" htmlFor="password" hint="Al menos 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <SubmitButton size="lg">Guardar la contraseña</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
