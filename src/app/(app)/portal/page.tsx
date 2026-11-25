import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Avatar, Card } from "@/components/ui";
import { Logo } from "@/components/logo";
import { logoutAction } from "../(auth)/actions";

export const metadata = { title: "Mis portales" };

export default async function PortalIndex() {
  const user = await requireUser();
  const access = await db.portalAccess.findMany({ where: { userId: user.id, isActive: true }, include: { client: { include: { workspace: true } } } });
  if (access.length === 1) redirect(`/portal/${access[0].clientId}`);
  const hasWorkspace = await db.membership.count({ where: { userId: user.id } });
  return (
    <div className="min-h-svh bg-surface">
      <div className="mx-auto max-w-xl px-4 py-12">
        <Logo />
        <h1 className="text-3xl mt-10">Hola, {user.name.split(" ")[0]}</h1>
        <p className="text-muted mt-1">Elige el proveedor cuyo portal quieres abrir.</p>
        <div className="mt-6 grid gap-2">
          {access.length === 0 && <Card className="p-6 text-sm text-muted">No tienes portales activos. Pide a tu proveedor que te invite.</Card>}
          {access.map((a) => (
            <Link key={a.id} href={`/portal/${a.clientId}`} className="lift flex items-center gap-3 rounded-[14px] border border-line bg-white p-4">
              <Avatar name={a.client.workspace.name} size={40} className="rounded-[10px]" />
              <span>
                <span className="block font-medium">{a.client.workspace.name}</span>
                <span className="block text-[13px] text-muted">Como {a.client.name}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between text-sm">
          <Link href={hasWorkspace ? "/app" : "/registro/cuenta"} className="text-muted hover:text-ink">
            {hasWorkspace ? "Ir a mi cuenta de empresa" : "¿Tienes un negocio? Crea tu propia cuenta"}
          </Link>
          <form action={logoutAction}>
            <button className="text-muted hover:text-ink">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}
