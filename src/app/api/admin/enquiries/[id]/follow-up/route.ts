import { z } from "zod";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
} from "@/server/http";
import { completeFollowUp } from "@/server/enquiries";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(await readJson(request));
    return json(await completeFollowUp(id, version));
  } catch (error) {
    return apiError(error);
  }
}
