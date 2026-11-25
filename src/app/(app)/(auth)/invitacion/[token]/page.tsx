import Link from "next/link";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { acceptInviteAction } from "../../actions";
import { AuthShell } from "../../auth-shell";

export const metadata = { title: "Invitación" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await db.token.findUnique({ where: { tokenHash: sha256(token) } });
  const valid = t && !t.usedAt && t.expiresAt > new Date();
  if (!valid) {
    return (
      <AuthShell title="Invitación no válida" description="El enlace ya se usó o ha caducado. Pide a quien te invitó que te envíe uno nuevo.">
        <Link href="/login" className="text-sm font-medium underline underline-offset-4">
          Ir a iniciar sesión
        </Link>
      </AuthShell>
    );
  }
  const ws = t.workspaceId ? await db.workspace.findUnique({ where: { id: t.workspaceId } }) : null;
  const user = await getCurrentUser();
  const existing = await db.user.findUnique({ where: { email: t.email } });
  const isPortal = t.type === "PORTAL_INVITE";
  return (
    <AuthShell
      title={isPortal ? `Tu portal con ${ws?.name}` : `Únete a ${ws?.name}`}
      description={isPortal ? "Sigue tus proyectos, aprueba entregas, firma documentos y paga tus facturas en un solo lugar." : "Te han invitado a formar parte del equipo."}
      aside={
        ws && (
          <div>
            <p className="text-sm text-muted">Invitación para</p>
            <p className="font-display text-2xl mt-1">{t.email}</p>
          </div>
        )
      }
    >
      <ActionForm action={acceptInviteAction} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        {user ? (
          <p className="text-sm">
            Has iniciado sesión como <strong>{user.email}</strong>.
          </p>
        ) : existing ? (
          <Field label={`Contraseña de ${t.email}`} htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
        ) : (
          <>
            <Field label="Tu nombre" htmlFor="name">
              <Input id="name" name="name" autoComplete="name" defaultValue={(t.meta as { name?: string } | null)?.name ?? ""} required />
            </Field>
            <Field label="Correo" htmlFor="email">
              <Input id="email" value={t.email} disabled readOnly />
            </Field>
            <Field label="Elige una contraseña" htmlFor="password" hint="Al menos 8 caracteres.">
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
          </>
        )}
        <SubmitButton size="lg">{isPortal ? "Entrar a mi portal" : "Aceptar la invitación"}</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
