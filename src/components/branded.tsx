import { APP_NAME } from "@/lib/config";
import { Avatar } from "./ui";

type Brand = { name: string; logoUrl?: string | null; brandColor?: string | null; email?: string | null; website?: string | null };

/** Marco de las páginas que ve el cliente final, con la identidad del proveedor. */
export function BrandedShell({ brand, children, wide }: { brand: Brand; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-svh bg-surface" style={{ ["--brand" as string]: brand.brandColor || "#232323" }}>
      <header className="border-b border-line bg-white">
        <div className={`mx-auto flex h-16 items-center justify-between px-4 sm:px-6 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <span className="flex items-center gap-2.5 font-display text-lg tracking-[-0.02em]">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto max-w-[160px] object-contain" />
            ) : (
              <>
                <Avatar name={brand.name} size={30} className="rounded-[8px]" />
                {brand.name}
              </>
            )}
          </span>
          {brand.email && (
            <a href={`mailto:${brand.email}`} className="text-[13px] text-muted hover:text-ink">
              {brand.email}
            </a>
          )}
        </div>
      </header>
      <main className={`mx-auto px-4 py-8 sm:px-6 sm:py-12 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
      <footer className="pb-10 text-center text-[12px] text-faint">Gestionado con {APP_NAME}</footer>
    </div>
  );
}

export function brandButtonStyle(color?: string | null): React.CSSProperties {
  return { background: color || "#232323", borderColor: color || "#232323", color: "#fff" };
}
