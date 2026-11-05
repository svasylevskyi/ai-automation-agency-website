import { z } from "zod";
import { db } from "@/server/db";
import { apiError, json } from "@/server/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const parsed = z.uuid().safeParse((await context.params).id);
    if (!parsed.success) return json({ error: "Not found." }, 404);
    const { rows } = await db().query(
      "SELECT data FROM brand_assets WHERE id=$1",
      [parsed.data],
    );
    if (!rows.length) return json({ error: "Not found." }, 404);
    return new Response(new Uint8Array(rows[0].data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
