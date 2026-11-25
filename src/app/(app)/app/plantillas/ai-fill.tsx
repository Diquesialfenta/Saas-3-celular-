"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { Spinner } from "@/components/forms";

/** Genera con IA el contenido de un campo del formulario (por id). */
export function AiFill({ type, target, generate }: { type: string; target: string; generate: (type: string, brief: string) => Promise<{ text?: string; error?: string }> }) {
  const [brief, setBrief] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col sm:flex-row gap-2 rounded-[12px] bg-surface p-3">
      <label htmlFor={`ai-${target}`} className="sr-only">
        Describe qué necesitas
      </label>
      <Input id={`ai-${target}`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Describe tu servicio y la IA escribe una primera versión" />
      <Button
        type="button"
        variant="secondary"
        disabled={!brief.trim() || pending}
        onClick={() =>
          start(async () => {
            const r = await generate(type, brief);
            if (r.error) return void toast.error(r.error);
            const el = document.getElementById(target) as HTMLTextAreaElement | null;
            if (el && r.text) {
              el.value = r.text;
              toast.success("Contenido generado. Revísalo antes de guardar.");
            }
          })
        }
      >
        {pending ? <Spinner /> : <Sparkles className="size-4" />} Escribir con IA
      </Button>
    </div>
  );
}
