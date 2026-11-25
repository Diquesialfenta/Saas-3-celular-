import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "../actions";
import { AuthAside, AuthShell } from "../auth-shell";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/app");
  return (
    <AuthShell title="Inicia sesión" description="Accede a tu cuenta o a tu portal de cliente." aside={<AuthAside />}>
      <ActionForm action={loginAction} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton size="lg" className="mt-2" pendingLabel="Entrando">
          Iniciar sesión
        </SubmitButton>
      </ActionForm>
      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/recuperar" className="text-muted hover:text-ink underline-offset-4 hover:underline">
          He olvidado mi contraseña
        </Link>
        <Link href="/registro" className="font-medium underline-offset-4 hover:underline">
          Crear una cuenta
        </Link>
      </div>
    </AuthShell>
  );
}
