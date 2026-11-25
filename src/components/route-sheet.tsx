"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Panel lateral abierto por un parámetro de la URL; al cerrarlo vuelve a closeHref. */
export function RouteSheet({ closeHref, title, children }: { closeHref: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && router.replace(closeHref, { scroll: false });
    document.addEventListener("keydown", k);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", k);
  }, [closeHref, router]);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25 animate-[fade_200ms_ease]" onClick={() => router.replace(closeHref, { scroll: false })} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-white shadow-pop outline-none animate-[sheet_320ms_cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <p className="text-sm font-medium truncate">{title}</p>
          <button onClick={() => router.replace(closeHref, { scroll: false })} aria-label="Cerrar" className="press grid size-9 place-items-center rounded-full hover:bg-surface">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-5">{children}</div>
      </div>
    </div>
  );
}
