import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BrandedShell } from "@/components/branded";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { submitTestimonialAction } from "../../actions";

export const metadata = { title: "Testimonio", robots: { index: false } };

export default async function TestimonialPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await db.testimonial.findUnique({ where: { token } });
  if (!t) notFound();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: t.workspaceId } });
  return (
    <BrandedShell brand={ws}>
      <h1 className="text-[28px] leading-tight tracking-[-0.03em]">Tu experiencia con {ws.name}</h1>
      <p className="text-muted mt-2">Unas líneas sobre cómo fue trabajar juntos. Solo publicaremos tu testimonio con tu nombre y cargo tal como los escribas.</p>
      {t.status !== "REQUESTED" ? (
        <div className="mt-6">
          <Notice tone="ok">¡Gracias por tu testimonio!</Notice>
        </div>
      ) : (
        <Card className="mt-6 p-6">
          <ActionForm action={submitTestimonialAction} className="grid gap-4">
            <input type="hidden" name="token" value={token} />
            <Field label="Tu testimonio" htmlFor="content">
              <Textarea id="content" name="content" required className="min-h-32" />
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Nombre" htmlFor="authorName">
                <Input id="authorName" name="authorName" defaultValue={t.authorName ?? ""} required />
              </Field>
              <Field label="Cargo y empresa" htmlFor="authorRole">
                <Input id="authorRole" name="authorRole" />
              </Field>
              <Field label="Valoración" htmlFor="rating">
                <Select id="rating" name="rating" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)} ({n})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <SubmitButton className="justify-self-start" style={{ background: ws.brandColor, borderColor: ws.brandColor }}>
              Enviar testimonio
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </BrandedShell>
  );
}
