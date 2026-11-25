import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { bindings } from "./bindings";

const clients = new WeakMap<D1Database, PrismaClient>();

function getDb() {
  const { DB } = bindings();
  let client = clients.get(DB);
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaD1(DB) });
    clients.set(DB, client);
  }
  return client;
}

// Resuelve el binding dentro de la petición. Next.js también carga estos módulos al compilar.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property: keyof PrismaClient) {
    const client = getDb();
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
