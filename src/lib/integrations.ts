import "server-only";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";

export type ProviderConfig = {
  STRIPE: { secretKey: string; webhookSecret?: string };
  SMTP: { url: string; from: string };
  WHATSAPP: { token: string; phoneNumberId: string };
  WEBHOOK: { url: string; secret?: string };
  VIDEO: { defaultUrl: string };
};

export type Provider = keyof ProviderConfig;

export async function getIntegration<P extends Provider>(workspaceId: string, provider: P): Promise<ProviderConfig[P] | null> {
  const row = await db.integration.findUnique({ where: { workspaceId_provider: { workspaceId, provider } } });
  if (!row || !row.isEnabled) return null;
  try {
    return JSON.parse(decrypt(row.config)) as ProviderConfig[P];
  } catch {
    return null;
  }
}

export async function saveIntegration<P extends Provider>(workspaceId: string, provider: P, config: ProviderConfig[P]) {
  const payload = encrypt(JSON.stringify(config));
  await db.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: { workspaceId, provider, config: payload },
    update: { config: payload, isEnabled: true },
  });
}

export async function removeIntegration(workspaceId: string, provider: Provider) {
  await db.integration.deleteMany({ where: { workspaceId, provider } });
}

export function mask(value?: string) {
  if (!value) return "";
  return value.length <= 8 ? "••••" : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
