import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { prepareProspect } from "./prospect-rules.mjs";

export function buildWorkflow() {
  const node = (name, type, typeVersion, x, parameters, extra = {}) => ({
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    type: `n8n-nodes-base.${type}`,
    typeVersion,
    position: [x, 300],
    parameters,
    ...extra,
  });
  const http = {
    method: "POST",
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendBody: true,
    specifyBody: "json",
    options: {
      timeout: 20000,
      redirect: { redirect: { followRedirects: false } },
    },
  };
  return {
    name: "Agency — prepare prospect brief",
    active: false,
    nodes: [
      node("Every minute", "scheduleTrigger", 1.2, 0, {
        rule: { interval: [{ field: "minutes", minutesInterval: 1 }] },
      }),
      { ...node("Manual test", "manualTrigger", 1, 0, {}), position: [0, 100] },
      node("Website configuration", "set", 3.4, 240, {
        assignments: {
          assignments: [
            {
              id: "website-url",
              name: "websiteUrl",
              value: "https://ai-automation-studio.duckdns.org",
              type: "string",
            },
          ],
        },
        options: {},
      }),
      node("Claim one enquiry", "httpRequest", 4.2, 480, {
        ...http,
        url: "={{ $('Website configuration').first().json.websiteUrl + '/api/automation/prospects/claim' }}",
        jsonBody: "={}",
      }),
      node("Prepare brief and draft", "code", 2, 720, {
        jsCode:
          prepareProspect.toString() +
          "\n\nconst job = $input.first().json.job;\nreturn job ? [{ json: prepareProspect(job) }] : [];\n",
      }),
      node(
        "Return for owner review",
        "httpRequest",
        4.2,
        960,
        {
          ...http,
          url: "={{ $('Website configuration').first().json.websiteUrl + '/api/automation/prospects/complete' }}",
          jsonBody: "={{ JSON.stringify($json) }}",
        },
        { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 },
      ),
    ],
    connections: Object.fromEntries(
      [
        ["Every minute", "Website configuration"],
        ["Manual test", "Website configuration"],
        ["Website configuration", "Claim one enquiry"],
        ["Claim one enquiry", "Prepare brief and draft"],
        ["Prepare brief and draft", "Return for owner review"],
      ].map(([from, to]) => [
        from,
        { main: [[{ node: to, type: "main", index: 0 }]] },
      ]),
    ),
    settings: {
      executionOrder: "v1",
      timezone: "Europe/Warsaw",
      executionTimeout: 60,
      saveDataErrorExecution: "none",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      saveExecutionProgress: false,
    },
    pinData: {},
    tags: [],
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  writeFileSync(
    new URL("./prospect-assistant.n8n.json", import.meta.url),
    JSON.stringify(buildWorkflow(), null, 2) + "\n",
  );
