# Editable Privacy Policy and Website Terms

The website has public `/privacy` and `/terms` pages, linked from the footer, assessment and enquiry form. Links beside interactive forms open in a new tab so the visitor can read without losing an unfinished enquiry. Each page has its own title/canonical URL, a contents list, an update date and revision, a printable text layout, and a visible draft label when applicable.

## Public contact fields

| Field in Admin → Settings | Website behavior | When blank |
| --- | --- | --- |
| Public email | A `mailto:` link beside the enquiry data-use explanation and an email fallback in the no-JavaScript message. Uses the visitor's email application and supplies Reply-To for new visitor confirmation emails. | Those email links are hidden; the enquiry form still works. |
| Booking URL | Adds “Prefer a call? Choose a time” below the form, linking to the supplied HTTPS scheduling page. Also included in new confirmation emails. It is a link, not an embedded booking system. | The booking option is hidden. |
| Custom Privacy Policy URL | Overrides Privacy Policy links in the footer, guide and enquiry form. Use only when hosting the policy elsewhere. | All those links use the built-in `/privacy` page. |

These fields are public presentation settings. They do not configure SMTP, the `NOTIFICATION_EMAIL` recipient or the text of either legal page. Existing HTTPS privacy URLs are preserved; the privacy editor explains that clearing the override is necessary to direct visitors to the built-in page. Website Terms always link to `/terms`.

## Editing

Admin → Legal docs contains Privacy Policy (`/admin/legal/privacy`) and Website Terms (`/admin/legal/terms`), each on its own page with a title, text editor, preview and Save button. Agency details and the custom policy URL are under Settings → Agency identity (`/admin/agency-identity`). Use blank lines for paragraphs, `## ` for headings and `- ` for bullets. Other syntax, HTML and embedded content remain literal text; they are never executed. The preview uses the same renderer as the public page.

Saving replaces the current public text immediately. Each page saves independently. A version check rejects stale updates from another window without discarding the current editor's text. The revision number is an edit counter, not an accessible document history; keep copies of older wording if needed.

Both seeded pages start marked **Draft for review**. They are public review copies, not private drafts. They remain `noindex` even if the rest of the site is later indexed. Removing the draft mark requires replacing all uppercase bracketed placeholders. This validation is not a legal-compliance check: final wording and operating arrangements still need review. The site's `INDEX_SITE=false` setting continues to keep ready pages out of search as well.

## Draft text and remaining decisions

Full initial texts are in `src/content/privacy-policy.md` and `src/content/website-terms.md`. They are tailored to the current website: browser-local rules-based assessment, protected enquiry inbox, link-only owner notifications captured locally in the test environment, optional external booking and no public checkout/signup or marketing analytics.

The drafts identify the agency as Get Automated, operated by Stepan Vasylevskyi - InfoTech Consulting, at https://get-automated.ai. Registration details, postal address and public/privacy/complaints contacts still have placeholders. The privacy draft also leaves explicit placeholders for actual supplier entities/locations, international-transfer arrangements, and enquiry/log/backup retention. These facts cannot be inferred safely from page content or a hosting brand alone.

The current build allows manual enquiry deletion, optional closed-enquiry expiry (disabled by default), and separate Restic/R2 backup rotation after server setup and successful recovery checks. See [R2 setup and retention](r2-backup-setup.md). It also cleans expired rate-limit/session rows. Changing the legal text does not change that behavior. Confirm and implement the chosen retention schedule before declaring the policy ready. Do not state that no international transfers occur without checking the actual supplier/access arrangements.

The existing checkbox remains an acknowledgement of the short enquiry data-use explanation, not marketing consent or acceptance of a paid engagement. New enquiries store `enquiry-v4`, which also explains receipt emails; older records retain their original notice version. The counter on an editable legal page is not attached to this acknowledgement, and this increment does not claim to collect versioned acceptance of Website Terms. If a later service needs contractual acceptance/audit history, implement that deliberately for the relevant service.

## Storage and deployment

Migration `003-legal-pages.sql` creates `legal_pages`. The migration script seeds the two complete texts only when their rows do not exist. Re-running migrations or deploying future code preserves all owner edits. Migration 004 refreshes only the exact untouched version-1 review drafts to describe receipt emails and activity history; customised pages must be reviewed manually for these additions. Existing enquiries, settings, owner credentials and custom Privacy Policy URLs are preserved.

Migration 008 fills the remaining identity placeholders in stored pages with the supplied legal name, brand and production URL. It also adds the production URL to the standard privacy introduction. The replacements preserve surrounding admin edits and each page's draft setting. A changed page gets a new revision and update date, so an editor opened before deployment must reload before saving. For fully customised wording with no matching placeholders or standard introduction, review the identity in Admin → Legal docs.

The existing deployment backs up the database and applies the migration automatically. No new environment variables or dependencies are required. Local upgrades need `npm run db:migrate` before starting the app. The release package already includes `src/content/`, so first-run seeding also works from an unpacked release.

## Verification

Local validation passed TypeScript, the production build, 21 unit/security/DOM tests, 128 production HTTP/PostgreSQL assertions and 15 deployment tests. Checks cover safe text rendering, placeholders, length bounds, owner/origin protection, unknown slugs, per-page updates, stale edits, persistence after re-running migrations, custom/default links, draft metadata and form/notification regressions.

Visual browser QA remains unverified because the managed preview launcher supplies Vite-only flags to Next.js. After deploying to the test environment:

1. Open both pages from the footer and from the form; check the draft banner, contents links and mobile/print layout.
2. Edit a paragraph in Admin → Legal docs → Privacy Policy or Website Terms, preview it, save, and reload the public page.
3. Confirm that the other legal page remains unchanged. In two admin tabs, try saving an older edit and check that it is rejected while keeping its text.
4. Leave the custom Privacy Policy URL blank for the built-in page. If testing an override, check footer/form/guide links and then clear it again.
5. Open a legal link while drafting an enquiry; the form tab should retain the visitor's answers.

## Legal drafting references

Reviewed on 6 November 2026. These are drafting references, not confirmation that the placeholder drafts are ready for live use.

- GDPR, especially Articles 6, 12–13 and 15–22: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- European Commission guidance on transparency: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en
- European Commission guidance on lawful bases: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en
- European Commission guidance on storage limitation: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- UODO rights and requests: https://bip.uodo.gov.pl/pl/493/155
- Polish Act on Providing Services by Electronic Means, especially Articles 5–8: https://eli.gov.pl/api/acts/DU/2024/1513/text.html
- The 2026 amendment reviewed alongside that consolidated text: https://eli.gov.pl/api/acts/DU/2026/1296/text.pdf
