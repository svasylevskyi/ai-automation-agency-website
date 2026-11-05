import { db } from "@/server/db";
import { json } from "@/server/http";
export async function GET() {
  try {
    const result = await db().query(
      "SELECT version FROM site_settings WHERE singleton = true",
    );
    if (!result.rowCount) throw new Error("Not initialized");
    return json({
      status: "ok",
      release: process.env.RELEASE_ID || "development",
    });
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
