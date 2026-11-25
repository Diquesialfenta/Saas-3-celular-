import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthShell({ title, description, children, aside }: { title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="min-h-svh grid lg:grid-cols-[1fr_520px]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="/" className="self-start">
          <Logo />
        </Link>
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[400px] stagger">
            <h1 className="text-[30px] leading-tight">{title}</h1>
            {description && <p className="text-muted mt-2">{description}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
      <aside className="hidden lg:flex flex-col justify-end bg-surface border-l border-line p-10">{aside}</aside>
    </div>
  );
}

export function AuthAside() {
  const steps = [
    ["Propuesta", "El cliente la abre, elige opciones y la acepta en línea."],
    ["Contrato", "Se genera desde tu plantilla y ambas partes lo firman."],
    ["Cobro", "El anticipo y los plazos se facturan y se cobran solos."],
    ["Onboarding", "Se activa su portal, su proyecto y la reunión inicial."],
  ];
  return (
    <div>
      <p className="font-display text-[26px] leading-[1.15] tracking-[-0.03em] max-w-sm">De la propuesta a la entrega, sin volver a copiar datos entre herramientas.</p>
      <ol className="mt-8 grid gap-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-[12px] bg-white border border-line p-4">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-medium text-accent-ink">{i + 1}</span>
            <span>
              <span className="block text-sm font-medium">{t}</span>
              <span className="block text-sm text-muted">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
