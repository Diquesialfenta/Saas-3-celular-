import Link from "next/link";
import { Logo } from "@/components/logo";
import { logoutAction } from "../(auth)/actions";

export const metadata = { title: "Cuenta suspendida" };

export default function Suspended() {
  return (
    <div className="min-h-svh grid place-items-center bg-surface px-4">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <h1 className="text-2xl mt-8">Esta cuenta está suspendida</h1>
        <p className="text-muted mt-2">Contacta con el soporte de la plataforma para reactivarla. Tus datos se conservan.</p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/portal" className="underline underline-offset-2">
            Ir a mis portales
          </Link>
          <form action={logoutAction}>
            <button className="underline underline-offset-2">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </div>
  );
}
