import type { Metadata, Viewport } from "next";
import { Funnel_Display, Funnel_Sans, DM_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const display = Funnel_Display({ subsets: ["latin"], variable: "--font-display-face", weight: ["400", "500", "600"] });
const text = Funnel_Sans({ subsets: ["latin"], variable: "--font-text", weight: ["400", "500", "600"] });
const mono = DM_Mono({ subsets: ["latin"], variable: "--font-mono-face", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Propuestas, contratos, cobros, proyectos y portal de cliente en una sola plataforma.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { fontFamily: "var(--font-sans)", borderRadius: 12, border: "1px solid rgb(35 35 35 / .1)", boxShadow: "0 8px 24px -6px rgb(0 0 0 / .12)" },
          }}
        />
      </body>
    </html>
  );
}
