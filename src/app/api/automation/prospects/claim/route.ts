import { z } from "zod";
import { apiError, json, readJson } from "@/server/http";
import { requireProspectWorker, claimProspect } from "@/server/prospect";
export async function POST(request: Request) {
  try {
    requireProspectWorker(request);
    z.object({})
      .strict()
      .parse(await readJson(request, 100));
    return json({ job: await claimProspect() });
  } catch (error) {
    return apiError(error);
  }
}
