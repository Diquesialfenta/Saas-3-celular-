import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BrandedShell } from "@/components/branded";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Notice, Textarea } from "@/components/ui";
import { submitSurveyAction } from "../../actions";

export const metadata = { title: "Encuesta", robots: { index: false } };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await db.surveyResponse.findUnique({ where: { token }, include: { survey: true } });
  if (!r) notFound();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: r.workspaceId } });
  return (
    <BrandedShell brand={ws}>
      <h1 className="text-[28px] leading-tight tracking-[-0.03em]">{r.survey.question}</h1>
      {r.completedAt ? (
        <div className="mt-6">
          <Notice tone="ok">Gracias por tu respuesta.</Notice>
        </div>
      ) : (
        <Card className="mt-6 p-6">
          <ActionForm action={submitSurveyAction} className="grid gap-6">
            <input type="hidden" name="token" value={token} />
            <fieldset>
              <legend className="sr-only">Puntuación del 0 al 10</legend>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }, (_, i) => (
                  <label key={i} className="cursor-pointer">
                    <input type="radio" name="score" value={i} required className="peer sr-only" />
                    <span className="press grid h-12 place-items-center rounded-[10px] border border-line-strong text-sm tabular-nums transition-colors peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ink hover:bg-surface">
                      {i}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-muted">
                <span>Nada probable</span>
                <span>Muy probable</span>
              </div>
            </fieldset>
            <Field label={r.survey.followUp ?? "¿Algo que quieras contarnos?"} htmlFor="comment">
              <Textarea id="comment" name="comment" />
            </Field>
            <SubmitButton className="justify-self-start" style={{ background: ws.brandColor, borderColor: ws.brandColor }}>
              Enviar respuesta
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </BrandedShell>
  );
}
