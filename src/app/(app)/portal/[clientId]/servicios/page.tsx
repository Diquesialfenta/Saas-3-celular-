import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { money } from "@/lib/format";
import { ActionForm, Modal, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input, StatusBadge, Textarea } from "@/components/ui";
import { referFriendAction, requestChangeAction } from "../../actions";

export const metadata = { title: "Servicios" };

export default async function PortalServices({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const [services, requests, referrals] = await Promise.all([
    db.service.findMany({ where: { workspaceId: ctx.workspaceId, isActive: true, visibleInPortal: true }, orderBy: { name: "asc" } }),
    db.changeRequest.findMany({ where: { workspaceId: ctx.workspaceId, clientId, type: "NEW_SERVICE" }, orderBy: { createdAt: "desc" } }),
    db.referral.findMany({ where: { workspaceId: ctx.workspaceId, referrerClientId: clientId }, orderBy: { createdAt: "desc" } }),
  ]);
  const per = (r: string) => (r === "MONTHLY" ? " / mes" : r === "YEARLY" ? " / año" : "");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[30px] tracking-[-0.03em]">Servicios</h1>
        <p className="text-muted mt-1">Contrata servicios adicionales o recomiéndanos.</p>
      </div>
      {services.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="p-5 flex flex-col">
              <p className="font-medium">{s.name}</p>
              {s.description && <p className="text-sm text-muted mt-1 flex-1">{s.description}</p>}
              <p className="font-display text-xl mt-4 tabular-nums">
                {money(s.price, s.currency)}
                <span className="text-sm text-muted">{per(s.recurring)}</span>
              </p>
              <ActionForm action={requestChangeAction} className="mt-3">
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="serviceId" value={s.id} />
                <SubmitButton variant="secondary" size="sm" className="w-full">
                  Solicitar este servicio
                </SubmitButton>
              </ActionForm>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-5 text-sm text-muted">
          {ctx.workspace.name} todavía no ha publicado su catálogo. Puedes pedir cualquier servicio escribiendo al equipo.
        </Card>
      )}
      {requests.length > 0 && (
        <Card>
          <CardHeader title="Tus solicitudes" />
          <ul className="pb-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                <span>{r.title}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-6 grid gap-4 md:grid-cols-[1fr_auto] items-center">
        <div>
          <p className="text-lg font-display">Recomiéndanos</p>
          <p className="text-sm text-muted mt-1">{ctx.workspace.referralReward ? `Por cada cliente que nos recomiendes: ${ctx.workspace.referralReward}.` : "Si conoces a alguien a quien podamos ayudar, preséntanoslo."}</p>
          {referrals.length > 0 && <p className="text-[13px] text-muted mt-2">Has recomendado a {referrals.length} persona(s). ¡Gracias!</p>}
        </div>
        <Modal trigger="Recomendar a alguien" title="Recomendar a un contacto">
          <ActionForm action={referFriendAction} className="grid gap-4">
            <input type="hidden" name="clientId" value={clientId} />
            <Field label="Nombre" htmlFor="r-name">
              <Input id="r-name" name="name" required />
            </Field>
            <Field label="Correo" htmlFor="r-email">
              <Input id="r-email" name="email" type="email" required />
            </Field>
            <Field label="Empresa" htmlFor="r-company">
              <Input id="r-company" name="company" />
            </Field>
            <Field label="¿Qué podría necesitar?" htmlFor="r-note">
              <Textarea id="r-note" name="note" />
            </Field>
            <SubmitButton>Enviar recomendación</SubmitButton>
          </ActionForm>
        </Modal>
      </Card>
    </div>
  );
}
