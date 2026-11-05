import { auth } from "@/server/auth";
import { apiError, sameOrigin, json, readBody, HttpError } from "@/server/http";
import { rateLimit, clientKey } from "@/server/spam";

export const runtime = "nodejs";
const allowed: Record<string, string> = {
  "/api/auth/sign-in/email": "POST",
  "/api/auth/sign-out": "POST",
  "/api/auth/get-session": "GET",
};
async function handle(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (allowed[path] !== request.method)
      return json({ error: "Not found." }, 404);
    if (request.method === "POST") {
      sameOrigin(request);
      if (
        request.headers.get("content-type")?.split(";")[0] !==
        "application/json"
      )
        throw new HttpError(415, "Send JSON content.");
      if (path.endsWith("/sign-in/email"))
        await rateLimit(`login:${clientKey(request.headers)}`, 10, 900);
      const body = await readBody(request, 8000);
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body.toString("utf8"),
      });
    }
    const response = await auth().handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return apiError(error);
  }
}
export { handle as GET, handle as POST };
