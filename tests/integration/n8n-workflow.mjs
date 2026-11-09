// Optional real-runtime test. Install n8n separately, then set N8N_BINARY to its
// executable. Uses a temporary SQLite profile and a synthetic, authenticated API.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prospectCompletionSchema } from "../../src/lib/prospect.ts";

if (!process.env.N8N_BINARY)
  throw new Error("Set N8N_BINARY to a separately installed n8n executable.");
const directory = await mkdtemp(join(tmpdir(), "agency-n8n-"));
const token = randomBytes(48).toString("base64url");
const job = {
  jobId: randomUUID(),
  claimToken: randomUUID(),
  enquiry: {
    company: "Synthetic fixture",
    area: "other",
    teamSize: "small",
    message: "A recurring task",
    assessment: null,
  },
};
let claims = 0,
  completions = 0;
const errors = [];
const server = createServer(async (request, response) => {
  try {
    assert.equal(request.method, "POST");
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/automation/prospects/claim") {
      assert.deepEqual(input, {});
      response.end(JSON.stringify({ job: ++claims === 1 ? job : null }));
    } else {
      assert.equal(request.url, "/api/automation/prospects/complete");
      prospectCompletionSchema.parse(input);
      assert.equal(input.jobId, job.jobId);
      assert.equal(input.claimToken, job.claimToken);
      completions++;
      response.end('{"accepted":true}');
    }
  } catch (error) {
    errors.push(error);
    response.statusCode = 500;
    response.end('{"error":"Test contract failed"}');
  }
});
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const workflow = JSON.parse(
    await readFile(
      new URL("../../automation/prospect-assistant.n8n.json", import.meta.url),
      "utf8",
    ),
  );
  workflow.id = "agencyProspectTest";
  workflow.nodes.find(
    (node) => node.name === "Website configuration",
  ).parameters.assignments.assignments[0].value =
    `http://127.0.0.1:${server.address().port}`;
  for (const node of workflow.nodes.filter((node) =>
    node.type.endsWith("httpRequest"),
  ))
    node.credentials = {
      httpHeaderAuth: { id: "agencyProspectAuth", name: "Synthetic worker" },
    };
  await writeFile(join(directory, "workflow.json"), JSON.stringify(workflow), {
    mode: 0o600,
  });
  await writeFile(
    join(directory, "credentials.json"),
    JSON.stringify([
      {
        id: "agencyProspectAuth",
        name: "Synthetic worker",
        type: "httpHeaderAuth",
        data: { name: "Authorization", value: `Bearer ${token}` },
      },
    ]),
    { mode: 0o600 },
  );
  const env = {
    ...process.env,
    N8N_USER_FOLDER: directory,
    N8N_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_VERSION_NOTIFICATIONS_ENABLED: "false",
    N8N_RUNNERS_MODE: "internal",
    N8N_LOG_LEVEL: "error",
    EXECUTIONS_DATA_SAVE_ON_SUCCESS: "none",
    EXECUTIONS_DATA_SAVE_ON_ERROR: "none",
  };
  const run = async (args) =>
    promisify(execFile)(process.env.N8N_BINARY, args, {
      env,
      timeout: 90000,
      maxBuffer: 4 * 1024 * 1024,
    });
  await run([
    "import:credentials",
    `--input=${join(directory, "credentials.json")}`,
  ]);
  await run(["import:workflow", `--input=${join(directory, "workflow.json")}`]);
  await run(["execute", "--id=agencyProspectTest"]);
  await run(["execute", "--id=agencyProspectTest"]);
  assert.deepEqual(errors, []);
  assert.equal(claims, 2);
  assert.equal(completions, 1);
  console.log(
    "Real n8n import/execution passed: authenticated claim, validated result callback, and empty-queue stop.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
