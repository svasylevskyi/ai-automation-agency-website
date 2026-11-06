import { retentionUpdateSchema } from "@/lib/retention";
import { saveRetention } from "@/server/retention";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    return json(
      await saveRetention(retentionUpdateSchema.parse(await readJson(request))),
    );
  } catch (error) {
    return apiError(error);
  }
}
