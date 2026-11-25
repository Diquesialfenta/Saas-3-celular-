"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/cuentas", label: "Cuentas" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/planes", label: "Planes y precios" },
  { href: "/admin/promociones", label: "Promociones" },
  { href: "/admin/soporte", label: "Soporte" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 scroll-thin">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cx("relative whitespace-nowrap px-3 py-2.5 text-sm transition-colors", active ? "font-medium text-ink" : "text-muted hover:text-ink")}>
            {i.label}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
          </Link>
        );
      })}
    </nav>
  );
}
