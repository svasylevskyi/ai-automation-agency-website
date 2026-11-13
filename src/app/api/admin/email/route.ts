import { auth } from "@/server/auth";
import { emailChangeSchema } from "@/lib/validation";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
} from "@/server/http";
import { changeOwnerEmail } from "@/server/owner-account";
import { rateLimit } from "@/server/spam";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await requireApiOwner(request);
    const input = emailChangeSchema.parse(await readJson(request, 8000));
    await rateLimit(`email-change:${session.user.id}`, 5, 900);
    await changeOwnerEmail({
      userId: session.user.id,
      sessionId: session.session.id,
      currentEmail: input.currentEmail,
      newEmail: input.newEmail,
      currentPassword: input.currentPassword,
    });
    const result = json({
      message: "Email address updated. Sign in with your new email address.",
    });
    // Sessions have already been revoked atomically. Clearing the browser's
    // cookie is best-effort and must not report a committed change as failed.
    try {
      const signedOut = await auth().api.signOut({
        headers: request.headers,
        asResponse: true,
      });
      for (const cookie of signedOut.headers.getSetCookie())
        result.headers.append("Set-Cookie", cookie);
    } catch {
      console.error("Could not clear the revoked owner session cookie.");
    }
    return result;
  } catch (error) {
    return apiError(error);
  }
}
