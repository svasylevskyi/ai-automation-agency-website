import { auth } from "@/server/auth";
import { env } from "@/server/env";
import { passwordChangeSchema } from "@/lib/validation";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
} from "@/server/http";
import { rateLimit } from "@/server/spam";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireApiOwner(request);
    const input = passwordChangeSchema.parse(await readJson(request, 8000));
    await rateLimit(`password-change:${session.user.id}`, 5, 900);
    // Delegate password verification, hashing and session rotation to Better Auth.
    // Its HTTP handler retains its own origin, fresh-session and rate-limit checks.
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.delete("content-length");
    const response = await auth().handler(
      new Request(`${env().APP_URL}/api/auth/change-password`, {
        method: "POST",
        headers: forwardedHeaders,
        body: JSON.stringify({
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        }),
      }),
    );
    if (!response.ok) {
      const error = await response.json();
      const message =
        error.code === "INVALID_PASSWORD"
          ? "Your current password is incorrect."
          : response.status === 429
            ? "Too many attempts. Please try again later."
            : response.status === 401
              ? "Please sign in again before changing your password."
              : "The password could not be changed. Please sign in again and retry.";
      return json({ error: message }, response.status);
    }
    // Only the HTTP-only rotated cookie goes to the browser, never the raw token.
    const result = json({
      message: "Password updated. Other sessions have been signed out.",
    });
    for (const cookie of response.headers.getSetCookie())
      result.headers.append("Set-Cookie", cookie);
    return result;
  } catch (error) {
    return apiError(error);
  }
}
