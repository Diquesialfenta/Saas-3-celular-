import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { signupAction } from "../actions";
import { AuthAside, AuthShell } from "../auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tipo?: string; plan?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { tipo, plan } = await searchParams;
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } });
  return (
    <AuthShell title="Crea tu cuenta" description="Elige si trabajas por tu cuenta o con un equipo. Podrás pasar de independiente a empresa sin perder nada." aside={<AuthAside />}>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay planes publicados. El administrador de la plataforma debe ejecutar la semilla de planes.</p>
      ) : (
        <SignupForm action={signupAction} plans={plans} defaultType={tipo === "empresa" ? "COMPANY" : "FREELANCER"} defaultPlan={plan} />
      )}
      <p className="mt-6 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
