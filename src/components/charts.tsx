import { cx } from "./ui";

/**
 * Gráficos de una sola serie (sin leyenda: el título la nombra). Barras finas con extremo
 * redondeado anclado a la base, rejilla discreta, tooltip al pasar el puntero y tabla accesible.
 */
export function BarChart({ data, format, height = 180, label }: { data: { label: string; value: number }[]; format: (n: number) => string; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="m-0">
      <div className="relative" style={{ height }} role="img" aria-label={label}>
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-line/70" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d) => (
            <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
              <div className="w-full max-w-7 rounded-t-[4px] bg-ink/85 transition-colors group-hover:bg-ink" style={{ height: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }} />
              <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-[8px] border border-line bg-white px-2 py-1 text-[12px] shadow-pop group-hover:block z-10">
                <span className="text-muted">{d.label}</span> <span className="font-medium tabular-nums">{format(d.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] text-[11px] text-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className={cx("flex-1 text-center truncate", data.length > 8 && i % 2 === 1 && "invisible")}>
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBars({ data, format }: { data: { label: string; value: number; hint?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${format(d.value)}`}>
          <span className="truncate text-ink-2">{d.label}</span>
          <span className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
            <span className="block h-full rounded-full bg-ink/85" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-right min-w-16">
            {format(d.value)}
            {d.hint && <span className="text-muted text-[12px]"> {d.hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
