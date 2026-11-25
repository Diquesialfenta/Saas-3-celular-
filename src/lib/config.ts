export const APP_NAME = "Encauza";
export const APP_TAGLINE = "Gestión de clientes para empresas de servicios y profesionales independientes";

export function appUrl(path = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
