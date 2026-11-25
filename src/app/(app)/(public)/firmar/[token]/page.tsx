import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { BrandedShell } from "@/components/branded";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Notice } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";
import { signContractAction } from "../../actions";

export const metadata = { title: "Firmar contrato", robots: { index: false } };

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const signer = await db.contractSigner.findUnique({ where: { token }, include: { contract: { include: { workspace: true, signers: true } } } });
  if (!signer || signer.contract.status === "DRAFT") notFound();
  const c = signer.contract;
  if (!signer.viewedAt) await db.contractSigner.update({ where: { id: signer.id }, data: { viewedAt: new Date() } });

  return (
    <BrandedShell brand={c.workspace}>
      <p className="text-[13px] text-muted font-mono">{c.number}</p>
      <h1 className="mt-2 text-[32px] leading-tight tracking-[-0.03em]">{c.title}</h1>
      <Card className="mt-6 p-6 sm:p-10">
        <div className="prose-doc text-ink-2">{c.body}</div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 border-t border-line pt-6">
          {c.signers.map((s) => (
            <div key={s.id}>
              <p className="text-[13px] text-muted">{s.party === "PROVIDER" ? "Por el proveedor" : "Por el cliente"}</p>
              {s.signatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.signatureData} alt={`Firma de ${s.typedName}`} className="h-16 w-auto mt-1" />
              ) : (
                <div className="h-16 mt-1 border-b border-dashed border-line-strong" />
              )}
              <p className="text-sm mt-1">{s.typedName ?? s.name}</p>
              {s.signedAt && <p className="text-[12px] text-muted">{dateTime(s.signedAt)}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6">
        {c.status === "VOID" ? (
          <Notice tone="danger">Este contrato fue anulado y ya no se puede firmar.</Notice>
        ) : signer.signedAt ? (
          <Notice tone="ok">Firmaste este contrato el {dateTime(signer.signedAt)}.{c.status === "SIGNED" ? " Todas las partes han firmado." : " Falta la firma de la otra parte."}</Notice>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl">Firmar como {signer.name}</h2>
            <p className="text-sm text-muted mt-1">Tu firma queda registrada con la fecha, tu dirección IP y la huella del documento.</p>
            <ActionForm action={signContractAction} className="mt-5 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <Field label="Nombre completo" htmlFor="typedName">
                <Input id="typedName" name="typedName" defaultValue={signer.name} autoComplete="name" required />
              </Field>
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">Firma</span>
                <SignaturePad />
              </div>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" name="agree" required className="mt-0.5 accent-ink" />
                <span>He leído el contrato y acepto firmarlo electrónicamente. Mi firma tiene la misma validez que una firma manuscrita.</span>
              </label>
              <SubmitButton size="lg" className="justify-self-start" style={{ background: c.workspace.brandColor, borderColor: c.workspace.brandColor }}>
                Firmar el contrato
              </SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </BrandedShell>
  );
}
