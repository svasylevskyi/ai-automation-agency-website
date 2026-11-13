import { legalSlugSchema, legalUpdateSchema } from "@/lib/legal";
import { updateLegalPage } from "@/server/legal-update";
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
    return json(await updateLegalPage(slug.data, input));
  } catch (error) {
    return apiError(error);
  }
}
