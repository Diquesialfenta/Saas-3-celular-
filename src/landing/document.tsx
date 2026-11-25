import type { Plan } from "@prisma/client";
import { APP_NAME } from "@/lib/config";
import { LandingBody } from "./body";

const TITLE = `${APP_NAME}: gestión de clientes para agencias y freelancers`;
const DESCRIPTION = "Propuestas que se aceptan en línea, contratos con firma electrónica, cobros con anticipo y un portal privado para cada cliente, en una sola herramienta.";

/*
 * Web pública construida con taste-skill (assets en /public/assets, sin modificar). Se sirve como HTML
 * estático (sin hidratación de React) porque system.js, motion.js y layout.js modifican el DOM.
 * type: software · deal: hero collage, nav nav-cards, close close-type, footer footer-dark,
 * rhythm space (+ la sección del momento en ground-inverse), buttons pill, mark dots, ground sage,
 * palette white-mint-tiles, type funnel · moment: line-carries-colour en #equipos.
 */
export function LandingDocument({ plans }: { plans: Plan[] }) {
  return (
    <html lang="es" data-type="software" data-radius="soft" data-ground="sage" data-buttons="pill" data-motion="">
          <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content="De la propuesta al cobro y al portal del cliente, sin cambiar de herramienta." />
        <meta property="og:image" content="/share.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="site-kind" content="software" />
        <meta name="page-type" content="software" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400..700&family=Funnel+Sans:wght@400..600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="/assets/system.css" />
            <link rel="stylesheet" href="/assets/ui/cards.css" />
            <link rel="stylesheet" href="/assets/motion/motion.css" />
            <link rel="stylesheet" href="/assets/backgrounds/backgrounds.css" />
            <link rel="stylesheet" href="/assets/layout/layout.css" />
            <link rel="stylesheet" href="/assets/icons/icon.css" />
            <link rel="stylesheet" href="/assets/moments/line-carries-colour/moment.css" />
            <style>{`:root {
      --p-bg: #ffffff; --p-surface: #f3f3f3; --p-ink: #232323; --p-muted: #686868;
      --p-accent: #a1ffcb; --p-accent-ink: #232323; --p-action: #232323; --p-action-ink: #ffffff;
      --p-inv-bg: #232323; --p-inv-surface: #303030; --p-inv-ink: #ffffff; --p-inv-muted: #a4a4a4;
      --p-inv-accent: #a1ffcb; --p-inv-accent-ink: #232323; --p-inv-action: #a1ffcb; --p-inv-action-ink: #232323;
      --font-display: "Funnel Display", system-ui, sans-serif;
      --font-text: "Funnel Sans", system-ui, sans-serif;
      --font-mono: "DM Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      --display-weight: 400;
      --display-tracking: -0.03em;
      --display-tracking-xl: -0.04em;
      --ly-scale: 0.98;
    }`}</style>
            <link rel="stylesheet" href="/landing.css" />
            <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)" }} />
            <script src="/assets/backgrounds/backgrounds.js" />
            <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)" }} />
            <link rel="modulepreload" href="/assets/moments/moments.js" />
            <link rel="modulepreload" href="/assets/moments/lib.js" />
            <link rel="modulepreload" href="/assets/moments/line-carries-colour/moment.js" />
          </head>
          <body>
            <LandingBody plans={plans} />
            <script type="module" src="/assets/system.js" />
            <script type="module" src="/assets/motion/motion.js" />
            <script type="module" src="/assets/layout/layout.js" />
          </body>
        </html>
  );
}
