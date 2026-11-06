import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/server/auth";
import { db } from "../src/server/db";
import { defaultSettings } from "../src/server/settings";
import { legalPages, legalSlugs } from "../src/lib/legal";

const client = await db().connect();
try {
  await client.query("SELECT pg_advisory_lock(8192026)");
  const migration = await getMigrations(authOptions());
  await migration.runMigrations();
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../migrations/${name}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum FROM schema_migrations WHERE name = $1",
      [name],
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(
          `Applied migration ${name} changed. Add a new migration instead.`,
        );
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1,$2)",
        [name, checksum],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`Applied ${name}`);
  }
  await client.query(
    "INSERT INTO site_settings (singleton, data) VALUES (true,$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(defaultSettings)],
  );
  for (const slug of legalSlugs) {
    const page = legalPages[slug];
    const content = await readFile(
      new URL(`../src/content/${page.file}`, import.meta.url),
      "utf8",
    );
    await client.query(
      "INSERT INTO legal_pages (slug,title,content) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING",
      [slug, page.title, content],
    );
  }
  console.log(
    "Database ready. Existing enquiries, owner and settings are preserved.",
  );
} finally {
  await client.query("SELECT pg_advisory_unlock(8192026)");
  client.release();
  await db().end();
}
