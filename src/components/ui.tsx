import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 border border-ink",
  secondary: "bg-white text-ink border border-line-strong hover:bg-surface",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface",
  danger: "bg-white text-danger border border-line-strong hover:bg-danger-bg",
  accent: "bg-accent text-ink border border-accent-strong/60 hover:bg-accent-strong/70",
};
const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return clsx(
    "press inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

const fieldBase =
  "w-full rounded-[10px] border border-line-strong bg-white px-3 text-[15px] text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-ink focus:ring-4 focus:ring-ink/5 disabled:bg-surface aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={clsx(fieldBase, "h-10", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={clsx(fieldBase, "py-2.5 min-h-24 leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={clsx(fieldBase, "h-10 pr-8 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23686868' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={clsx("flex items-center gap-2.5 text-sm cursor-pointer select-none", className)}>
      <input type="checkbox" {...props} className="size-4 rounded border-line-strong accent-ink" />
      <span>{label}</span>
    </label>
  );
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div {...props} className={clsx("rounded-[var(--radius-md)] border border-line bg-white", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
        {description && <p className="text-[13px] text-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink mb-3 transition-colors">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight sm:text-[30px]">{title}</h1>
          {description && <p className="text-muted mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "accent";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  accent: "bg-accent text-accent-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  // clientes
  LEAD: { label: "Prospecto", tone: "info" },
  ACTIVE: { label: "Activo", tone: "ok" },
  INACTIVE: { label: "Inactivo", tone: "neutral" },
  ARCHIVED: { label: "Archivado", tone: "neutral" },
  // propuestas
  DRAFT: { label: "Borrador", tone: "neutral" },
  SENT: { label: "Enviada", tone: "info" },
  VIEWED: { label: "Vista", tone: "warn" },
  ACCEPTED: { label: "Aceptada", tone: "ok" },
  DECLINED: { label: "Rechazada", tone: "danger" },
  EXPIRED: { label: "Caducada", tone: "neutral" },
  // contratos
  PARTIALLY_SIGNED: { label: "Firma parcial", tone: "warn" },
  SIGNED: { label: "Firmado", tone: "ok" },
  VOID: { label: "Anulado", tone: "neutral" },
  // facturas
  PARTIAL: { label: "Pago parcial", tone: "warn" },
  PAID: { label: "Pagada", tone: "ok" },
  OVERDUE: { label: "Vencida", tone: "danger" },
  // proyectos
  PLANNING: { label: "Planificación", tone: "neutral" },
  ON_HOLD: { label: "En pausa", tone: "warn" },
  COMPLETED: { label: "Completado", tone: "ok" },
  CANCELED: { label: "Cancelado", tone: "neutral" },
  // tareas
  TODO: { label: "Por hacer", tone: "neutral" },
  IN_PROGRESS: { label: "En curso", tone: "info" },
  REVIEW: { label: "En revisión", tone: "warn" },
  DONE: { label: "Hecha", tone: "ok" },
  BLOCKED: { label: "Bloqueada", tone: "danger" },
  // entregables
  IN_REVIEW: { label: "En revisión", tone: "warn" },
  APPROVED: { label: "Aprobado", tone: "ok" },
  CHANGES_REQUESTED: { label: "Cambios pedidos", tone: "danger" },
  // tickets / solicitudes
  OPEN: { label: "Abierto", tone: "info" },
  PENDING: { label: "Pendiente", tone: "warn" },
  RESOLVED: { label: "Resuelto", tone: "ok" },
  CLOSED: { label: "Cerrado", tone: "neutral" },
  QUOTED: { label: "Presupuestada", tone: "info" },
  REJECTED: { label: "Rechazada", tone: "danger" },
  SUBMITTED: { label: "Enviado", tone: "ok" },
  REQUESTED: { label: "Solicitado", tone: "warn" },
  // suscripciones
  TRIALING: { label: "Prueba", tone: "info" },
  PAST_DUE: { label: "Impago", tone: "danger" },
  SCHEDULED: { label: "Programada", tone: "info" },
  // oportunidades
  NEW: { label: "Nueva", tone: "info" },
  CONTACTED: { label: "Contactado", tone: "warn" },
  CONVERTED: { label: "Convertido", tone: "ok" },
  REWARDED: { label: "Recompensado", tone: "accent" },
  LOST: { label: "Perdida", tone: "danger" },
  WON: { label: "Ganada", tone: "ok" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{label ?? s.label}</Badge>;
}

export const PRIORITY: Record<string, { label: string; dot: string }> = {
  LOW: { label: "Baja", dot: "bg-faint" },
  MEDIUM: { label: "Media", dot: "bg-info" },
  HIGH: { label: "Alta", dot: "bg-warn" },
  URGENT: { label: "Urgente", dot: "bg-danger" },
};

export function PriorityDot({ priority }: { priority: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.MEDIUM;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className={clsx("size-1.5 rounded-full", p.dot)} />
      {p.label}
    </span>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-full bg-surface text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "danger" }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="font-display text-[28px] leading-none mt-2 tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className={clsx("text-[13px] mt-2", tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-muted")}>{hint}</p>}
    </Card>
  );
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-full font-medium text-ink", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `oklch(0.93 0.04 ${h < 270 || h > 330 ? h : 200})` }}
    >
      {letters}
    </span>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto scroll-thin", className)}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("text-left text-[12px] font-medium text-muted px-4 py-2.5 border-b border-line whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("px-4 py-3 border-b border-line align-middle", className)}>{children}</td>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode; action?: ReactNode }) {
  const t = { info: "bg-info-bg text-info", warn: "bg-warn-bg text-warn", danger: "bg-danger-bg text-danger", ok: "bg-ok-bg text-ok" }[tone];
  return (
    <div className={clsx("flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-[var(--radius-md)] px-4 py-3 text-sm", t)}>
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="flex gap-1 border-b border-line mb-6 overflow-x-auto scroll-thin -mx-1 px-1">
      {items.map((i) => {
        const active = i.href === current;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={clsx(
              "relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
              active ? "text-ink font-medium" : "text-muted hover:text-ink",
            )}
          >
            {i.label}
            {i.count !== undefined && <span className="ml-1.5 text-[12px] text-faint tabular-nums">{i.count}</span>}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function DescList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3 text-sm">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[120px_1fr] gap-3">
          <dt className="text-muted">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value || <span className="text-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
