import type { PoolClient } from "pg";

export async function recordActivity(
  client: PoolClient,
  id: string,
  kind: string,
  details: Record<string, unknown> = {},
) {
  await client.query(
    "INSERT INTO enquiry_activity (enquiry_id,kind,details) VALUES ($1,$2,$3)",
    [id, kind, JSON.stringify(details)],
  );
}
