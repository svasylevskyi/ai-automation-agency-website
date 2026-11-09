import { z } from "zod";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
} from "@/server/http";
import { queueProspectForOwner } from "@/server/prospect";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const { version } = z
      .object({ version: z.number().int().min(1) })
      .strict()
      .parse(await readJson(request, 200));
    return json(await queueProspectForOwner(id, version));
  } catch (error) {
    return apiError(error);
  }
}
