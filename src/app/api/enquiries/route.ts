import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { enquirySchema } from "@/lib/validation";
import { db } from "@/server/db";
import { apiError, json, readJson, sameOrigin } from "@/server/http";
import { verifyChallenge, rateLimit, clientKey } from "@/server/spam";
import { sendNotification } from "@/server/mail";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = enquirySchema.parse(await readJson(request, 24000));
    const accepted = () =>
      json({ message: "Thank you. Your enquiry has been received." }, 201);
    // Honeypot submissions receive the same response without creating records or mail.
    if (input.website) return accepted();
    const submissionId = verifyChallenge(input.token);
    if (
      (
        await db().query("SELECT id FROM enquiries WHERE submission_id=$1", [
          submissionId,
        ])
      ).rowCount
    )
      return accepted();
    await rateLimit(`enquiry:${clientKey(request.headers)}`, 5, 900);
    await rateLimit(`email:${input.email}`, 3, 3600);
    const id = randomUUID();
    const result = await db().query(
      `INSERT INTO enquiries (id,submission_id,name,email,company,area,team_size,message,privacy_notice_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enquiry-v1') ON CONFLICT (submission_id) DO NOTHING RETURNING id`,
      [
        id,
        submissionId,
        input.name,
        input.email,
        input.company,
        input.area,
        input.teamSize,
        input.message,
      ],
    );
    if (result.rowCount)
      after(async () => {
        try {
          await sendNotification(id);
        } catch {
          console.error(
            "Notification processing interrupted; saved enquiry remains available for retry.",
          );
        }
      });
    return accepted();
  } catch (error) {
    return apiError(error);
  }
}
