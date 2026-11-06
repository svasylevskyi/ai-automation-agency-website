# Guided workflow assessment

Visitors can open the optional three-step guide above the enquiry form or contact the agency directly. The guide covers workflow and team, current tools/frequency/difficulty, then desired outcome and timing. “Other / I’m not sure yet” includes an optional task description and a general workflow-review recommendation.

The result is available without contact details. Recommendations are deterministic rules, with a suggested scope, first step, prerequisites and workload guidance. Free text is context for the owner; it does not generate promises about integrations or savings. Timing is collected for the conversation, not used to imply delivery availability.

## From assessment to enquiry

- Back and Edit preserve the visitor’s draft. Discuss this workflow attaches the reviewed answers and returns focus to the enquiry form.
- The form shows the attached answers and recommendation, with Edit and Remove controls. It keeps any existing contact details and message. Workflow/team fields do not need to be repeated; additional context becomes optional.
- Removing the assessment restores the direct enquiry fields and the normal 20-character minimum message. Direct enquiries also support Other.
- Answers exist only in React memory: no local/session storage, URL payload, assessment API calls, external AI calls or analytics. Reloading clears them. The enquiry form still obtains its usual security token, without sending assessment answers.
- Only Send enquiry submits the assessment with contact details and the required data-use acknowledgement. Failed requests preserve the form and attachment for retry. Successful submission clears the assessment from the page.

## Persistence and validation

Migration `002-guided-assessment.sql` adds nullable `enquiries.assessment` JSONB and extends the workflow constraint to allow `other`. Existing rows remain valid with a null assessment. Run `npm run db:migrate` before starting the new release; the existing Hetzner deployment workflow does this automatically after its backup.

A complete version-1 assessment is required to submit without a message. The server bounds free text, validates every choice and requires the top-level workflow/team to match. It discards client-supplied recommendation content, derives the recommendation itself and saves a snapshot alongside the answers. Future rule changes must preserve the version-1 behavior or introduce a new version so a visitor's result and stored result remain consistent. New submissions use enquiry data-use notice version `enquiry-v4`, which links to the editable legal pages and explains the receipt email. Existing records retain their original notice version.

The owner detail view shows the structured assessment and saved recommendation. Authentication, origin checks, rate limits, honeypot, idempotent submission tokens, notification recovery and deletion behavior remain in force. Assessment content stays out of notification emails and public pages. Deleting an enquiry deletes its assessment with it.

## Verification and review

`npm run check` runs type checking, 17 unit/security/DOM interaction tests and the production build. The DOM tests exercise Other, Back/Edit, attachment, removal, optional context, preservation of existing contact details, failed-submit retry and direct enquiries. The HTTP/database suite now covers 94 assertions, including invalid/partial assessments, forged recommendation content, duplicate submissions, private rendering/escaping, notifications and deletion. The existing 15 deployment tests also pass.

Local validation used a production Next.js server, PostgreSQL and an SMTP capture service; migrations were applied twice. Browser visual review remains unverified: the managed preview launcher adds Vite-only `--host` and `--strictPort` flags that Next.js rejects. DOM tests do not verify layout or physical-device behavior.

After merging and running **Deploy website to Hetzner**, review the test site:

1. Open the optional guide and complete Other with a description. Use Back and Edit to check answers persist.
2. Read the recommendation without entering contact details. Select Discuss this workflow, review the attachment, and submit with only name/email and the acknowledgement.
3. Check Mailpit for the private inbox link and open the enquiry in admin to review all answers and the recommendation.
4. Try a predefined workflow, remove its attachment, then send a direct enquiry with a message.
5. Review the guide, result and attached summary on a narrow mobile viewport and with keyboard navigation.
