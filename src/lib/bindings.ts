import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function bindings() {
  return getCloudflareContext().env as CloudflareEnv & { DB: D1Database; BUCKET: R2Bucket };
}
