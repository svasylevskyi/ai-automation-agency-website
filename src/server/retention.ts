import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { db, transaction } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import { retentionDays, type RetentionPolicy } from "../lib/retention";

const eligible = `status='closed' AND closed_at IS NOT NULL AND GREATEST(closed_at,updated_at)<$1::timestamptz
  AND NOT (notification_status='sending' AND notification_attempted_at > now()-interval '5 minutes')
  AND NOT (confirmation_status='sending' AND confirmation_attempted_at > now()-interval '5 minutes')`;
const cutoffFor = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();
const proofSchema = z.object({
  days: retentionDays,
  version: z.number().int().positive(),
  cutoff: z.iso.datetime(),
  issued: z.number().int(),
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
});
function sign(value: string) {
  return createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update("retention-preview:" + value)
    .digest("base64url");
}
function verify(token: string) {
  try {
    const [body, signature, ...extra] = token.split(".");
    if (extra.length || !body || !signature) throw Error();
    const actual = Buffer.from(signature),
      expected = Buffer.from(sign(body));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw Error();
    const proof = proofSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (proof.issued > Date.now() || Date.now() - proof.issued > 600000)
      throw Error();
    return proof;
  } catch {
    throw new HttpError(
      409,
      "The preview expired or is invalid. Preview the enquiries again.",
    );
  }
}
export async function getRetentionPolicy(): Promise<RetentionPolicy> {
  const { rows } = await db().query(
    "SELECT * FROM retention_policy WHERE singleton",
  );
  const row = rows[0];
  return {
    enabled: row.enabled,
    days: row.days,
    version: row.version,
    lastCleanupAt: row.last_cleanup_at?.toISOString() ?? null,
    lastDeletedCount: row.last_deleted_count,
  };
}
async function candidates(client: PoolClient, cutoff: string) {
  return (
    await client.query(
      `WITH candidates AS (SELECT id,name,email,version,GREATEST(closed_at,updated_at) AS last_activity FROM enquiries WHERE ${eligible})
    SELECT count(*)::int AS count,md5(COALESCE(string_agg(id::text||':'||version::text,',' ORDER BY id),'')) AS fingerprint,
    COALESCE((SELECT json_agg(sample) FROM (SELECT id,name,email,last_activity FROM candidates ORDER BY last_activity,id LIMIT 50) sample),'[]') AS samples FROM candidates`,
      [cutoff],
    )
  ).rows[0];
}
export async function previewRetention(days: number, version: number) {
  return transaction(async (client) => {
    const current = (
      await client.query(
        "SELECT version FROM retention_policy WHERE singleton FOR UPDATE",
      )
    ).rows[0];
    if (current.version !== version)
      throw new HttpError(
        409,
        "Retention settings changed. Reload before previewing.",
      );
    const cutoff = cutoffFor(days),
      result = await candidates(client, cutoff);
    const body = Buffer.from(
      JSON.stringify({
        days,
        version,
        cutoff,
        issued: Date.now(),
        fingerprint: result.fingerprint,
      }),
    ).toString("base64url");
    return {
      count: result.count,
      cutoff,
      samples: result.samples,
      token: body + "." + sign(body),
    };
  });
}
export async function saveRetention(input: {
  days: number;
  version: number;
  enabled: boolean;
  previewToken?: string;
}) {
  return transaction(async (client) => {
    const current = (
      await client.query(
        "SELECT version FROM retention_policy WHERE singleton FOR UPDATE",
      )
    ).rows[0];
    if (current.version !== input.version)
      throw new HttpError(
        409,
        "Retention settings changed. Reload before saving.",
      );
    if (input.enabled) {
      const proof = verify(input.previewToken ?? "");
      if (
        proof.days !== input.days ||
        proof.version !== input.version ||
        proof.fingerprint !==
          (await candidates(client, proof.cutoff)).fingerprint
      )
        throw new HttpError(
          409,
          "The policy or affected enquiries changed. Preview again before enabling cleanup.",
        );
    }
    const result = await client.query(
      "UPDATE retention_policy SET enabled=$1,days=$2,version=version+1,updated_at=now() WHERE singleton RETURNING version",
      [input.enabled, input.days],
    );
    return { version: result.rows[0].version };
  });
}
export async function cleanExpiredEnquiries() {
  return transaction(async (client) => {
    const policy = (
      await client.query(
        "SELECT * FROM retention_policy WHERE singleton FOR UPDATE",
      )
    ).rows[0];
    if (!policy.enabled) return 0;
    const result = await client.query(
      `WITH expired AS (SELECT id FROM enquiries WHERE ${eligible} ORDER BY closed_at,id LIMIT 100 FOR UPDATE SKIP LOCKED)
      DELETE FROM enquiries e USING expired WHERE e.id=expired.id RETURNING e.id`,
      [cutoffFor(policy.days)],
    );
    await client.query(
      "UPDATE retention_policy SET last_cleanup_at=now(),last_deleted_count=$1 WHERE singleton",
      [result.rowCount],
    );
    return result.rowCount ?? 0;
  });
}
