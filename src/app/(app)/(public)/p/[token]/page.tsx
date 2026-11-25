import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activity, notifyTeam } from "@/lib/audit";
import { date } from "@/lib/format";
import { BrandedShell } from "@/components/branded";
import { StatusBadge } from "@/components/ui";
import { acceptProposalAction, declineProposalAction } from "../../actions";
import { ProposalView } from "./view";

export const metadata = { title: "Propuesta", robots: { index: false } };

export default async function PublicProposal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await db.proposal.findUnique({
    where: { publicToken: token },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true, workspace: true },
  });
  if (!p || p.status === "DRAFT") notFound();
  if (!p.viewedAt) {
    await db.proposal.update({ where: { id: p.id }, data: { viewedAt: new Date(), status: p.status === "SENT" ? "VIEWED" : p.status } });
    await activity({ workspaceId: p.workspaceId, clientId: p.clientId, content: `${p.client.name} abrió la propuesta ${p.number}` });
    await notifyTeam(p.workspaceId, { title: `${p.client.name} abrió la propuesta`, body: p.title, link: `/app/propuestas/${p.id}` });
  }
  const sections = (p.sections as { id: string; title: string; body: string }[]) ?? [];
  const expired = p.validUntil && p.validUntil < new Date() && p.status !== "ACCEPTED";

  return (
    <BrandedShell brand={p.workspace}>
      <article className="stagger">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className="font-mono">{p.number}</span>
          <span>·</span>
          <span>Para {p.client.name}</span>
          {p.validUntil && (
            <>
              <span>·</span>
              <span>Válida hasta el {date(p.validUntil, { dateStyle: "long" })}</span>
            </>
          )}
          {p.status !== "SENT" && p.status !== "VIEWED" && <StatusBadge status={expired ? "EXPIRED" : p.status} />}
        </div>
        <h1 className="mt-3 text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.03em]">{p.title}</h1>
        {p.summary && <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-2xl">{p.summary}</p>}

        {sections.length > 0 && (
        <div className="mt-10 grid gap-8">
          {sections.map((s, i) => (
            <section key={s.id ?? i} className="grid sm:grid-cols-[180px_1fr] gap-2 sm:gap-8 border-t border-line pt-6">
              <h2 className="text-[17px] font-sans font-medium tracking-normal">{s.title}</h2>
              <p className="prose-doc text-ink-2">{s.body}</p>
            </section>
          ))}
        </div>
        )}

        <ProposalView
          token={token}
          brandColor={p.workspace.brandColor}
          currency={p.currency}
          taxRate={p.taxRate}
          discount={p.discount}
          depositPercent={p.depositPercent}
          installments={p.installments}
          status={expired ? "EXPIRED" : p.status}
          acceptedBy={p.acceptedByName}
          acceptedAt={p.acceptedAt?.toISOString() ?? null}
          items={p.items.map((i) => ({ id: i.id, name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, recurring: i.recurring, isOptional: i.isOptional, isSelected: i.isSelected }))}
          accept={acceptProposalAction}
          decline={declineProposalAction}
          defaultEmail={p.client.email ?? ""}
        />
      </article>
    </BrandedShell>
  );
}
