import Stripe from "stripe";
import { db } from "@/lib/db";
import { getIntegration } from "@/lib/integrations";
import { recordPayment } from "@/lib/services/billing";

/**
 * Webhook de Stripe de cada cuenta (pagos de sus clientes).
 * URL a configurar en Stripe: {APP_URL}/api/stripe/webhook/{workspaceId}
 */
export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const cfg = await getIntegration(workspaceId, "STRIPE");
  if (!cfg?.webhookSecret) return new Response("Stripe no configurado", { status: 400 });
  const stripe = new Stripe(cfg.secretKey);
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, req.headers.get("stripe-signature") ?? "", cfg.webhookSecret);
  } catch {
    return new Response("Firma no válida", { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const invoiceId = s.metadata?.invoiceId;
    if (invoiceId && s.payment_status === "paid" && s.metadata?.workspaceId === workspaceId) {
      const inv = await db.invoice.findFirst({ where: { id: invoiceId, workspaceId } });
      if (inv) {
        await recordPayment({ workspaceId, invoiceId, amount: s.amount_total ?? 0, method: "STRIPE", reference: s.id });
      }
    }
  }
  return Response.json({ received: true });
}
