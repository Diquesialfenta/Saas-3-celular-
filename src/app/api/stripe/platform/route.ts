import Stripe from "stripe";
import { db } from "@/lib/db";

/**
 * Webhook de Stripe del propietario del SaaS: suscripciones de las cuentas.
 * Configurar en Stripe: {APP_URL}/api/stripe/platform con checkout.session.completed,
 * customer.subscription.updated/deleted e invoice.paid / invoice.payment_failed.
 */
export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return new Response("Stripe de la plataforma no configurado", { status: 400 });
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Firma no válida", { status: 400 });
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const workspaceId = s.metadata?.workspaceId;
      const planId = s.metadata?.planId;
      if (workspaceId && planId && s.mode === "subscription") {
        await db.subscription.update({
          where: { workspaceId },
          data: {
            planId,
            status: "ACTIVE",
            interval: s.metadata?.interval === "YEAR" ? "YEAR" : "MONTH",
            stripeCustomerId: typeof s.customer === "string" ? s.customer : null,
            stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : null,
            trialEndsAt: null,
          },
        });
        if (s.metadata?.coupon) await db.coupon.updateMany({ where: { code: s.metadata.coupon.toUpperCase() }, data: { redemptions: { increment: 1 } } });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const status = event.type === "customer.subscription.deleted" ? "CANCELED" : sub.status === "active" ? "ACTIVE" : sub.status === "trialing" ? "TRIALING" : sub.status === "past_due" || sub.status === "unpaid" ? "PAST_DUE" : "CANCELED";
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status, cancelAtPeriodEnd: sub.cancel_at_period_end, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined },
      });
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === "string" ? inv.customer : null;
      const sub = customer ? await db.subscription.findFirst({ where: { stripeCustomerId: customer } }) : null;
      if (sub) {
        await db.platformPayment.create({
          data: {
            workspaceId: sub.workspaceId,
            amount: event.type === "invoice.paid" ? inv.amount_paid : inv.amount_due,
            currency: inv.currency.toUpperCase(),
            status: event.type === "invoice.paid" ? "PAID" : "FAILED",
            provider: "STRIPE",
            reference: inv.id,
            description: inv.lines?.data?.[0]?.description ?? "Suscripción",
          },
        });
        if (event.type === "invoice.payment_failed") await db.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
      }
      break;
    }
  }
  return Response.json({ received: true });
}
