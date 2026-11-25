import { db } from "@/lib/db";
import { requirePortal } from "@/lib/tenant";
import { isAiConfigured } from "@/lib/ai";
import { AssistantChat } from "@/components/assistant";
import { Card } from "@/components/ui";
import { askPortalAssistant } from "../../actions";

export const metadata = { title: "Asistente" };

export default async function PortalAssistant({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const ctx = await requirePortal(clientId);
  const history = await db.assistantMessage.findMany({ where: { workspaceId: ctx.workspaceId, userId: ctx.user.id, scope: "PORTAL", clientId }, orderBy: { createdAt: "asc" }, take: 30 });
  const ask = async (message: string) => {
    "use server";
    return askPortalAssistant(clientId, message);
  };
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-[30px] tracking-[-0.03em]">Asistente</h1>
        <p className="text-muted mt-1">Pregunta por el estado de tus proyectos, entregas, pagos o reuniones. Solo consulta la información de tu cuenta.</p>
      </div>
      <Card className="flex flex-col h-[65vh] min-h-[460px] overflow-hidden">
        <AssistantChat
          configured={isAiConfigured() && !ctx.preview}
          initial={history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content }))}
          ask={ask}
          placeholder="Escribe tu pregunta"
          suggestions={["¿Cómo va mi proyecto?", "¿Tengo algo pendiente?", "¿Cuándo vence mi próxima factura?"]}
        />
      </Card>
    </div>
  );
}
