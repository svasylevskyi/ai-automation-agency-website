import { env } from "./env";
import { ownerSession } from "./auth";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== env().APP_URL)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function requireApiOwner(request: Request) {
  const session = await ownerSession(request.headers);
  if (!session) throw new HttpError(401, "Please sign in again.");
  return session;
}
export async function readBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "The submitted content is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request, maxBytes = 20000) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new HttpError(415, "Send JSON content.");
  try {
    return JSON.parse((await readBody(request, maxBytes)).toString("utf8"));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The request could not be read.");
  }
}
export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return json(
      { error: error.message },
      error.status,
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
    );
  if (error instanceof z.ZodError)
    return json(
      {
        error: "Please check the highlighted fields.",
        fields: z.flattenError(error).fieldErrors,
      },
      400,
    );
  // Never log enquiry content, cookies, credentials or raw database/SMTP errors.
  console.error("Request failed", {
    errorType: error instanceof Error ? error.name : "Unknown",
  });
  return json(
    { error: "Something went wrong. Please try again shortly." },
    503,
  );
}
