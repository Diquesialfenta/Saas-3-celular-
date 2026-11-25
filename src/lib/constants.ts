/** Constantes compartidas entre servidor y cliente. */

export const STAGES = [
  { id: "NEW", label: "Nueva", probability: 10 },
  { id: "QUALIFIED", label: "Cualificada", probability: 30 },
  { id: "PROPOSAL", label: "Propuesta enviada", probability: 60 },
  { id: "NEGOTIATION", label: "Negociación", probability: 80 },
  { id: "WON", label: "Ganada", probability: 100 },
  { id: "LOST", label: "Perdida", probability: 0 },
] as const;

export const CLIENT_SOURCES = ["Recomendación", "Web", "Redes sociales", "Evento", "Prospección", "Cliente anterior", "Otro"];

export const PAYMENT_METHODS = { TRANSFER: "Transferencia", CASH: "Efectivo", CARD: "Tarjeta (TPV)", STRIPE: "Stripe", OTHER: "Otro" } as const;

export const CURRENCIES = ["USD", "EUR", "PEN", "MXN", "COP", "CLP", "ARS"];
