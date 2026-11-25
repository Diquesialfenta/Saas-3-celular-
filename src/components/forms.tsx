"use client";

import { useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, cx } from "./ui";

type State = { ok?: boolean; message?: string; error?: string; data?: Record<string, unknown>; at?: number } | null;
type ServerAction = (prev: State, fd: FormData) => Promise<State>;

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("spinner size-4", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md" | "lg"; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props} className={buttonClass(variant, size, className)}>
      {pending && <Spinner />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Formulario conectado a una Server Action: muestra el resultado como toast,
 * opcionalmente resetea, cierra su diálogo o navega a la URL devuelta en data.href.
 */
export function ActionForm({
  action,
  children,
  className,
  reset = false,
  onDone,
  confirm,
  ...props
}: Omit<ComponentProps<"form">, "action"> & { action: ServerAction; reset?: boolean; onDone?: (s: State) => void; confirm?: string }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.at) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (reset) ref.current?.reset();
      if (!(state.data && ("url" in state.data || "inviteUrl" in state.data))) ref.current?.closest("dialog")?.close();
      onDone?.(state);
      const href = state.data?.href;
      if (typeof href === "string") router.push(href);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </form>
  );
}

/** Botón que ejecuta una acción con campos ocultos (p. ej. cambiar estado). */
export function ActionButton({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  className,
}: {
  action: ServerAction;
  fields?: Record<string, string | number | boolean | null | undefined>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  confirm?: string;
  className?: string;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className="inline-flex">
      {Object.entries(fields ?? {}).map(([k, v]) => (v === null || v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      <SubmitButton variant={variant} size={size} className={className}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

export function Modal({
  trigger,
  title,
  description,
  children,
  wide,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerClassName,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  triggerSize?: "sm" | "md" | "lg";
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={buttonClass(triggerVariant, triggerSize, triggerClassName)} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className={cx("modal m-auto w-[calc(100%-32px)] rounded-[var(--radius-lg)] bg-white p-0 shadow-pop backdrop:backdrop-blur-[1px]", wide ? "max-w-2xl" : "max-w-lg")}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg">{title}</h2>
            {description && <p className="text-sm text-muted mt-1">{description}</p>}
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Cerrar" className="press -mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="px-6 pt-4 pb-6 max-h-[75vh] overflow-y-auto scroll-thin">{children}</div>
      </dialog>
    </>
  );
}

export function CopyButton({ value, label = "Copiar enlace", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Enlace copiado");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copia el enlace:", value);
        }
      }}
    >
      <span className="relative inline-grid">
        <span className={cx("transition-[opacity,filter] duration-200", copied && "opacity-0 blur-[2px]")}>{label}</span>
        <span className={cx("absolute inset-0 transition-[opacity,filter] duration-200", copied ? "opacity-100" : "opacity-0 blur-[2px]")}>Copiado</span>
      </span>
    </button>
  );
}

/** Envía el formulario padre al cambiar (selects de estado, checkboxes). */
export function AutoSubmitSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={cx(
        "h-8 rounded-full border border-line-strong bg-white pl-3 pr-7 text-[13px] appearance-none bg-no-repeat bg-[length:14px] bg-[right_8px_center] cursor-pointer hover:bg-surface transition-colors",
        className,
      )}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23686868' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    >
      {children}
    </select>
  );
}

/** Formulario que, tras ejecutarse, muestra el enlace devuelto (data.url) para copiarlo. */
export function LinkResultForm({
  action,
  children,
  className,
  note = "Comparte este enlace con tu cliente:",
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  note?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <ActionForm
        action={action}
        className={className}
        onDone={(s) => {
          const u = s?.data?.url ?? s?.data?.inviteUrl;
          if (typeof u === "string") setUrl(u);
        }}
      >
        {children}
      </ActionForm>
      {url && (
        <div className="pop rounded-[10px] border border-line bg-surface p-3">
          <p className="text-[13px] text-muted">{note}</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={url} className="min-w-0 flex-1 rounded-[8px] border border-line bg-white px-2.5 h-8 text-[13px] font-mono" onFocus={(e) => e.currentTarget.select()} aria-label="Enlace" />
            <CopyButton value={url} label="Copiar" />
          </div>
        </div>
      )}
    </div>
  );
}
