"use client";

import { useEffect, useRef, useState } from "react";

/** Lienzo de firma con puntero (ratón, dedo o lápiz). Escribe un PNG en un input oculto. */
export function SignaturePad({ name = "signature" }: { name?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState("");
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#1b1b1b";
      setData("");
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="grid gap-2">
      <div className="relative rounded-[12px] border border-line-strong bg-white">
        <canvas
          ref={canvas}
          className="block h-40 w-full touch-none cursor-crosshair rounded-[12px]"
          aria-label="Recuadro para dibujar tu firma"
          role="img"
          onPointerDown={(e) => {
            if (pointerId.current !== null) return; // ignora un segundo dedo
            pointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || e.pointerId !== pointerId.current) return;
            const ctx = canvas.current!.getContext("2d")!;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(last.current!.x, last.current!.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={(e) => {
            if (e.pointerId !== pointerId.current) return;
            drawing.current = false;
            pointerId.current = null;
            setData(canvas.current!.toDataURL("image/png"));
          }}
          onPointerCancel={() => {
            drawing.current = false;
            pointerId.current = null;
          }}
        />
        {!data && <span className="pointer-events-none absolute inset-x-0 bottom-6 mx-6 border-t border-dashed border-line-strong text-center text-[12px] text-faint pt-1">Firma aquí</span>}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="text-[13px] text-muted hover:text-ink underline-offset-2 hover:underline"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setData("");
          }}
        >
          Borrar firma
        </button>
      </div>
      <input type="hidden" name={name} value={data} />
    </div>
  );
}
