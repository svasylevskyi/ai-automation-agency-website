# Privacy Policy, Website Terms and shared details

The public `/privacy` and `/terms` pages use the shared website header/footer, a contents list, revision/date, safe text rendering and print styles. Their editors are under **Admin → Legal docs → Privacy Policy / Website Terms**.

## Templates and fields

Keep `{UPPERCASE_NAME}` placeholders in the page title or text. Below the template, **Details used in this document** groups its fields into business identity, contacts, suppliers/processing, retention and additional details. A new uppercase placeholder creates an editable field. Repeated placeholders use one value. Values shared between the two documents have a single stored source; changing the postal address, for example, updates every occurrence in both documents.

The preview substitutes unsaved values using the same literal resolver as the public content, contents list and metadata. HTML remains escaped text; values are not executed and cannot refer to another placeholder. Legacy `[UPPERCASE_NAME]` tokens are recognised for compatibility, but the refreshed templates use curly braces. Limit: 64 saved keys, 64 characters per key, 4,000 characters per value. Removing a token from a template retains its value for later reuse.

Saving publishes that document and its referenced shared values immediately. The server checks both the document revision and shared-values revision, then saves in one transaction. It rejects stale edits from another tab without discarding the current form. An affected second document gets a new revision/date too. A page cannot change fields it does not reference. Clearing a shared value needed by a ready page returns that page to draft; filling it later does not approve it automatically.

Drafts are public review copies with a draft banner and `noindex`, not private previews. Marking a page ready requires all its placeholders to resolve. The check validates completeness, not legal compliance. Site-wide `INDEX_SITE=false` still prevents indexing even for ready pages.

## Confirmed details and current behaviour

The November 2026 refresh uses the owner's supplied legal name **Stepan Vasylevskyi - IT Consulting**, business address, NIP/REGON and `support@get-automated.ai` for general, privacy and complaints contacts. The brand and public URL remain Get Automated and https://get-automated.ai.

The wording covers the service-page enquiry routes and optional fields, browser-local rules-based assessment, protected inbox, activity records, branded acknowledgements/notifications, owner-approved first replies, follow-ups and admin account changes. It distinguishes the marketed automation service from current website processing.

Confirmed production arrangements:

- Hetzner hosting in Nuremberg, Germany; Cloudflare DNS only.
- Resend Free with Ireland sending region, and Google Workspace/Gmail for correspondence.
- Encrypted Cloudflare R2 backups with EU jurisdiction, using the supplied 7/35/65-day policies and newest-copy safeguards.
- Closed-enquiry deletion enabled after 180 days from closure/latest edit; daily review of open enquiries.
- Mailbox deletion is manual, with purpose/obligation/claim-based retention rather than an invented automatic deadline.
- n8n Cloud/OpenAI testing only, execution-data saving disabled; no real-enquiry processing through that workflow yet.
- No booking integration, analytics/pixels or CRM currently in use.

**One field remains intentionally blank: `LOG_RETENTION`.** The repository's Caddy example does not enable an access-log block or configure system-journal retention. This does not prove the live server uses the same configuration. Do not substitute a guessed number. Check the active Caddy configuration, journald retention/size limits and any logrotate rules; then enter the actual period or retention criteria in the Privacy Policy editor. The Privacy Policy cannot be marked ready while this field is empty.

Read-only starting points on the server (do not paste secrets or raw request logs into chat):

```bash
sudo systemd-analyze cat-config systemd/journald.conf
sudo journalctl --disk-usage
sudo less /etc/caddy/Caddyfile
sudo ls /etc/logrotate.d
```

If there is no fixed maximum age, identify the actual size/rotation criteria rather than describing a fixed deletion deadline. A desired new retention limit requires a separate operational change before the notice can describe it as active.

Legal fields only describe the setup. They do not change the public email in **Settings → Agency identity**, the admin login, `NOTIFICATION_EMAIL`, mail credentials, deletion policy or server jobs. Review those separately if their values also need changing. The custom Privacy Policy URL override still controls links in the footer and forms; leave it blank to use `/privacy`.

Before enabling real n8n/OpenAI processing, review both the full-submission webhook (`N8N_ENQUIRY_WEBHOOK_URL`) and prospect-worker flow (`PROSPECT_AUTOMATION_ENABLED`). The webhook includes contact fields; the worker omits separate contact fields but free text can still identify people. Disabled execution-history saving is not the same as no processing. The supplied policy follows the owner's confirmation that real enquiries are not currently processed there. Revisit recipients, purposes, transfers and retention before activating either flow for real data.

## Deployment and preservation

Migration **012-legal-placeholder-fields.sql** creates `legal_details` and performs the owner's explicitly requested **one-time replacement** of both saved initial drafts. It installs the refreshed templates and prefilled values, bumps existing document revisions, and marks both documents as drafts for review. Fresh installations receive the same templates and values. `src/content/legal-details.json` records the supplied defaults; the migration freezes this release's exact content.

The normal deployment takes its existing database backup and applies the migration. Run `npm run db:migrate` for local upgrades. Existing enquiries, credentials, agency settings, mail configuration and operational retention are unaffected. Later deployments and repeated migration runs preserve legal templates and values edited in admin. Do not edit a previously applied migration or turn seeding into an unconditional overwrite.

The enquiry checkbox still acknowledges the short data-use explanation (`enquiry-v4`); it does not collect acceptance of paid services or versioned contractual acceptance of Website Terms. Editable legal revisions are publication counters, not an accessible historical archive.

## Source review — 13 November 2026

The business facts and active settings above were supplied by the owner. Supplier documentation supports these distinctions:

- [Resend GDPR information](https://resend.com/security/gdpr) and [DPA](https://resend.com/legal/dpa): Plus Five Five, Inc.; sending region is distinct from US data storage; currently 30-day email/log retention on Free and up to 90 days for remaining customer data after termination. Review this field when the plan or supplier policy changes.
- [Google contracting entity](https://cloud.google.com/terms/google-entity): the standard mapping for a Polish billing address is Google Cloud Poland sp. z o.o. The notice names the confirmed Workspace/Gmail service without assuming the owner's contracting entity or configured data-region restrictions; check the actual invoice/agreement for that detail.
- [Google Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum) and [Workspace subprocessors](https://workspace.google.com/terms/subprocessors/): processing locations and transfer provisions; an EU business address alone is not an EU-only data-location setting.
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [subprocessors](https://www.cloudflare.com/cloudflare-subprocessors/) and [R2 jurisdictions](https://developers.cloudflare.com/r2/reference/data-location/): EU backup-object jurisdiction does not establish EU-only processing of every category of supplier metadata.
- [Hetzner privacy information](https://www.hetzner.com/legal/privacy-policy/) identifies Hetzner Online GmbH. Server location comes from the owner's account details.
- [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), especially Articles 6, 12–13 and 15–22; [Polish electronic-services act](https://eli.gov.pl/api/acts/DU/2024/1513/text.html), especially Articles 5–8, alongside [the 2026 amendment](https://eli.gov.pl/eli/DU/2026/1296/ogl).

This is a factual drafting update, not a legal-compliance certification. Supplier contracts and operational controls must match the published notice.

## Verification

Tests cover literal substitution, unsafe/nested values, legacy tokens, blank/unknown fields, resolved previews, stale-edit preservation, shared revisions, forced draft status after clearing values, concurrent updates, resolved metadata, the one-time upgrade and preservation on repeated migrations. The full existing account, enquiry, mail and recovery suite remains enabled.
