import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";

function run(cli, args) {
  const result = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node_modules/@opennextjs/cloudflare/dist/cli/index.js", ["build"]);
await cp("worker/sites-entry.mjs", ".open-next/sites-entry.js");
const host = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
await rm("dist", { recursive: true, force: true });
await mkdir("dist/server", { recursive: true });
run("node_modules/wrangler/bin/wrangler.js", ["deploy", ".open-next/sites-entry.js", "--dry-run", "--minify", "--outdir", "dist/server"]);

await rename("dist/server/sites-entry.js", "dist/server/index.js");
for (const file of await readdir("dist/server")) {
  if (file.endsWith(".map") || file === "README.md") await rm(`dist/server/${file}`);
}
await cp(".open-next/assets", "dist/client", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("prisma/d1", "dist/drizzle", { recursive: true });

const config = {
  name: "encauza",
  main: "index.js",
  compatibility_date: "2026-10-06",
  compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
  assets: { binding: "ASSETS", directory: "../client" },
  d1_databases: [{ binding: "DB", database_name: "encauza", database_id: "local-encauza", migrations_dir: "../drizzle" }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: "encauza" }],
};
if (!host.project_id || !host.d1 || !host.r2) throw new Error("El manifiesto de Sites debe declarar el proyecto, D1 y R2.");
await writeFile("dist/server/wrangler.json", JSON.stringify(config, null, 2) + "\n");
