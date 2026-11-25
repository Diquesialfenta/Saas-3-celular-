import { ensurePlanCatalog } from "@/lib/plan-catalog";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createOwnWorkspaceAction } from "../../actions";
import { AuthAside, AuthShell } from "../../auth-shell";
import { SignupForm } from "../signup-form";

export const metadata = { title: "Crear tu espacio" };

export default async function CreateWorkspacePage() {
  const user = await requireUser();
  await ensurePlanCatalog();
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } });
  return (
    <AuthShell title={`Hola, ${user.name.split(" ")[0]}`} description="Crea el espacio de tu negocio para gestionar tus propios clientes." aside={<AuthAside />}>
      <SignupForm action={createOwnWorkspaceAction} plans={plans} defaultType="FREELANCER" withUser={false} />
    </AuthShell>
  );
}
