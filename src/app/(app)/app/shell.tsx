"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Users, KanbanSquare, FileText, FileSignature, Receipt, FolderKanban, CheckSquare, CalendarDays,
  MessageSquare, LifeBuoy, HeartHandshake, Workflow, LayoutTemplate, UsersRound, BarChart3, Plug, Settings, Menu, X, Bell, Sparkles, ChevronsUpDown, LogOut, Shield, ClipboardList,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, cx } from "@/components/ui";

const ICONS = {
  LayoutDashboard, Users, KanbanSquare, FileText, FileSignature, Receipt, FolderKanban, CheckSquare, CalendarDays, MessageSquare, LifeBuoy,
  HeartHandshake, Workflow, LayoutTemplate, UsersRound, BarChart3, Plug, Settings, ClipboardList,
};
export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { label?: string; items: NavItem[] };

type Props = {
  groups: NavGroup[];
  user: { name: string; email: string; isSuperadmin: boolean };
  workspace: { id: string; name: string; type: string; planName?: string | null; trialDaysLeft?: number | null };
  workspaces: { id: string; name: string; type: string }[];
  notifications: { id: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null }[];
  switchAction: (fd: FormData) => Promise<void>;
  logoutAction: () => Promise<void>;
  readNotificationsAction: () => Promise<void>;
  assistant: React.ReactNode;
  children: React.ReactNode;
};

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onOut, active]);
}

