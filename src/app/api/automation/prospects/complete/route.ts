import { apiError, json, readJson } from "@/server/http";
import { requireProspectWorker, completeProspect } from "@/server/prospect";
import { prospectCompletionSchema } from "@/lib/prospect";
export async function POST(request: Request) {
  try {
    requireProspectWorker(request);
    const input = prospectCompletionSchema.parse(
      await readJson(request, 40000),
    );
    return json(await completeProspect(input));
  } catch (error) {
    return apiError(error);
  }
}
