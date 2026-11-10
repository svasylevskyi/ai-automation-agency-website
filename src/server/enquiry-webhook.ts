import type { SavedAssessment } from "../lib/assessment";
import type { Area, TeamSize } from "../lib/planner";
import { env } from "./env";

// Only the submission fields returned by the insert belong in this event.
export type SubmittedEnquiry = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  company: string;
  area: Area;
  teamSize: TeamSize;
  message: string;
  assessment: SavedAssessment | null;
  privacyNoticeVersion: string;
};

export async function postEnquiryWebhook(enquiry: SubmittedEnquiry) {
  const url = env().N8N_ENQUIRY_WEBHOOK_URL;
  if (!url) return;

  try {
    if (!["https:", "http:"].includes(new URL(url).protocol))
      throw new Error("Expected an HTTP(S) webhook");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...enquiry, privacyAcknowledged: true }),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    await response.body?.cancel();
    if (!response.ok)
      console.error("Enquiry webhook rejected", {
        id: enquiry.id,
        status: response.status,
      });
  } catch {
    // The URL and error can contain secrets. Log only the saved enquiry ID.
    console.error("Enquiry webhook delivery failed", { id: enquiry.id });
  }
}
