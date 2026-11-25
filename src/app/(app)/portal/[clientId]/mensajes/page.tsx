import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Textarea } from "@/components/ui";
import { Thread } from "@/components/thread";
import { portalSendMessageAction } from "../../actions";

export const metadata = { title: "Mensajes" };

export default async function PortalMessages({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const messages = await db.message.findMany({ where: { workspaceId: ctx.workspaceId, clientId }, orderBy: { createdAt: "asc" }, take: 300 });
  return (
    <div className="grid gap-6">
      <h1 className="text-[30px] tracking-[-0.03em]">Mensajes con {ctx.workspace.name}</h1>
      <Card className="flex flex-col h-[70vh] min-h-[480px] overflow-hidden">
        <div className="flex-1 overflow-y-auto scroll-thin p-5 flex flex-col-reverse bg-surface/50">
          <div>
            <Thread messages={messages} mine="CLIENT" />
          </div>
        </div>
        <ActionForm action={portalSendMessageAction} reset className="border-t border-line p-3 flex flex-col sm:flex-row gap-2">
          <input type="hidden" name="clientId" value={clientId} />
          <label htmlFor="body" className="sr-only">
            Mensaje
          </label>
          <Textarea id="body" name="body" placeholder="Escribe tu mensaje" className="min-h-12 flex-1" required />
          <SubmitButton className="sm:self-end" style={{ background: ctx.workspace.brandColor, borderColor: ctx.workspace.brandColor }}>
            Enviar
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
