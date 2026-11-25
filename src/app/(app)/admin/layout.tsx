import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperadmin();
  return (
    <div className="min-h-svh bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo />
            <Badge tone="accent">Superadmin</Badge>
          </Link>
          <span className="ml-auto text-[13px] text-muted hidden sm:block">{user.email}</span>
          <Link href="/app" className="text-[13px] text-muted hover:text-ink">
            Ir a la app
          </Link>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
