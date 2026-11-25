import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { isAiConfigured } from "@/lib/ai";
import { logoutAction } from "../../(auth)/actions";
import { PortalNav } from "./nav";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const ws = ctx.workspace;
  const [pendingForms, reviewDeliverables, unsignedContracts, dueInvoices, unread] = await Promise.all([
    db.formRequest.count({ where: { workspaceId: ws.id, clientId, status: "PENDING" } }),
    db.deliverable.count({ where: { workspaceId: ws.id, status: "IN_REVIEW", project: { clientId, visibleToClient: true } } }),
    db.contractSigner.count({ where: { party: "CLIENT", signedAt: null, contract: { workspaceId: ws.id, clientId, status: { in: ["SENT", "PARTIALLY_SIGNED"] } } } }),
    db.invoice.count({ where: { workspaceId: ws.id, clientId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } } }),
    db.message.count({ where: { workspaceId: ws.id, clientId, authorType: { in: ["TEAM", "SYSTEM"] }, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } } }),
  ]);
  return (
    <div className="min-h-svh bg-surface" style={{ ["--brand" as string]: ws.brandColor }}>
      {ctx.preview && (
        <div className="bg-ink text-white text-[13px] text-center py-2 px-4">Vista previa del portal de {ctx.client.name}. Estás viendo lo mismo que el cliente; las acciones están desactivadas.</div>
      )}
      <PortalNav
        base={`/portal/${clientId}`}
        brand={{ name: ws.name, logoUrl: ws.logoUrl, color: ws.brandColor, title: ws.portalTitle }}
        user={{ name: ctx.user.name }}
        counts={{ home: pendingForms + reviewDeliverables + unsignedContracts, pagos: dueInvoices + unsignedContracts, mensajes: unread }}
        aiEnabled={isAiConfigured()}
        logoutAction={logoutAction}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <fieldset disabled={ctx.preview} className="contents">
          {children}
        </fieldset>
      </main>
      <footer className="pb-10 text-center text-[12px] text-faint">
        {ws.name}
        {ws.email ? ` · ${ws.email}` : ""}
      </footer>
    </div>
  );
}
