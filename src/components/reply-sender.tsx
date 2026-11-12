"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ReplyDelivery } from "@/lib/reply-delivery";
import { warsawToday, formatFollowUpDate } from "@/lib/follow-up";

export function ReplySender({
  id,
  reviewVersion,
  enquiryVersion,
  ready,
  closed,
  delivery,
  onLock,
}: {
  id: string;
  reviewVersion: number;
  enquiryVersion: number;
  ready: boolean;
  closed: boolean;
  delivery: ReplyDelivery | null;
  onLock: (locked: boolean) => void;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<ReplyDelivery | null>(null);
  const current =
    delivery && (!local || delivery.updatedAt > local.updatedAt)
      ? delivery
      : local;
  const [subject, setSubject] = useState("Following up on your enquiry");
  const [schedule, setSchedule] = useState(false);
  const [action, setAction] = useState(
    "Check whether the visitor needs any further information",
  );
  const [date, setDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [previewCurrent, setPreviewCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const approved = current && current.status !== "preview";
  const previewValid =
    current?.status === "preview" &&
    previewCurrent &&
    ready &&
    !closed &&
    current.reviewVersion === reviewVersion &&
    current.enquiryVersion === enquiryVersion;
  const invalidate = () => {
    setPreviewCurrent(false);
    setConfirmed(false);
  };

  async function request(kind: "preview" | "send") {
    setBusy(true);
    setFeedback("");
    if (kind === "send") onLock(true);
    try {
      const response = await fetch(`/api/admin/enquiries/${id}/reply/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "preview"
            ? {
                subject,
                reviewVersion,
                enquiryVersion,
                followUp: schedule ? { action, date } : null,
              }
            : { deliveryId: current!.id, confirmed: true },
        ),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not complete the request.");
      if (!data)
        throw new Error(
          "This enquiry is no longer available. Check the provider log before any further send.",
        );
      setLocal(data);
      setConfirmed(false);
      setPreviewCurrent(kind === "preview");
      if (kind === "send") {
        setFeedback(
          data.status === "accepted"
            ? "Reply accepted by the email provider."
            : "Check the delivery status below before taking another action.",
        );
        router.refresh();
      }
    } catch (error) {
      if (kind === "send") onLock(false);
      setFeedback(
        `${error instanceof Error ? error.message : "Request interrupted."}${kind === "send" ? " Refresh the enquiry to check its delivery record before taking another action." : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reply-send-panel" aria-labelledby="send-reply-title">
      <h3 id="send-reply-title">
        {approved ? "First reply delivery" : "Preview and send first reply"}
      </h3>
      {!approved && (
        <>
          <p className="privacy-note">
            Review the greeting, content and sign-off above. The website adds
            the agency footer. Mark the reply ready, then preview the exact
            email here. Replies from the visitor go to your business inbox.
          </p>
          <div className="field">
            <label htmlFor="reply-subject">Subject</label>
            <input
              id="reply-subject"
              value={subject}
              maxLength={160}
              disabled={busy}
              onChange={(e) => {
                setSubject(e.target.value);
                invalidate();
              }}
            />
          </div>
          <label className="reply-confirmation">
            <input
              type="checkbox"
              checked={schedule}
              disabled={busy}
              onChange={(e) => {
                setSchedule(e.target.checked);
                invalidate();
              }}
            />{" "}
            Schedule a follow-up reminder after acceptance
          </label>
          {schedule && (
            <div className="reply-follow-up-fields">
              <div className="field">
                <label htmlFor="reply-follow-up-action">Next action</label>
                <input
                  id="reply-follow-up-action"
                  value={action}
                  maxLength={300}
                  disabled={busy}
                  onChange={(e) => {
                    setAction(e.target.value);
                    invalidate();
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="reply-follow-up-date">
                  Follow-up date (Warsaw)
                </label>
                <input
                  id="reply-follow-up-date"
                  type="date"
                  min={warsawToday()}
                  value={date}
                  disabled={busy}
                  onChange={(e) => {
                    setDate(e.target.value);
                    invalidate();
                  }}
                />
              </div>
              <p className="privacy-note">
                This replaces the existing next action only after acceptance,
                provided the enquiry has not changed. It does not send another
                email.
              </p>
            </div>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={
              busy ||
              !ready ||
              closed ||
              !subject.trim() ||
              (schedule && (!date || !action.trim()))
            }
            onClick={() => request("preview")}
          >
            {busy ? "Working…" : "Preview email"}
          </button>
          {!ready && (
            <p className="privacy-note">
              Save your edits and mark the reply ready to enable preview.
            </p>
          )}
          {closed && (
            <p className="privacy-note">Reopen the enquiry before sending.</p>
          )}
        </>
      )}
      {current && (approved || previewValid) && (
        <>
          <dl className="enquiry-facts reply-envelope">
            <dt>To</dt>
            <dd>{current.to}</dd>
            <dt>From</dt>
            <dd>{current.from}</dd>
            <dt>Replies to</dt>
            <dd>{current.replyTo}</dd>
            <dt>Subject</dt>
            <dd>{current.subject}</dd>
          </dl>
          <iframe
            className="reply-email-preview"
            title="Branded reply preview"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={current.html}
          />
          <details>
            <summary>Plain-text version</summary>
            <p className="enquiry-message">{current.text}</p>
          </details>
          <p>
            {current.followUp
              ? `Chosen reminder: ${current.followUp.action} — ${formatFollowUpDate(current.followUp.date)}.`
              : "No new reminder selected; the existing next action is kept."}
          </p>
          {previewValid && (
            <>
              <label className="reply-confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I have checked the recipient, wording and follow-up shown above.
              </label>
              <button
                type="button"
                className="button"
                disabled={!confirmed || busy}
                onClick={() => request("send")}
              >
                {busy ? "Sending…" : "Send reply"}
              </button>
            </>
          )}
          {approved && (
            <div className="notice" role="status">
              {current.status === "accepted" ? (
                <>
                  <strong>Accepted by the email provider</strong>
                  <p>
                    {new Date(current.acceptedAt!).toLocaleString("en-GB", {
                      timeZone: "Europe/Warsaw",
                    })}{" "}
                    (Warsaw). This does not confirm inbox delivery or a read.
                  </p>
                  {current.providerMessageId && (
                    <p>Provider reference: {current.providerMessageId}</p>
                  )}
                  {current.followUpOutcome === "applied" && (
                    <p>Follow-up reminder saved.</p>
                  )}
                  {current.followUpOutcome === "not_applied" && (
                    <p>
                      The enquiry changed or the date passed. Review and
                      schedule the follow-up manually.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <strong>
                    {current.status === "sending"
                      ? "Sending or awaiting confirmation"
                      : "Acceptance not confirmed"}
                  </strong>
                  <p>
                    The message may already have been sent. Refresh to check the
                    latest status. Safe Resend retries use the same message and
                    are available for up to 23 hours, with five attempts in
                    total. A running attempt must age five minutes before
                    recovery.
                  </p>
                  {current.retryAllowed && !closed ? (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => request("send")}
                    >
                      {busy ? "Retrying…" : "Retry the same approved reply"}
                    </button>
                  ) : (
                    <p>
                      When no safe retry is available, check the provider log
                      before replying from Gmail.
                    </p>
                  )}
                </>
              )}
              <p>
                This first reply is locked. Continue later correspondence in
                your business inbox.
              </p>
            </div>
          )}
        </>
      )}
      <p role="status">{feedback}</p>
    </section>
  );
}
