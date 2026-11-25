"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, FolderKanban, FileText, CreditCard, MessageSquare, LifeBuoy, Sparkles, Gift, Menu, X, LogOut } from "lucide-react";
import { Avatar, cx } from "@/components/ui";

export function PortalNav({
  base,
  brand,
  user,
  counts,
  aiEnabled,
  logoutAction,
}: {
  base: string;
  brand: { name: string; logoUrl: string | null; color: string; title: string | null };
  user: { name: string };
  counts: { home: number; pagos: number; mensajes: number };
  aiEnabled: boolean;
  logoutAction: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = [
    { href: base, label: "Inicio", icon: Home, n: counts.home },
    { href: `${base}/proyectos`, label: "Proyectos", icon: FolderKanban },
    { href: `${base}/documentos`, label: "Documentos", icon: FileText },
    { href: `${base}/pagos`, label: "Pagos y contratos", icon: CreditCard, n: counts.pagos },
    { href: `${base}/mensajes`, label: "Mensajes", icon: MessageSquare },
    { href: `${base}/soporte`, label: "Soporte", icon: LifeBuoy },
    { href: `${base}/servicios`, label: "Servicios", icon: Gift },
    ...(aiEnabled ? [{ href: `${base}/asistente`, label: "Asistente", icon: Sparkles }] : []),
  ];
  const isActive = (href: string) => (href === base ? path === base : path.startsWith(href));
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href={base} className="flex items-center gap-2.5 font-display text-[17px] tracking-[-0.02em] shrink-0">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <>
              <span className="grid size-8 place-items-center rounded-[9px] text-white text-sm font-medium" style={{ background: brand.color }}>
                {brand.name[0]}
              </span>
              <span className="hidden sm:inline">{brand.name}</span>
            </>
          )}
        </Link>
        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={isActive(i.href) ? "page" : undefined}
              className={cx("relative inline-flex items-center gap-1.5 rounded-full px-3 h-9 text-[14px] transition-colors whitespace-nowrap", isActive(i.href) ? "bg-surface text-ink font-medium" : "text-ink-2 hover:bg-surface/70")}
            >
              {i.label}
              {!!i.n && <span className="rounded-full px-1.5 text-[11px] leading-[18px] text-white" style={{ background: brand.color }}>{i.n}</span>}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-2 text-sm text-muted">
            <Avatar name={user.name} size={28} />
          </span>
          <form action={logoutAction} className="hidden sm:block">
            <button className="press grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="size-4" />
            </button>
          </form>
          <button onClick={() => setOpen(true)} className="press lg:hidden grid size-10 place-items-center rounded-full hover:bg-surface" aria-label="Abrir menú" aria-expanded={open}>
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      <div className={cx("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <div className={cx("absolute inset-0 bg-black/30 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside className={cx("drawer absolute inset-y-0 right-0 w-[86%] max-w-[320px] bg-white p-4", open ? "translate-x-0" : "translate-x-full")} inert={!open}>
          <div className="flex justify-between items-center mb-4">
            <span className="font-display">{brand.title ?? brand.name}</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="press grid size-10 place-items-center rounded-full hover:bg-surface">
              <X className="size-5" />
            </button>
          </div>
          <ul className="grid gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)} className={cx("flex items-center gap-3 rounded-[10px] px-3 h-12 text-[15px]", isActive(i.href) ? "bg-surface font-medium" : "hover:bg-surface/70")}>
                  <i.icon className="size-[18px] text-muted" /> {i.label}
                  {!!i.n && <span className="ml-auto rounded-full px-1.5 text-[11px] leading-[18px] text-white" style={{ background: brand.color }}>{i.n}</span>}
                </Link>
              </li>
            ))}
            <li>
              <form action={logoutAction}>
                <button className="flex w-full items-center gap-3 rounded-[10px] px-3 h-12 text-[15px] hover:bg-surface/70">
                  <LogOut className="size-[18px] text-muted" /> Cerrar sesión
                </button>
              </form>
            </li>
          </ul>
        </aside>
      </div>
    </header>
  );
}