function Sidebar({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5 px-3 pb-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className="px-3 pb-1.5 text-[12px] text-faint">{g.label}</p>}
          <ul className="grid gap-px">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard;
              const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-2.5 rounded-[9px] px-3 h-9 text-[14px] transition-colors",
                      active ? "bg-white text-ink font-medium shadow-card border border-line" : "text-ink-2 hover:bg-white/70 border border-transparent",
                    )}
                  >
                    <Icon className={cx("size-[17px] shrink-0", active ? "text-ink" : "text-muted")} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                    {!!item.badge && <span className="ml-auto rounded-full bg-ink px-1.5 text-[11px] leading-[18px] text-white tabular-nums">{item.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell(p: Props) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  useOutside(menuRef, () => setMenu(false), menu);
  useOutside(bellRef, () => setBell(false), bell);
  useEffect(() => setMobile(false), [pathname]);
  const unread = p.notifications.filter((n) => !n.readAt).length;

  const workspaceBlock = (
    <div ref={menuRef} className="relative px-3">
      <button onClick={() => setMenu((v) => !v)} className="press flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 hover:bg-white/70 text-left" aria-expanded={menu}>
        <Avatar name={p.workspace.name} size={30} className="rounded-[8px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.workspace.name}</span>
          <span className="block truncate text-[12px] text-muted">
            {p.workspace.type === "COMPANY" ? "Empresa" : "Independiente"}
            {p.workspace.planName ? ` · plan ${p.workspace.planName}` : ""}
          </span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" />
      </button>
      {menu && (
        <div className="pop absolute left-3 right-3 top-full z-30 mt-1 rounded-[12px] border border-line bg-white p-1.5 shadow-pop">
          <p className="px-2.5 pt-1.5 pb-1 text-[12px] text-faint">Cuentas</p>
          {p.workspaces.map((w) => (
            <form key={w.id} action={p.switchAction}>
              <input type="hidden" name="workspaceId" value={w.id} />
              <button className={cx("flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm hover:bg-surface", w.id === p.workspace.id && "font-medium")}>
                <Avatar name={w.name} size={20} className="rounded-[5px]" />
                <span className="truncate">{w.name}</span>
                {w.id === p.workspace.id && <span className="ml-auto size-1.5 rounded-full bg-accent-strong" />}
              </button>
            </form>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link href="/app/configuracion" className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm hover:bg-surface">
            <Settings className="size-4 text-muted" /> Configuración
          </Link>
          {p.user.isSuperadmin && (
            <Link href="/admin" className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm hover:bg-surface">
              <Shield className="size-4 text-muted" /> Superadministración
            </Link>
          )}
          <form action={p.logoutAction}>
            <button className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm hover:bg-surface">
              <LogOut className="size-4 text-muted" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-svh bg-surface lg:grid lg:grid-cols-[252px_1fr]">
      {/* Barra lateral de escritorio */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-svh overflow-y-auto scroll-thin border-r border-line">
        <div className="px-6 pt-5 pb-4">
          <Link href="/app">
            <Logo />
          </Link>
        </div>
        {workspaceBlock}
        <div className="h-4" />
        <Sidebar groups={p.groups} pathname={pathname} />
      </aside>

      {/* Cajón móvil */}
      <div className={cx("fixed inset-0 z-40 lg:hidden", mobile ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!mobile}>
        <div className={cx("absolute inset-0 bg-black/30 transition-opacity duration-200", mobile ? "opacity-100" : "opacity-0")} onClick={() => setMobile(false)} />
        <aside className={cx("drawer absolute inset-y-0 left-0 w-[86%] max-w-[300px] overflow-y-auto bg-surface border-r border-line", mobile ? "translate-x-0" : "-translate-x-full")} inert={!mobile}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <Logo />
            <button onClick={() => setMobile(false)} aria-label="Cerrar menú" className="press grid size-10 place-items-center rounded-full hover:bg-white">
              <X className="size-5" />
            </button>
          </div>
          {workspaceBlock}
          <div className="h-4" />
          <Sidebar groups={p.groups} pathname={pathname} onNavigate={() => setMobile(false)} />
        </aside>
      </div>

      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/85 backdrop-blur px-4 sm:px-6">
          <button onClick={() => setMobile(true)} className="press lg:hidden -ml-2 grid size-10 place-items-center rounded-full hover:bg-white" aria-label="Abrir menú" aria-expanded={mobile}>
            <Menu className="size-5" />
          </button>
          <Link href="/app" className="lg:hidden">
            <Logo />
          </Link>
          {p.workspace.trialDaysLeft != null && p.workspace.trialDaysLeft >= 0 && (
            <Link href="/app/configuracion/plan" className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 h-8 text-[13px] text-ink-2 hover:border-line-strong transition-colors">
              <span className="size-1.5 rounded-full bg-accent-strong" />
              Prueba: {p.workspace.trialDaysLeft} {p.workspace.trialDaysLeft === 1 ? "día" : "días"}
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setAssistant(true)} className="press inline-flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-[13px] font-medium text-white hover:bg-ink-2">
              <Sparkles className="size-4 text-accent" />
              <span className="hidden sm:inline">Asistente</span>
            </button>
            <div ref={bellRef} className="relative">
              <button
                onClick={() => {
                  setBell((v) => !v);
                  if (!bell && unread) p.readNotificationsAction();
                }}
                className="press relative grid size-10 place-items-center rounded-full hover:bg-white"
                aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
                aria-expanded={bell}
              >
                <Bell className="size-[18px]" />
                {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />}
              </button>
              {bell && (
                <div className="pop absolute right-0 top-full z-30 mt-1 w-[min(360px,calc(100vw-32px))] rounded-[14px] border border-line bg-white shadow-pop" style={{ ["--origin" as string]: "top right" }}>
                  <p className="px-4 pt-3 pb-2 text-sm font-medium">Notificaciones</p>
                  <div className="max-h-[60vh] overflow-y-auto scroll-thin pb-2">
                    {p.notifications.length === 0 && <p className="px-4 py-6 text-sm text-muted text-center">No tienes notificaciones.</p>}
                    {p.notifications.map((n) => {
                      const inner = (
                        <>
                          <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent-strong")} />
                          <span className="min-w-0">
                            <span className="block text-sm">{n.title}</span>
                            {n.body && <span className="block text-[13px] text-muted truncate">{n.body}</span>}
                            <span className="block text-[12px] text-faint mt-0.5">{new Date(n.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}</span>
                          </span>
                        </>
                      );
                      return n.link ? (
                        <Link key={n.id} href={n.link} onClick={() => setBell(false)} className="flex gap-2.5 px-4 py-2.5 hover:bg-surface">
                          {inner}
                        </Link>
                      ) : (
                        <div key={n.id} className="flex gap-2.5 px-4 py-2.5">
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <span className="hidden sm:block pl-1" title={p.user.email}>
              <Avatar name={p.user.name} size={30} />
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1240px]">{p.children}</div>
        </main>
      </div>

      {/* Panel del asistente */}
      <div className={cx("fixed inset-0 z-50", assistant ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!assistant}>
        <div className={cx("absolute inset-0 bg-black/20 transition-opacity duration-200", assistant ? "opacity-100" : "opacity-0")} onClick={() => setAssistant(false)} />
        <aside
          className={cx("drawer absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-white border-l border-line shadow-pop", assistant ? "translate-x-0" : "translate-x-full")}
          inert={!assistant}
        >
          <div className="flex items-center justify-between border-b border-line px-5 h-14">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4" /> Asistente de {p.workspace.name}
            </span>
            <button onClick={() => setAssistant(false)} aria-label="Cerrar asistente" className="press grid size-9 place-items-center rounded-full hover:bg-surface">
              <X className="size-4" />
            </button>
          </div>
          {p.assistant}
        </aside>
      </div>
    </div>
  );
}
