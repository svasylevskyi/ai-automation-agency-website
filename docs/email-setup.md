# Live email: Google Workspace + Resend

The website sends two transactional messages for a new enquiry: a private inbox link to the owner, and a generic acknowledgement to the visitor. Resend sends these over HTTPS. Google Workspace hosts the business inbox in Gmail and handles personal correspondence. Replies to acknowledgements go to the **Public email** configured in Owner area → Settings.

Suggested addresses (change them consistently if you prefer different names):

| Purpose | Address | Configuration |
| --- | --- | --- |
| Your primary Gmail mailbox | `stepan@get-automated.ai` | One Google Workspace user |
| Public contact and receipt replies | `hello@get-automated.ai` | Alias of that user; website Public email |
| Owner notifications | `hello@get-automated.ai` | Server `NOTIFICATION_EMAIL` |
| Automated website sender | `website@mail.get-automated.ai` | Resend verified domain `mail.get-automated.ai`; server `MAIL_FROM` |

This release does not import Gmail messages into the owner inbox, send AI drafts automatically, or send emails when a follow-up date arrives. Review drafts and send personal replies from Gmail; update the enquiry status/notes yourself. No Gmail password, app password or OAuth credential is needed by the website.

## 1. Create the business inbox

1. Sign up at [Google Workspace](https://workspace.google.com/) using your existing domain `get-automated.ai`. A single-user **Business Starter** account is sufficient for this setup. Review the current plan and billing terms at signup. Ordinary free Gmail does not host this custom-domain mailbox.
2. Create `stepan@get-automated.ai`, enable two-step verification, and complete domain verification using the exact TXT record supplied by Google's setup wizard. Manage DNS at the provider hosting your domain's authoritative nameservers; do not change nameservers or website A/AAAA/CNAME records for email setup.
3. Once the new mailbox is ready, activate Gmail and set the root-domain MX record. Google's current setup uses host `@`, priority `1`, destination `smtp.google.com` (TTL Auto/default). Follow the wizard if it supplies different instructions. Replace conflicting **root-domain mail routing** records only when ready to move incoming mail. Preserve unrelated/subdomain records. If mail already works with Google's older `ASPMX` MX records, they remain supported.
4. In Admin console → Directory → Users → your user → Alternate emails, add `hello`. An alias shares your primary inbox and does not need another paid user. In Gmail → Settings → Accounts → Send mail as, add/select the alias and complete any verification prompts to send personal replies as `hello@get-automated.ai`.
5. Test receiving at both addresses and sending from Gmail to a separate mailbox you control. Sign in using the primary account, not the alias.

## 2. Authenticate Gmail mail

| DNS record | Name in the `get-automated.ai` zone | Value |
| --- | --- | --- |
| Google verification TXT | Google's supplied name | Exact value from the setup wizard |
| Gmail MX | `@` | `smtp.google.com`, priority `1` |
| Gmail SPF TXT | `@` | `v=spf1 include:_spf.google.com ~all` if Google is the only sender using the root-domain SPF policy |
| Google DKIM TXT | Usually `google._domainkey` | Exact public key generated in Google Admin |

Maintain **one SPF record per hostname**. If one already exists, review its authorised senders and merge the required mechanisms instead of adding another SPF record. The Resend return-path SPF record below belongs to a different hostname.

For DKIM: Admin console → Apps → Google Workspace → Gmail → Authenticate email → select domain → Generate new record (2048-bit) → add the displayed TXT record in DNS → **Start authentication**. Google may require a waiting period after Gmail activation before it can generate the key; follow the message in Admin. Verify a message received in a separate mailbox with Gmail's **Show original** view.

## 3. Configure Resend

1. Create/sign in to [Resend](https://resend.com/). In Domains, add **`mail.get-automated.ai`**. Choose the appropriate available sending region; record the selected region for your operational documentation.
2. Copy all **sending verification** records shown by Resend into DNS. These include DKIM and the SPF/return-path records. The default return-path host for this example is typically `send.mail`, with its own TXT and MX records. Use the exact hostnames, values and priorities Resend supplies; region-specific MX values must not be guessed. Keep Google's `@` MX record. Leave Resend inbound receiving disabled for this setup.
3. Wait for the domain's sending status to become verified. Keep open/click tracking disabled for these transactional messages.
4. Create an API key named `get-automated-website-production`, with **Sending access** restricted to `mail.get-automated.ai`. Store the secret securely. It goes only in the server environment file, never Git, the browser, screenshots or chat.
5. The sender `website@mail.get-automated.ai` does not need a separate Gmail mailbox. Customer replies are routed to the verified working `hello@` alias through Reply-To. Do not use `onboarding@resend.dev` for production.

## 4. Add DMARC after authentication works

After SPF/DKIM have been working for at least 48 hours, create a `dmarc@get-automated.ai` alias and add a TXT record at `_dmarc`:

```text
v=DMARC1; p=none; rua=mailto:dmarc@get-automated.ai
```

This is an initial monitoring policy for the domain and, by default, its subdomains. Review existing DMARC before changing it; do not weaken a working policy. Check reports and authentication for both Gmail and Resend before progressing to `quarantine` or `reject`. Configure a Gmail filter for the reporting alias if helpful.

## 5. Deploy the code, then switch live sending on

First merge the PR and run the existing **Deploy website to Hetzner** workflow, keeping the existing SMTP/Mailpit configuration during this deployment. `MAIL_PROVIDER` defaults to `smtp`, so merely deploying does not enable Resend. No database migration is needed for this change.

In Owner area → Settings, set the agency name to **Get Automated** and **Public email** to `hello@get-automated.ai`. This changes public contact links and the Reply-To saved with **new** receipts. Existing receipt snapshots retain their original wording and Reply-To. The login account address and notification recipient are independent; changing either of these mail settings does not change your admin login.

Review pending/failed messages and remove only known disposable test enquiries through the owner inbox. Eligible old messages can be retried using the new provider; do not enable live delivery with a test backlog you do not intend to send. The read-only preflight below reports counts. Also review the editable Privacy Policy before live use: replace the test-only mail description/provider placeholder with the actual Resend and Google Workspace arrangements, including relevant processing and retention details. This release does not overwrite owner-edited legal pages.

Use a short maintenance window to stop both senders while changing the server file:

```bash
sudo systemctl stop agency-maintenance.timer agency-maintenance.service agency-web.service
sudoedit /etc/agency/site.env
```

Add/update only these mail settings; keep database/auth/automation settings intact:

```dotenv
MAIL_PROVIDER=resend
RESEND_API_KEY=REPLACE_WITH_YOUR_SECRET_SENDING_KEY
MAIL_FROM=website@mail.get-automated.ai
NOTIFICATION_EMAIL=hello@get-automated.ai
```

`MAIL_FROM` is a plain email address, without a display name. It overrides legacy `SMTP_FROM`; if absent, SMTP deployments continue using `SMTP_FROM`. `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` and `SMTP_PASSWORD` are unused by Resend. Both the website and maintenance service read `/etc/agency/site.env`. Keep it owned by `root:agency`, mode `0640`. `APP_URL` must match the actual public website origin so notification links work; change it to `https://get-automated.ai` only when that domain serves this application.

Run the preflight in the deployed release:

```bash
cd /srv/agency/current
sudo -u agency /usr/local/bin/node --env-file=/etc/agency/site.env --import tsx scripts/check-mail.ts
```

The command sends no mail, prints no secrets or enquiry contents, and checks local configuration/database settings only. It cannot prove that the API key or DNS is valid. Correct missing public email/configuration and review any backlog before starting services:

```bash
sudo systemctl start agency-web.service agency-maintenance.timer
sudo systemctl is-active agency-web.service agency-maintenance.timer
```

Allow outbound HTTPS to `api.resend.com:443`. No SMTP port or Google login is needed for Resend. A runtime environment change needs a web-service restart, not a rebuild. The maintenance service reads the file on each run. Keep your local `.env.local` on `MAIL_PROVIDER=smtp` with Mailpit.

## 6. Verify delivery and replies

1. Submit a fresh enquiry from the website using a separate address you control. Try both home and service-page forms when checking the release.
2. Confirm the record is saved in the owner area. The notification should arrive in the business inbox; the acknowledgement should arrive at the submitted address. Neither email should include the visitor's private enquiry text.
3. Reply to the acknowledgement. The reply should arrive at `hello@get-automated.ai` in Gmail. Verify your personal response uses the intended business From address.
4. In Resend's email dashboard, confirm delivery or inspect a bounce. In the received acknowledgement's **Show original**, inspect SPF, DKIM and DMARC results.
5. The owner area records provider **acceptance**, not final inbox delivery/read status. Its activity history includes Resend's message ID for lookup and safe failure codes. Bounce/complaint events are not synchronised into the app; monitor them in Resend.

## Recovery and troubleshooting

- Existing database claims, manual retry actions and the five-minute maintenance timer apply to both providers. Each channel gets up to five automatic attempts. A failed message does not remove the saved enquiry. A successfully accepted message is not sent again by the normal retry action.
- Resend retries use an identical-payload idempotency key. Resend retains keys for **24 hours**. A changed sender, recipient, link or payload intentionally produces a new key; a retry after that window or a provider/configuration switch may duplicate an earlier accepted message. Keep configuration stable while investigating an uncertain send.
- `resend_http_401` / `403`: check the secret key, Sending access/domain restriction, verified sending domain and From address. `422`: inspect request/domain validation in Resend. `429`: check provider rate limits/quota; automatic retries use the existing five-minute backoff. `5xx` or `resend_request_failed`: provider/network/timeout failure; check outbound HTTPS and the provider dashboard before retrying. No raw provider response is copied into app logs.
- New errors leave mail failed for retry, including malformed provider success responses. The application never silently switches to SMTP after a Resend failure.
- `/api/health` checks application/database readiness, not mailbox delivery. `mail:check` is also not an external delivery test.
- To pause real sending for investigation, stop the maintenance timer/service and the web service. To return to Mailpit, configure `MAIL_PROVIDER=smtp` and a reachable Mailpit SMTP host/port, then restart. Never substitute Gmail credentials into Resend settings.

## Official setup references

- [Google Workspace editions](https://knowledge.workspace.google.com/admin/getting-started/editions/choose-your-google-workspace-edition)
- [Google MX setup](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace), [aliases](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias), [SPF](https://knowledge.workspace.google.com/admin/security/set-up-spf), [DKIM](https://knowledge.workspace.google.com/admin/security/set-up-dkim), [DMARC](https://knowledge.workspace.google.com/admin/security/set-up-dmarc)
- [Resend domain verification](https://resend.com/docs/add-a-domain), [API keys](https://resend.com/docs/create-an-api-key), [send API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
