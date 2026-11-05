import { apiError, json } from "@/server/http";
import { issueChallenge, rateLimit, clientKey } from "@/server/spam";
export async function GET(request: Request) {
  try {
    await rateLimit(`challenge:${clientKey(request.headers)}`, 60, 60);
    return json({ token: issueChallenge() });
  } catch (error) {
    return apiError(error);
  }
}
