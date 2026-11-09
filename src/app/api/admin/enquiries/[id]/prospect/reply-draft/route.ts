import { z } from "zod";
import { replyDraftUpdateSchema } from "@/lib/prospect";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";
import { saveReplyDraft } from "@/server/prospect";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const input = replyDraftUpdateSchema.parse(await readJson(request, 25000));
    return json(await saveReplyDraft(id, input));
  } catch (error) {
    return apiError(error);
  }
}
