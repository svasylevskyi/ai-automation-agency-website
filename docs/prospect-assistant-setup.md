# Prospect assistant: website → n8n → owner review

This slice prepares an internal brief, discovery questions, a suggested next action and a reply draft. The website remains the record of enquiries. n8n checks for one queued enquiry every minute and returns its result to the existing admin detail page.

The supplied workflow uses transparent rules, including a generic discovery route for **Other**. It does not use an LLM, research companies, send mail, qualify/reject customers, quote prices, or change enquiry status/notes/follow-up dates. Review and adapt the draft before replying yourself. Existing website receipts and owner notifications continue through Mailpit.

## 1. Merge and deploy

Merge the PR, then run **Deploy website to Hetzner** from `main`, as before. Migration `006` adds the queue and activity kinds. The feature is disabled by default; deployment needs no new secrets or running n8n instance. Existing enquiries are not automatically queued.

Pull the merged `main` branch into your Windows checkout for the `automation/` files. The website release does not install n8n or import the workflow.

## 2. Start n8n, or use your existing instance

**Already have n8n?** Use that instance and skip the local startup. Both n8n Cloud and self-hosted n8n can make the outbound HTTPS calls. Keep the workflow private. The export was tested with **n8n 2.46.6**, the stable version checked on 6 November 2026.

**For this synthetic-data pilot, Windows needs no Docker or additional server.** The website stays on Hetzner; n8n runs while your computer and terminal are on. No inbound webhook, public n8n address or port forwarding is needed. Permanent hosting can follow after validating the process.

With Node.js 24 installed, run from PowerShell in the repository root:

```powershell
node --version
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\automation\start-local-n8n.ps1
```

The policy override applies only to this process. The script uses pinned n8n 2.46.6, listens only on loopback, disables execution-payload saving and stores its separate test profile in `%LOCALAPPDATA%\AgencyProspectN8n`. The initial download can take several minutes. Open **http://localhost:5678**, create your local n8n owner account and use a strong password. No LLM subscription, Resend account or new domain is required.

Keep the terminal open. Stop with Ctrl+C; restart with the same script to preserve the account, credentials and workflow. Do not run two instances against this profile. npm installation is suitable for this pinned 2.x pilot; n8n documents its deprecation from 3.0, so this is not the permanent production hosting plan.

## 3. Configure a dedicated worker token

In a **second Windows PowerShell window**, generate a new 32-byte token:

```powershell
$tokenBytes = New-Object byte[] 32
$tokenGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$tokenGenerator.GetBytes($tokenBytes)
([BitConverter]::ToString($tokenBytes)).Replace('-', '').ToLowerInvariant() | Set-Clipboard
$tokenGenerator.Dispose()
Remove-Variable tokenBytes, tokenGenerator
```

The token is on your clipboard. Save it in your password manager, then paste that same value into the website environment and n8n credential below. Do not reuse other passwords/secrets or put the token in Git, a URL, screenshot or chat message.

Connect to the server from PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\agency_admin" root@2.31.126.173
```

In the **server SSH session**:

```bash
nano /etc/agency/site.env
```

Add these lines, replacing the placeholder with your generated token. Preserve existing database, Mailpit and other settings.

```dotenv
PROSPECT_AUTOMATION_ENABLED=true
PROSPECT_AUTOMATION_TOKEN=PASTE_THE_GENERATED_TOKEN_HERE
```

Then, in the same SSH session:

```bash
systemctl restart agency-web.service
systemctl is-active agency-web.service
curl --fail --silent https://ai-automation-studio.duckdns.org/api/health
```

Expect `active` and healthy JSON. If restart fails, check the token is one 64-character hexadecimal value with no spaces. Never share `site.env`. New enquiries now queue even while n8n is stopped. For earlier enquiries, use **Prepare brief in n8n** on their admin detail page.

## 4. Import and connect the workflow

1. In n8n, import **`automation/prospect-assistant.n8n.json`** from file. It imports inactive/unpublished and contains no credentials.
2. Open **Website configuration**. `websiteUrl` is already `https://ai-automation-studio.duckdns.org`. Use an origin without a trailing slash; change it only when moving environments/domains.
3. Create a **Header Auth** credential named **Agency prospect worker**. Header name: `Authorization`. Value: `Bearer YOUR_TOKEN` — exactly one space after `Bearer`.
4. In both **Claim one enquiry** and **Return for owner review**, select this credential under **Generic Credential Type → Header Auth**. Both nodes need it. No credentials belong in the Code or configuration nodes.
5. Verify imported workflow settings: timezone **Europe/Warsaw**, timeout **60 seconds**, successful/failed execution payloads **Do not save**, manual execution saving **off**, execution progress saving **off**. Do not pin enquiry data.
6. Save. Use **Execute workflow** / **Manual test** initially; publish/activate the schedule after the first successful round trip.

An empty queue stops successfully before the callback node. Prospect text is treated as data; it cannot change the HTTP destination or authentication. The workflow has no email nodes.

## 5. Run the smoke test

Use synthetic details and an `example.test` email address; this environment still uses Mailpit.

