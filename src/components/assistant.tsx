"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { Spinner } from "./forms";
import { cx } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

export function AssistantChat({
  initial,
  ask,
  configured,
  suggestions,
  placeholder = "Pregunta sobre tus clientes, proyectos o cobros",
}: {
  initial: Msg[];
  ask: (message: string) => Promise<{ reply?: string; error?: string }>;
  configured: boolean;
  suggestions: string[];
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length, pending]);

  const send = (value: string) => {
    const q = value.trim();
    if (!q || pending) return;
    setError(null);
    setText("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    start(async () => {
      const r = await ask(q);
      if (r.error) setError(r.error);
      else if (r.reply) setMessages((m) => [...m, { role: "assistant", content: r.reply! }]);
    });
  };

  if (!configured) {
    return (
      <div className="flex-1 p-6 text-sm text-muted">
        <p className="font-medium text-ink">El asistente aún no está activo</p>
        <p className="mt-1">El administrador de la plataforma debe configurar la clave de IA (ANTHROPIC_API_KEY). Ningún dato se envía mientras no esté configurado.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 grid content-start gap-3">
        {messages.length === 0 && (
          <div className="py-6">
            <div className="grid size-10 place-items-center rounded-full bg-accent">
              <Sparkles className="size-5 text-accent-ink" />
            </div>
            <p className="mt-3 font-medium">¿En qué te ayudo?</p>
            <p className="text-sm text-muted mt-1">Solo uso la información a la que tienes acceso.</p>
            <div className="mt-4 grid gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="press text-left rounded-[10px] border border-line px-3 py-2.5 text-sm hover:bg-surface">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("max-w-[90%] rounded-[14px] px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed", m.role === "user" ? "ml-auto bg-ink text-white" : "bg-surface")}>
            {m.content}
          </div>
        ))}
        {pending && (
          <div className="inline-flex items-center gap-2 text-sm text-muted">
            <Spinner /> Pensando
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div ref={end} />
      </div>
      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="flex items-end gap-2 rounded-[14px] border border-line-strong bg-white p-1.5 focus-within:border-ink transition-colors">
          <label htmlFor="assistant-input" className="sr-only">
            Mensaje para el asistente
          </label>
          <textarea
            id="assistant-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
          />
          <button type="submit" disabled={!text.trim() || pending} aria-label="Enviar" className="press grid size-9 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
