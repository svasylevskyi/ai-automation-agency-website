import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { recommendAssessment } from "@/lib/assessment";
import { enquirySchema } from "@/lib/validation";
import { db, transaction } from "@/server/db";
import { apiError, json, readJson, sameOrigin } from "@/server/http";
import { verifyChallenge, rateLimit, clientKey } from "@/server/spam";
import { processEnquiryMail } from "@/server/mail";
import { getSettings } from "@/server/settings";
import { confirmationMessage } from "@/lib/confirmation";
import { recordActivity } from "@/server/activity";
import { enqueueProspect } from "@/server/prospect";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = enquirySchema.parse(await readJson(request, 32000));
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
    const { settings } = await getSettings();
    const created = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO enquiries (id,submission_id,name,email,company,area,team_size,message,privacy_notice_version,assessment,confirmation_status,confirmation_payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enquiry-v4',$9,'pending',$10) ON CONFLICT (submission_id) DO NOTHING RETURNING id`,
        [
          id,
          submissionId,
          input.name,
          input.email,
          input.company,
          input.area,
          input.teamSize,
          input.message,
          input.assessment
            ? JSON.stringify({
                ...input.assessment,
                recommendation: recommendAssessment(input.assessment),
              })
            : null,
          JSON.stringify(confirmationMessage(settings)),
        ],
      );
      if (result.rowCount) {
        await recordActivity(client, id, "received");
        await enqueueProspect(client, id);
      }
      return !!result.rowCount;
    });
    if (created) after(() => processEnquiryMail(id));
    return accepted();
  } catch (error) {
    return apiError(error);
  }
}
