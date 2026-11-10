import { inboxStatusSchema } from "@/lib/validation";
import { updateInboxStatuses } from "@/server/enquiries";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const input = inboxStatusSchema.parse(await readJson(request));
    return json(await updateInboxStatuses(input));
  } catch (error) {
    return apiError(error);
  }
}