1. Submit an **Other** enquiry with a short recurring-task description, optionally attaching the guided assessment.
2. Confirm admin saved it and Mailpit received the usual emails. **Prospect assistant** should show **Waiting for n8n**.
3. Execute n8n once. Refresh the enquiry. Expect **Draft ready for review**, the brief/questions/next action/draft and one preparation activity entry.
4. Confirm your notes, status and follow-up date are unchanged. Copy and review the draft; replace `[Your name]` before any real use. Do not send this synthetic draft.
5. Execute again with no work waiting. No duplicate result, activity or extra email should appear.
6. Publish/activate the workflow. Submit another synthetic enquiry; its draft normally appears after the next one-minute poll. One job is handled per execution.
7. Stop/deactivate n8n, submit an enquiry, then restart/reactivate it. The saved enquiry and waiting job should process after it resumes.

For a local website, run `npm run db:migrate`, put the two settings in `.env.local`, restart the website and set n8n's origin to `http://localhost:3000`. Use different local/Hetzner tokens and only one intended workflow per environment.

## Reliability and data lifecycle

- The queue entry and enquiry are saved in one transaction. Duplicate form submissions create one enquiry/job. n8n downtime does not lose submissions.
- Concurrent workers lease each job to one execution for ten minutes. Interrupted work retries after expiry, up to five attempts. Admin then offers **Retry preparation**; fix the cause first. Offline waiting does not consume attempts.
- Late results from expired/replaced attempts are rejected. Duplicate completion of an accepted lease acknowledges success without overwriting the first result or repeating activity. Completed drafts are not regenerated in this slice.
- Closing cancels pending/in-progress/failed work. Reopening requires an explicit new request. Completed briefs remain attached. Deleting an enquiry, including automatic retention cleanup, deletes its job/result; callbacks cannot recreate it.
- The worker token only claims work and returns bounded results. It cannot log in as owner, edit settings/notes, delete enquiries or send emails. Structured contact name/email, private notes and mail payloads are omitted. Free-text intake can still contain personal information.
- Execution saving is disabled, but active runs temporarily hold data and manual testing displays it in your browser. Logging, pinning, exports or backups may create extra copies. Pruning excludes running/waiting/annotated executions; this workflow has no Wait node. Use synthetic data until privacy/provider arrangements are finalized.
- Website PostgreSQL/R2 backups include jobs and briefs. They **do not** cover the separate n8n database/profile/key. For this disposable pilot, recreate n8n from the Git workflow and your password-manager credential. To preserve a local profile, stop n8n and encrypt/back up the entire `%LOCALAPPDATA%\AgencyProspectN8n` directory, including `.n8n/config`; never commit it. After website recovery, pause automation and review restored jobs before resuming.

## Pause, rotation and troubleshooting

To pause, set `PROSPECT_AUTOMATION_ENABLED=false` in `site.env`, restart `agency-web.service` and deactivate n8n. Enquiries still work, existing results remain, new jobs are not added and worker calls receive `503`. Missed enquiries can be queued explicitly after re-enabling.

To rotate, pause both sides, generate a fresh token, update the website environment and n8n Header Auth credential, restart with the feature enabled, test and republish.

| Symptom | Check |
| --- | --- |
| `401` | Matching token, `Bearer ` prefix and credential selected on both HTTP nodes. |
| `503` | Feature enabled, website restarted and health endpoint healthy. |
| Waiting indefinitely | n8n running, workflow published/active, correct website origin, no authentication errors. |
| Running after interruption | Ten-minute lease must expire before a later poll retries. |
| `409` on result | Lease expired/replaced or enquiry closed. Refresh admin; discard the stale result. |
| `410` on result | Enquiry deleted. Discard the execution; do not recreate the enquiry. |
| `400` on result | Restore supplied Code node/schema; fields must be valid and bounded. |
| No execution history | Payload saving is off. Reproduce manually with synthetic data instead of broadly logging real enquiries. |

## Before always-on use

Move the same workflow to reliable existing n8n hosting, n8n Cloud or an isolated Hetzner instance. A Windows terminal is a pilot. For self-hosting, use a supported pinned release, PostgreSQL, protected HTTPS editor access, restart/resource limits and n8n's production task-runner guidance. Back up the n8n database and encryption key separately and verify an isolated restore; the website's R2 job does not cover them. Recreate credentials instead of exporting plaintext secrets.

Add failure/stale-queue monitoring, check representative examples and finalize privacy/retention arrangements before a monitored real-data pilot. AI drafting, mailbox/calendar integration, approved sending and automated follow-up are later slices. Resend migration is independent of this preparation workflow.

## Developer verification

`npm run check` covers rules, schema, reproducible workflow export and build. CI also checks authenticated APIs, atomic enqueue/deduplication, concurrent claims, expired leases, retries, idempotency, safe rendering, closure and deletion against PostgreSQL and the production server. Existing mail/retention/recovery tests remain enabled.

Regenerate the export after changing the rules/builder:

```bash
node automation/build-prospect-workflow.mjs
```

Optional real-runtime smoke test, with n8n installed separately:

```bash
N8N_BINARY=/path/to/n8n node --import tsx tests/integration/n8n-workflow.mjs
```

It imports the real workflow/temporary credentials into an isolated profile, exercises authenticated requests against a synthetic HTTP API, checks the result and empty-queue path, then deletes the profile. n8n is not a website dependency.

Official references: [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger), [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest), [npm installation](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-npm.md), [execution-data controls](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/executions.md).
