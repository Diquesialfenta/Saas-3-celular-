import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { dateTime } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export default async function PrintContract({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace("contracts.manage");
  const c = await db.contract.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { signers: { orderBy: { order: "asc" } }, client: true } });
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-[760px] bg-white p-10 print:p-0">
      <div className="print:hidden mb-6 flex justify-end">
        <PrintButton />
      </div>
      <p className="text-[12px] text-muted font-mono">
        {c.number} · {ctx.workspace.legalName || ctx.workspace.name}
      </p>
      <h1 className="text-[28px] mt-2">{c.title}</h1>
      <div className="prose-doc mt-6 text-[14px]">{c.body}</div>
      <div className="mt-10 grid grid-cols-2 gap-8 break-inside-avoid">
        {c.signers.map((s) => (
          <div key={s.id}>
            <p className="text-[12px] text-muted">{s.party === "PROVIDER" ? "Proveedor" : "Cliente"}</p>
            {s.signatureData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.signatureData} alt={`Firma de ${s.typedName}`} className="h-16 w-auto" />
            ) : (
              <div className="h-16 border-b border-dashed" />
            )}
            <p className="text-sm">{s.typedName ?? s.name}</p>
          </div>
        ))}
      </div>
      <section className="mt-10 border-t pt-4 text-[11px] text-muted break-inside-avoid">
        <p className="font-medium text-ink">Registro de firma electrónica</p>
        <p>Huella SHA-256 del documento: {c.contentHash ?? "pendiente de envío"}</p>
        {c.signers.map((s) => (
          <p key={s.id}>
            {s.party === "PROVIDER" ? "Proveedor" : "Cliente"}: {s.typedName ?? s.name} &lt;{s.email}&gt; · {s.signedAt ? `firmó el ${dateTime(s.signedAt)} desde IP ${s.ip ?? "—"}` : "sin firmar"}
            {s.hashAtSigning && s.hashAtSigning !== c.contentHash ? " · ATENCIÓN: la huella no coincide" : ""}
          </p>
        ))}
      </section>
    </div>
  );
}
