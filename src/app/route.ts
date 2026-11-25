import { ensurePlanCatalog } from "@/lib/plan-catalog";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.edge";
import { db } from "@/lib/db";
import { LandingDocument } from "@/landing/document";

// Portada pública: HTML estático, sin hidratación de React, porque los scripts de taste-skill
// (system.js, motion.js, layout.js) modifican el DOM. El documento no usa hooks ni componentes cliente.
export const dynamic = "force-dynamic";

export async function GET() {
  await ensurePlanCatalog();
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
  const html = "<!doctype html>" + renderToStaticMarkup(createElement(LandingDocument, { plans }));
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
