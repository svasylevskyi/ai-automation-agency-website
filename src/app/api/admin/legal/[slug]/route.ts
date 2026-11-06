import { legalSlugSchema, legalUpdateSchema } from "@/lib/legal";
import { db } from "@/server/db";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
  HttpError,
} from "@/server/http";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const slug = legalSlugSchema.safeParse((await params).slug);
    if (!slug.success) throw new HttpError(404, "Page not found.");
    const input = legalUpdateSchema.parse(await readJson(request, 250000));
    const { rows } = await db().query(
      `UPDATE legal_pages SET title=$1,content=$2,is_draft=$3,version=version+1,updated_at=now()
       WHERE slug=$4 AND version=$5 RETURNING version,updated_at`,
      [input.title, input.content, input.isDraft, slug.data, input.version],
    );
    if (!rows.length)
      throw new HttpError(
        409,
        "This page changed in another window. Copy your edits, then reload before saving.",
      );
    return json({
      version: rows[0].version,
      updatedAt: rows[0].updated_at.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
