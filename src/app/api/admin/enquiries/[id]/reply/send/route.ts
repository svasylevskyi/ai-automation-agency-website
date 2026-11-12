import { z } from "zod";
import { replySendSchema } from "@/lib/reply-delivery";
import {
  apiError,
  json,
  readJson,
  requireApiOwner,
  sameOrigin,
} from "@/server/http";
import { sendReply } from "@/server/reply-delivery";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const input = replySendSchema.parse(await readJson(request, 1000));
    return json(await sendReply(id, input.deliveryId));
  } catch (error) {
    return apiError(error);
  }
}
