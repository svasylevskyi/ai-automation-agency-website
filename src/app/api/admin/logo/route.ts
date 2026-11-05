import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import {
  apiError,
  json,
  readBody,
  sameOrigin,
  requireApiOwner,
} from "@/server/http";
import { prepareLogo } from "@/server/uploads";
import { rateLimit } from "@/server/spam";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    await rateLimit("logo-upload", 20, 3600);
    const logo = await prepareLogo(await readBody(request, 2 * 1024 * 1024));
    const id = randomUUID();
    await db().query(
      "INSERT INTO brand_assets (id,data,width,height) VALUES ($1,$2,$3,$4)",
      [id, logo.data, logo.width, logo.height],
    );
    return json({ id, width: logo.width, height: logo.height });
  } catch (error) {
    return apiError(error);
  }
}
