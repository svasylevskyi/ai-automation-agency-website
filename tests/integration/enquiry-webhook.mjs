import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { db } from "../../src/server/db.ts";

export async function listenForEnquiryWebhooks() {
  const url = process.env.N8N_ENQUIRY_WEBHOOK_URL;
  if (!url) return;
  assert.equal(
    url,
    "http://127.0.0.1:45679/test-enquiry",
    "Use the local test webhook",
  );
  const received = [];
  const errors = [];
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/test-enquiry");
      assert.equal(request.headers["content-type"], "application/json");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      const {
        rows: [row],
      } = await db().query("SELECT * FROM enquiries WHERE id=$1", [body.id]);
      assert.ok(
        row,
        "The enquiry must already be committed when the webhook arrives",
      );
      assert.deepEqual(body, {
        id: row.id,
        createdAt: row.created_at.toISOString(),
        name: row.name,
        email: row.email,
        company: row.company,
        area: row.area,
        teamSize: row.team_size,
        message: row.message,
        assessment: row.assessment,
        privacyAcknowledged: true,
        privacyNoticeVersion: row.privacy_notice_version,
      });
      received.push(body.email);
      // Exercise a failed delivery and a redirect which must never forward the payload.
      if (body.email === "visitor@example.test")
        response.writeHead(307, { Location: "/redirected" });
      else
        response.writeHead(body.email === "assessed@example.test" ? 503 : 204);
    } catch (error) {
      errors.push(error);
      response.writeHead(500);
    } finally {
      response.end();
    }
  });
  server.listen(45679, "127.0.0.1");
  await once(server, "listening");
  return {
    async check() {
      const expected = [
        "visitor@example.test",
        "followup@example.test",
        "assessed@example.test",
        ...Array.from({ length: 5 }, (_, i) => `limit${i}@example.test`),
      ].sort();
      for (
        let i = 0;
        i < 100 && received.length < expected.length && !errors.length;
        i++
      )
        await delay(50);
      if (errors.length) throw errors[0];
      assert.deepEqual(received.sort(), expected);
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
