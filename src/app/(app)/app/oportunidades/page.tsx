import { db } from "@/lib/db";
import { requireWorkspace } from "@/lib/tenant";
import { money } from "@/lib/format";
import { STAGES } from "@/lib/constants";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Field, Input, PageHeader, Select, Stat } from "@/components/ui";
import { createDealAction, moveDealAction } from "../clientes/actions";
import { DealBoard } from "./board";

export const metadata = { title: "Oportunidades" };

export default async function DealsPage() {
  const ctx = await requireWorkspace("sales.manage");
  const [deals, clients] = await Promise.all([
    db.deal.findMany({ where: { workspaceId: ctx.workspaceId }, include: { client: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    db.client.findMany({ where: { workspaceId: ctx.workspaceId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const open = deals.filter((d) => d.status === "OPEN");
  const weighted = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const won = deals.filter((d) => d.status === "WON");
  const closed = deals.filter((d) => d.status !== "OPEN").length;
  const cur = ctx.workspace.currency;

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Arrastra cada oportunidad entre etapas. Las renovaciones y ventas adicionales también llegan aquí desde las automatizaciones."
        actions={
          <Modal trigger="Añadir oportunidad" title="Nueva oportunidad">
            {clients.length === 0 ? (
              <p className="text-sm text-muted">Primero añade un cliente.</p>
            ) : (
              <ActionForm action={createDealAction} className="grid gap-4">
                <Field label="Cliente" htmlFor="clientId">
                  <Select id="clientId" name="clientId" required>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Título" htmlFor="title">
                  <Input id="title" name="title" required />
                </Field>
                <Field label={`Valor estimado (${cur})`} htmlFor="value">
                  <Input id="value" name="value" inputMode="decimal" />
                </Field>
                <Field label="Origen" htmlFor="source">
                  <Select id="source" name="source">
                    <option value="INBOUND">Entrante</option>
                    <option value="OUTBOUND">Prospección</option>
                    <option value="REFERRAL">Recomendación</option>
                    <option value="UPSELL">Venta adicional</option>
                    <option value="RENEWAL">Renovación</option>
                  </Select>
                </Field>
                <Field label="Cierre previsto" htmlFor="expectedCloseDate">
                  <Input id="expectedCloseDate" name="expectedCloseDate" type="date" />
                </Field>
                <SubmitButton>Crear oportunidad</SubmitButton>
              </ActionForm>
            )}
          </Modal>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="En curso" value={money(open.reduce((s, d) => s + d.value, 0), cur)} hint={`${open.length} oportunidades`} />
        <Stat label="Previsión ponderada" value={money(Math.round(weighted), cur)} hint="Valor × probabilidad" />
        <Stat label="Ganado" value={money(won.reduce((s, d) => s + d.value, 0), cur)} />
        <Stat label="Tasa de cierre" value={closed ? `${Math.round((won.length / closed) * 100)} %` : "—"} />
      </div>
      <DealBoard
        currency={cur}
        stages={STAGES}
        move={moveDealAction}
        deals={deals.map((d) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          currency: d.currency,
          stage: d.stage,
          clientId: d.clientId,
          clientName: d.client.name,
          probability: d.probability,
          expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
