import { z } from "zod";
import { replyPreviewSchema } from "@/lib/reply-delivery";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";
import { previewReply } from "@/server/reply-delivery";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    return json(
      await previewReply(
        id,
        replyPreviewSchema.parse(await readJson(request, 5000)),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
