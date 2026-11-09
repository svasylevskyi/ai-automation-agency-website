"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prospectStatusLabels, type ProspectJob } from "@/lib/prospect";
import { ReplyDraftEditor } from "./reply-draft-editor";

export function ProspectAssistant({
  id,
  version,
  closed,
  enabled,
  job,
}: {
  id: string;
  version: number;
  closed: boolean;
  enabled: boolean;
  job: ProspectJob | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const canQueue = !job || ["failed", "cancelled"].includes(job.status);
  async function queue() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/enquiries/${id}/prospect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFeedback("Queued. Refresh after n8n has processed the enquiry.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not queue the brief.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="admin-card prospect-card"
      aria-labelledby="prospect-title"
    >
      <h2 id="prospect-title">Prospect assistant</h2>
      <p>
        Internal preparation only. Review the original enquiry and adapt the
        draft before replying. Nothing here sends an email or changes follow-up
        fields.
      </p>
      {!enabled && (
        <p className="notice">
          Automation is paused. Enable it in the server configuration after
          connecting n8n.
        </p>
      )}
      <p>
        <strong>
          {job ? prospectStatusLabels[job.status] : "No brief requested"}
        </strong>
        {job && ` · ${job.attempts} of 5 processing attempts`}
      </p>
      {job && (
        <p className="privacy-note">
          Requested{" "}
          {new Date(job.createdAt).toLocaleString("en-GB", {
            timeZone: "Europe/Warsaw",
          })}{" "}
          (Warsaw).
          {job.completedAt &&
            ` Prepared ${new Date(job.completedAt).toLocaleString("en-GB", { timeZone: "Europe/Warsaw" })} (Warsaw).`}
        </p>
      )}
      {job?.result && (
        <>
          <p className="privacy-note">
            Rule-based preparation · rules-v1 · based on the submitted enquiry,
            without external research or AI inference.
          </p>
          <h3>Prospect brief</h3>
          <p className="enquiry-message">{job.result.brief}</p>
          <h3>Discovery questions</h3>
          <ul>
            {job.result.discoveryQuestions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
          <h3>Suggested next action</h3>
          <p>{job.result.nextAction}</p>
          <ReplyDraftEditor
            key={id}
            id={id}
            original={job.result.replyDraft}
            review={job.review}
          />
        </>
      )}
      {closed && (
        <p className="privacy-note">
          This enquiry is closed. Reopen it before requesting a brief.
        </p>
      )}
      {enabled && !closed && canQueue && (
        <button
          type="button"
          className="button secondary"
          disabled={pending}
          onClick={queue}
        >
          {pending
            ? "Queuing…"
            : job
              ? "Retry preparation"
              : "Prepare brief in n8n"}
        </button>
      )}
      {job && ["pending", "running", "failed"].includes(job.status) && (
        <p className="privacy-note">
          n8n checks every minute. Interrupted work is retried after a
          ten-minute lease, up to five attempts. If this remains waiting, check
          the published n8n workflow and credentials. You can continue handling
          the enquiry manually.
        </p>
      )}
      <p role="status">{feedback}</p>
      <button
        type="button"
        className="text-link"
        onClick={() => router.refresh()}
      >
        Refresh preparation status
      </button>
    </section>
  );
}
