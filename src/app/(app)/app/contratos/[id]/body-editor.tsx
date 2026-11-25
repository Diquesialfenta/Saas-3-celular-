"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@/components/ui";
import { Spinner } from "@/components/forms";

export function ContractBodyEditor({
  initial,
  clientId,
  aiEnabled,
  draftAI,
}: {
  initial: string;
  clientId: string;
  aiEnabled: boolean;
  draftAI: (clientId: string, brief: string) => Promise<{ text?: string; error?: string }>;
}) {
  const [body, setBody] = useState(initial);
  const [brief, setBrief] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      {aiEnabled && (
        <div className="flex flex-col sm:flex-row gap-2 rounded-[12px] bg-surface p-3">
          <label htmlFor="ai-brief" className="sr-only">
            Describe el servicio para la IA
          </label>
          <Input id="ai-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Describe el servicio y la IA redacta un borrador" />
          <Button
            type="button"
            variant="secondary"
            disabled={!brief.trim() || pending}
            onClick={() =>
              start(async () => {
                if (body.trim() && !window.confirm("Se reemplazará el texto actual. ¿Continuar?")) return;
                const r = await draftAI(clientId, brief);
                if (r.error) toast.error(r.error);
                else if (r.text) {
                  setBody(r.text);
                  toast.success("Borrador generado. Revísalo antes de enviarlo.");
                }
              })
            }
          >
            {pending ? <Spinner /> : <Sparkles className="size-4" />} Redactar con IA
          </Button>
        </div>
      )}
      <label htmlFor="body" className="text-[13px] font-medium text-ink-2">
        Texto del contrato
      </label>
      <Textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[480px] font-[inherit] leading-relaxed" required />
    </div>
  );
}
