import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { requireOwner } from "@/server/owner-page";
import { EnquiryEditor } from "@/components/enquiry-editor";
import { EnquiryActivity } from "@/components/enquiry-activity";
import { ProspectAssistant } from "@/components/prospect-assistant";
import { getProspectJob, prospectEnabled } from "@/server/prospect";
import {
  AssessmentSummary,
  Recommendation,
} from "@/components/assessment-summary";
import type { SavedAssessment } from "@/lib/assessment";
import { areas } from "@/lib/planner";
export default async function Enquiry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityPage?: string }>;
}) {
  await requireOwner();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { rows } = await db().query(
    "SELECT *,follow_up_on::text AS due_date FROM enquiries WHERE id=$1",
    [id.data],
  );
  const item = rows[0];
  if (!item) notFound();
  const assessment = item.assessment as SavedAssessment | null;
  return (
    <>
      <Link className="text-link" href="/admin">
        ← Enquiry inbox
      </Link>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Enquiry details</div>
          <h1>{item.name}</h1>
          <p>
            Received{" "}
            {item.created_at.toLocaleString("en-GB", {
              timeZone: "Europe/Warsaw",
            })}{" "}
            (Warsaw)
          </p>
        </div>
      </div>
      <div className="enquiry-sections">
        <details className="admin-card prospect-details" open>
          <summary>
            <h2>Prospect details</h2>
          </summary>
          <dl className="enquiry-facts">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${item.email}`}>{item.email}</a>
            </dd>
            <dt>Company</dt>
            <dd>{item.company || "Not supplied"}</dd>
            <dt>Workflow</dt>
            <dd>{areas[item.area as keyof typeof areas]}</dd>
            <dt>Team</dt>
            <dd>
              {
                {
                  small: "Small business or growing team",
                  mid: "Medium-sized business",
                  large: "Department in a larger organisation",
                }[item.team_size as "small" | "mid" | "large"]
              }
            </dd>
          </dl>
          <h3>Message</h3>
          <p className="enquiry-message">
            {item.message || "No additional message supplied."}
          </p>
          {assessment && (
            <section
              className="attached-assessment"
              aria-labelledby="assessment-title"
            >
              <h3 id="assessment-title">Workflow assessment</h3>
              <AssessmentSummary answers={assessment} />
              <h3>Recommendation shown to the visitor</h3>
              <Recommendation result={assessment.recommendation} />
            </section>
          )}
          <p className="privacy-note">
            Visitor acknowledged enquiry data use ({item.privacy_notice_version}
            ).
          </p>
        </details>
        <ProspectAssistant
          id={item.id}
          version={item.version}
          closed={item.status === "closed"}
          enabled={prospectEnabled()}
          job={await getProspectJob(item.id)}
        />
        <EnquiryEditor
          key={item.id}
          id={item.id}
          status={item.status}
          notes={item.notes}
          version={item.version}
          nextAction={item.next_action}
          followUpDate={item.due_date}
          notification={item.notification_status}
          confirmation={item.confirmation_status}
          confirmationAttempts={item.confirmation_attempts}
        />
        <EnquiryActivity
          id={item.id}
          requestedPage={(await searchParams).activityPage}
        />
      </div>
    </>
  );
}
