import assert from "node:assert/strict";
import { issueChallenge } from "../../src/server/spam.ts";

export async function checkServiceEnquiry({ call, status, db }) {
  const path = "/enquiry-follow-up-automation";
  const page = await call(path);
  status(page, 200);
  const html = await page.text();
  assert.match(
    html,
    /Enquiry &amp; Sales Follow-Up Automation \| Get Automated/,
  );
  assert.match(
    html,
    new RegExp(`rel="canonical" href="${process.env.APP_URL}${path}"`),
  );
  assert.match(html, /name="robots" content="noindex/);
  assert.match(html, /Illustrative demonstration/);
  assert.match(html, /Fictional example/);
  assert.match(html, /AI draft · Awaiting human review/);
  assert.match(
    await (await call("/")).text(),
    /href="\/enquiry-follow-up-automation"/,
  );
  for (const [route, email, area] of [
    ["enquiry-process review", "process-review@example.test", "sales"],
    ["custom automation", "custom-automation@example.test", "other"],
  ]) {
    await db().query("DELETE FROM request_limits");
    const enquiry = {
      name: "Service Test Visitor",
      email,
      company: "Example Studio",
      area,
      teamSize: "small",
      message: "Enquiries arrive through email. Help us organise follow-ups.",
      enquiryRoute: route,
      businessWebsite: "https://example.test/business",
      currentTools: "HubSpot & Google Sheets <script>unsafe()</script>",
      privacyAcknowledged: true,
      website: "",
      token: issueChallenge(Date.now() - 3000),
    };
    const response = await call("/api/enquiries", "POST", enquiry);
    status(response, 201);
    assert.match(
      (await response.json()).message,
      /Thanks—your enquiry has been received/,
    );
    status(await call("/api/enquiries", "POST", enquiry), 201);
    const { rows } = await db().query(
      "SELECT * FROM enquiries WHERE email=$1",
      [email],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].enquiry_route, route);
    assert.equal(rows[0].business_website, enquiry.businessWebsite);
    assert.equal(rows[0].current_tools, enquiry.currentTools);
    const admin = await call(
      `/admin/enquiries/${rows[0].id}`,
      "GET",
      undefined,
      true,
    );
    status(admin, 200);
    const detail = await admin.text();
    assert.match(detail, /Enquiry route/);
    assert.match(
      detail,
      route === "custom automation"
        ? /Custom automation/
        : /Enquiry-process review/,
    );
    assert.match(detail, /https:\/\/example.test\/business/);
    assert.match(detail, /HubSpot &amp; Google Sheets &lt;script&gt;/);
    assert.doesNotMatch(detail, /<script>unsafe/);
    status(await call(`/admin/enquiries/${rows[0].id}`), 307);
    // The polling API returns this same saved context without contact details.
    await db().query(
      "UPDATE prospect_jobs SET created_at='2000-01-01' WHERE enquiry_id=$1",
      [rows[0].id],
    );
    const claim = await fetch(
      process.env.APP_URL + "/api/automation/prospects/claim",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PROSPECT_AUTOMATION_TOKEN}`,
        },
        body: "{}",
      },
    );
    status(claim, 200);
    const { job } = await claim.json();
    assert.equal(job.enquiry.enquiryRoute, route);
    assert.equal(job.enquiry.businessWebsite, enquiry.businessWebsite);
    assert.equal(job.enquiry.currentTools, enquiry.currentTools);
    assert.equal(job.enquiry.email, undefined);
    assert.equal(job.enquiry.name, undefined);
    // Leave no pending mail/job work for later tests, while retaining the submitted rows for webhook verification.
    await db().query(
      "UPDATE prospect_jobs SET status='cancelled',claim_token=NULL,lease_until=NULL WHERE enquiry_id=$1",
      [rows[0].id],
    );
  }
  await db().query("DELETE FROM request_limits");
}
