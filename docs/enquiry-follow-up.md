# Enquiry acknowledgement and follow-up

This increment adds a visitor receipt, a next action/date, a Needs attention view and private activity history. The public form has no additional fields or steps. Emails use the configured provider: SMTP/Mailpit for local testing or Resend for production. See [live email setup](email-setup.md).

## Visitor experience

A successful submission shows that the enquiry was saved and explains that a confirmation email should follow. Its absence does not mean the enquiry was lost. The receipt contains fixed next-step wording, the agency name and an optional booking link. It does not include the visitor's name, message, company, assessment, private notes or an admin link. It is not a booking, paid order or marketing subscription.

Public email is also the Reply-To address for new receipts. When it is blank, the receipt explains that replies to the sender are not monitored and directs corrections to the website. The server sender (`MAIL_FROM`, falling back to legacy `SMTP_FROM`) and owner notification recipient remain separate server settings. Booking URL is included only when configured. These public settings are captured at submission time: retries use the same receipt wording, booking link and Reply-To address.

Replies go to that mailbox; this increment does not import email replies, provide a reply composer, or automatically email visitors on follow-up dates. The form acknowledgement now records `enquiry-v4`; earlier records keep their original notice version.

## Owner workflow

The inbox opens on **Needs attention**: all New enquiries plus non-closed enquiries whose follow-up date is today or earlier. Dates use **Europe/Warsaw**, independent of the owner's device or server timezone. The earliest dated actions appear first, followed by undated new enquiries. All and existing status filters remain available with pagination. Rows show the next action and a Due today, Overdue or Scheduled label when relevant.

An enquiry has at most one current next action and date. Enter both or leave both blank. A completed action is recorded in history and cleared, ready for the next one. Clearing an action is recorded separately from completing it. Complete or clear a follow-up before closing an enquiry. Completing an action does not change its status: an enquiry still marked New continues to need attention.

Save changes before completing the saved action. A stale save, completion or deletion is rejected; unsaved editor text remains available to copy. No-op saves do not create activity or advance the version. Editing an action can update its wording or reschedule its date. Dates range from 2000 through 2099 and must be real calendar dates.

## Activity and delivery

The owner-only activity history records receipt, status changes, note-update times, follow-up scheduling/changes/clearing/completion, and mail attempts/outcomes. It shows newest first, in Warsaw time, with 50 events per page. Previous note text is not retained in the history. Action text and dates are retained to explain completed or changed work. Ordinary calls and email replies are not tracked automatically; record relevant context in private notes.

Email-provider acceptance is labelled accurately: it does not confirm inbox delivery, reading or a later bounce. No tracking pixels or external email analytics are added.

Both mail channels use database claims. Concurrent workers cannot claim the same current attempt; an outdated worker cannot overwrite a newer claim. Maintenance retries failed or interrupted attempts after five minutes. Automatic recovery stops after five attempts per channel. The owner can manually retry owner notifications beyond that cap; visitor receipts have a hard five-attempt cap. Retry endpoints also have per-enquiry rate limits. Successfully accepted emails are not resent by a normal retry. On an interrupted fifth attempt, maintenance marks the outcome unknown/failed for review instead of leaving Sending forever.

Saving an enquiry and its initial history event is transactional. So are owner edits/history and mail-state/history updates. Delivery is separate: Resend deduplicates identical requests for 24 hours; SMTP has no equivalent guarantee. A crash after acceptance but before the database update can still cause a duplicate outside that window or after changing provider/message configuration. Resend message IDs and safe failure codes are recorded in the activity history; delivery/bounce events are checked in the provider dashboard. A receipt's address comes from the submitted email; it is not independently verified. Existing origin, honeypot, challenge and submission/email rate limits remain in force, and the body never reflects untrusted enquiry text.

Deleting an enquiry removes its action, receipt snapshot and activity rows from the active database. It does not recall email already in flight/accepted, remove Mailpit messages or erase backups. Apply the agreed retention process to those stores separately. [Retention and R2 recovery](r2-backup-setup.md) now provide optional closed-enquiry expiry and minimal deletion checkpoints for recovery.

## Migration and deployment

`004-enquiry-follow-up.sql` adds the fields and activity table. Earlier enquiries retain their status and notes, start with no scheduled action, and are explicitly excluded from retrospective confirmation emails. Their history starts with a migration marker, without inventing prior actions or email events.

The migration updates the original legal drafts only if they are still unedited version-1 drafts with exactly the original content. Any saved/customised or ready page is preserved. If you edited those pages, incorporate the receipt and activity-history descriptions from `src/content/privacy-policy.md` and `src/content/website-terms.md` into your wording. Provider/contact/retention placeholders still need review before launch. Editing the documents does not change retention operations.

Merge and run the existing **Deploy website to Hetzner** workflow. It backs up the database and applies the migration. No new dependencies, environment variables or systemd units are required; the existing five-minute maintenance timer now recovers both email channels. Local upgrades need `npm run db:migrate` before starting the app.

## Review after deployment

1. Submit a fresh enquiry. Check the saved record, owner notification and visitor receipt in Mailpit. The receipt should contain no submitted message or assessment.
2. Open the record from Needs attention. Set Contacted, a next action and today's date; save and check its Due today label.
3. Complete the action, check its history entry, then schedule another date. An action in the past should show Overdue; a future action remains available under All.
4. Try two admin tabs: save in one, then attempt to save an older revision in the other. Its text must remain visible with a conflict message.
5. Check the layout at narrow and wide widths, then review the legal pages and complete any owner-edited wording updates.

## Verification

Local validation passed the production build and TypeScript, 26 unit/security/DOM tests, 213 production HTTP/PostgreSQL assertions, and 15 deployment tests. SMTP capture verified 20 test messages.

Unit/DOM tests cover valid dates, Warsaw day boundaries, receipt content, activity wording and the editor's save/complete/conflict flow. Production HTTP/PostgreSQL tests cover ownership/origin protection, existing-data upgrade, validation, date filtering, concurrent writes, idempotent submission, independent mail failure/recovery, retry bounds, stale claims, history pagination/deletion and repeated migrations. SMTP capture checks the receipt headers/content. Existing assessment, settings, password and deployment tests also run.

Visual browser QA remains unverified because the managed preview launcher passes unsupported flags to Next.js. The source and DOM checks do not replace post-deployment mobile/desktop review.
