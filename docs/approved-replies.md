# Reviewed first replies

The owner can send one reviewed first reply per enquiry from the existing prospect assistant. n8n still prepares drafts only. No worker, schedule, page load, preview or “Mark ready” action sends a prospect reply.

## Owner flow

1. Open an enquiry and review the original message and prepared reply. Edit the greeting, wording and sign-off; replace `[Your name]` or other placeholders.
2. Save and **Mark ready to send**. Enter a subject. Optionally choose a follow-up action and date in Warsaw time.
3. Select **Preview email**. Check the exact To, From, Reply-To, subject, HTML, plain text and proposed reminder. The recipient comes from the saved enquiry and cannot be overridden by the browser.
4. Confirm the displayed details and select **Send reply**. The provider receives the approved message, with the website's agency footer. A successful provider response records acceptance and its reference, rather than claiming delivery/read confirmation.
5. A still-unchanged enquiry moves from New to Contacted. A selected reminder replaces its previous next action after acceptance. Newer owner edits are preserved; if the reminder cannot be applied, the delivery panel and activity history say so. No reminder email is sent automatically.

The preview expires after 15 minutes. A changed draft, enquiry version, sender, or replacement preview requires another preview. The approved reply becomes read-only; copying remains available. Later correspondence continues in Gmail. This increment does not synchronize incoming replies, create Gmail Sent items, or implement conversation threading or attachments.

## Delivery and recovery

- Migration `011-approved-replies.sql` creates an initially empty delivery table; no existing drafts are scheduled or sent. No new credentials are required. Set the public business email in Owner settings for Reply-To.
- The exact sender, recipient, subject, body, Reply-To and Message-ID are stored at preview time. Approval and a sending claim are committed before contacting the provider. Concurrent clicks and subsequent requests for an accepted message cannot send it again.
- A provider failure, timeout or interruption is shown as **Acceptance not confirmed**, or a stale **Sending** record. Refresh first; the provider may have accepted a request even when the response was lost.
- Resend recovery requires an explicit **Retry the same approved reply** action, the same provider, at most five attempts, and less than 23 hours since the first attempt. A sending claim must be five minutes old before recovery. The 23-hour cutoff leaves a margin within Resend's documented 24-hour idempotency window. Retries use the same immutable payload and key, including after sender/settings edits. Keep the same Resend account during recovery.
- There are no automatic retries for these replies. Generic SMTP has no equivalent deduplication guarantee, so an uncertain SMTP attempt cannot be retried here. Expired/exhausted Resend attempts are also blocked. Check the provider log before sending manually; a missing local success does not prove non-delivery.
- A database failure after provider acceptance leaves the durable claim recoverable under those rules. If the outcome cannot be resolved, retain the record and handle the conversation manually. Do not reset the delivery row or delete/recreate the enquiry to bypass duplicate protection.
- The parent enquiry is locked during the bounded provider call and recording transaction. A deletion winning before that call cancels the send; a deletion after acceptance cannot recall mail. Deleting an enquiry cascades to its preview/sent payload, draft and history, while keeping the existing minimal deletion marker for backup recovery.

The delivery record is visible only in the authenticated owner workspace. The activity history records approval/attempt/outcome metadata, not the reply body. Retention and encrypted backups cover the new table with the enquiry. Update the saved Privacy Policy before launch to describe stored reply content and the actual correspondence providers; the supplied policy file is a starting point, not a replacement for owner edits.

## Verification after deployment

Use a fresh enquiry from an address you control. Review and send the first reply, check the branded message in Gmail and reply to it. Confirm replies reach the public business inbox; check acceptance/history and the selected next action. Reopening the same enquiry must show the existing delivery record, with no second Send action. Use mocked transport tests or Mailpit for failure experiments rather than deliberately retrying live prospect messages.

Automated tests cover owner/origin guards, immutable recipients, stale/expired previews, concurrent clicks, legacy draft editing, provider failure and recovery, retry limits/window, preserving newer follow-ups, and deletion cascades. The UI preview is a sandboxed iframe with escaped body text and a plain-text alternative.

Reference: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
