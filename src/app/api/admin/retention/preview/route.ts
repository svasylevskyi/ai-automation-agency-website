import { retentionPreviewSchema } from "@/lib/retention";
import { previewRetention } from "@/server/retention";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const input = retentionPreviewSchema.parse(await readJson(request));
    return json(await previewRetention(input.days, input.version));
  } catch (error) {
    return apiError(error);
  }
}
