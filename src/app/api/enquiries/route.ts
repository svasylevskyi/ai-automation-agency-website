import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { recommendAssessment } from "@/lib/assessment";
import { enquirySchema } from "@/lib/validation";
import { db, transaction } from "@/server/db";
import { apiError, json, readJson, sameOrigin } from "@/server/http";
import { verifyChallenge, rateLimit, clientKey } from "@/server/spam";
import { processEnquiryMail } from "@/server/mail";
import { getBrand } from "@/server/settings";
import { env } from "@/server/env";
import { confirmationMessage } from "@/lib/confirmation";
import { notificationMessage } from "@/lib/notification";
import { serviceEnquirySuccess } from "@/lib/enquiry-routes";
import { recordActivity } from "@/server/activity";
import { enqueueProspect } from "@/server/prospect";
import {
  postEnquiryWebhook,
  type SubmittedEnquiry,
} from "@/server/enquiry-webhook";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = enquirySchema.parse(await readJson(request, 32000));
    const accepted = () =>
      json(
        {
          message: input.enquiryRoute
            ? serviceEnquirySuccess
            : "Thank you. Your enquiry has been received.",
        },
        201,
      );
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
    const brand = await getBrand();
    const appUrl = env().APP_URL;
    const created = await transaction(async (client) => {
      const result = await client.query<SubmittedEnquiry>(
        `INSERT INTO enquiries (id,submission_id,name,email,company,area,team_size,message,privacy_notice_version,assessment,confirmation_status,confirmation_payload,enquiry_route,business_website,current_tools,notification_payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'enquiry-v4',$9,'pending',$10,$11,$12,$13,$14) ON CONFLICT (submission_id) DO NOTHING
      RETURNING id,created_at AS "createdAt",name,email,company,area,team_size AS "teamSize",message,
        assessment,privacy_notice_version AS "privacyNoticeVersion",
        enquiry_route AS "enquiryRoute",business_website AS "businessWebsite",current_tools AS "currentTools"`,
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
          JSON.stringify(confirmationMessage(brand, appUrl, input.name)),
          input.enquiryRoute ?? null,
          input.businessWebsite,
          input.currentTools,
          JSON.stringify(notificationMessage(brand, appUrl, id)),
        ],
      );
      if (result.rowCount) {
        await recordActivity(client, id, "received");
        await enqueueProspect(client, id);
      }
      return result.rows[0];
    });
    if (created) {
      after(() => processEnquiryMail(id));
      after(() => postEnquiryWebhook(created));
    }
    return accepted();
  } catch (error) {
    return apiError(error);
  }
}
