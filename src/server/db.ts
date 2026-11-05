import { Pool, type PoolClient } from "pg";
import { env } from "./env";

const globals = globalThis as unknown as { agencyPool?: Pool };
export function db() {
  if (!globals.agencyPool) {
    globals.agencyPool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    // Idle clients can emit errors during a database restart. Do not crash the
    // server or log pg's raw client object (which includes connection details).
    globals.agencyPool.on("error", () =>
      console.error(
        "Database connection interrupted; new requests will reconnect.",
      ),
    );
  }
  return globals.agencyPool;
}
export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
