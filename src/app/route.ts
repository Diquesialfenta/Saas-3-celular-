import { createRequire } from "node:module";
import { createElement, type ReactElement } from "react";
import { db } from "@/lib/db";
import { LandingDocument } from "@/landing/document";

// Portada pública: HTML estático, sin hidratación de React, porque los scripts de taste-skill
// (system.js, motion.js, layout.js) modifican el DOM. El documento no usa hooks ni componentes cliente.
const nodeRequire = createRequire(import.meta.url);
const render = (el: ReactElement): string => (nodeRequire("react-dom/server") as { renderToStaticMarkup: (e: ReactElement) => string }).renderToStaticMarkup(el);

export async function GET() {
  const plans = await db.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }).catch(() => []);
  const html = "<!doctype html>" + render(createElement(LandingDocument, { plans }));
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
