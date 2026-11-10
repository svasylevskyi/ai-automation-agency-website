# Enquiry submission webhook

Set `N8N_ENQUIRY_WEBHOOK_URL` to the production URL of your n8n Webhook trigger configured for **POST**. On Hetzner, edit `/etc/agency/site.env` and run `sudo systemctl restart agency-web.service`. For local development, use `.env.local` and restart the website. A blank or missing URL disables delivery. Use a URL reachable from the website server. Use HTTPS for a remote receiver.

```dotenv
N8N_ENQUIRY_WEBHOOK_URL=https://n8n.example.com/webhook/YOUR_WEBHOOK_PATH
```

The website commits the enquiry to PostgreSQL, acknowledges the visitor and makes one background POST with `Content-Type: application/json`. Validation failures, honeypot hits, duplicate submissions and existing enquiries produce no event. The URL is server-side. The body contains the submitted business and contact fields, the saved enquiry UUID, its UTC timestamp and the acknowledged privacy notice version. The form challenge, honeypot, admin notes and credentials stay on the website.

The following examples show the JSON body sent over HTTP. In n8n's Webhook trigger output, use `$json.body` for this object and `$json.body.id` for the website's enquiry ID.

## Direct enquiry

```json
{
  "id": "2d34121e-af92-49dd-bfa7-4b5c98259e87",
  "createdAt": "2026-11-10T09:30:00.000Z",
  "name": "Alex Morgan",
  "email": "alex@example.test",
  "company": "Example Studio",
  "area": "operations",
  "teamSize": "small",
  "message": "We copy orders into a spreadsheet every Friday.",
  "assessment": null,
  "privacyNoticeVersion": "enquiry-v4",
  "privacyAcknowledged": true
}
```

## Enquiry with a guided assessment

```json
{
  "id": "c953ab37-6f1d-4a1b-a5ec-41e7da1654c4",
  "createdAt": "2026-11-10T09:35:00.000Z",
  "name": "Alex Morgan",
  "email": "alex@example.test",
  "company": "Example Studio",
  "area": "operations",
  "teamSize": "small",
  "message": "",
  "assessment": {
    "version": 1,
    "area": "operations",
    "teamSize": "small",
    "workflowDescription": "Copy orders into the weekly report",
    "tools": "Shopify and Google Sheets",
    "frequency": "weekly",
    "difficulty": "copying",
    "goal": "time",
    "timing": "soon",
    "recommendation": {
      "title": "Suggested first project: one document or reporting workflow",
      "detail": "Choose one recurring document or reporting workflow, collect sample inputs, and define how exceptions will be reviewed. Define a measurable baseline before proposing a pilot.",
      "firstStep": "Record the manual steps and time spent today so a small pilot can be compared with the current process.",
      "prerequisite": "Check available integrations and access permissions before proposing connections between tools.",
      "workload": "Use a small sample of recent work to establish the starting point before a pilot."
    }
  },
  "privacyNoticeVersion": "enquiry-v4",
  "privacyAcknowledged": true
}
```

Both examples have the same top-level keys. The website trims the enquiry text and lowercases the email. An omitted company is an empty string. A direct enquiry has `assessment: null`; a submitted assessment can accompany an empty message. The nested `recommendation` is computed by the website from the answers.

## Delivery behavior

The website accepts a 2xx response and ignores its body. Configure the receiver to acknowledge promptly. A non-2xx response, network error or five-second timeout is logged against the enquiry ID. The website follows no redirects and makes no automatic retries. An interruption after the database commit can also prevent delivery. Admin and the existing submission emails continue to use the saved enquiry.

The webhook is independent of `PROSPECT_AUTOMATION_ENABLED`. If both the webhook workflow and the scheduled prospect workflow prepare drafts, both can process the same enquiry. This outbound event alone does not write a brief or draft back to admin or set the **Automation processed** label.
