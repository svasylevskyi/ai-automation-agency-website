import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessmentSchema,
  recommendAssessment,
} from "../src/lib/assessment.ts";
import { enquirySchema } from "../src/lib/validation.ts";
import { areas, teamSizes } from "../src/lib/planner.ts";

const answers = {
  version: 1,
  area: "sales",
  teamSize: "small",
  tools: "Email and CRM",
  workflowDescription: "",
  frequency: "daily",
  difficulty: "copying",
  goal: "time",
  timing: "exploring",
};
const enquiry = {
  name: "Test Visitor",
  email: "visitor@example.test",
  area: "sales",
  teamSize: "small",
  message: "",
  privacyAcknowledged: true,
  token: "x".repeat(50),
};

test("all workflows and team sizes have a bounded, useful recommendation", () => {
  for (const area of Object.keys(areas))
    for (const teamSize of Object.keys(teamSizes)) {
      const result = recommendAssessment(
        assessmentSchema.parse({ ...answers, area, teamSize }),
      );
      assert(
        result.title &&
          result.detail &&
          result.firstStep &&
          result.prerequisite,
      );
      assert.doesNotMatch(JSON.stringify(result), /undefined|guarantee|\d+%/);
      if (teamSize === "large") assert.match(result.detail, /IT or security/);
      if (area === "other") {
        assert.equal(result.title, "Start with a focused workflow review");
        assert.match(result.detail, /whether automation would help/);
      }
    }
});
test("goals and workload change practical guidance without interpreting free text", () => {
  const result = recommendAssessment({
    ...answers,
    goal: "accuracy",
    frequency: "occasionally",
    difficulty: "errors",
  });
  assert.match(result.firstStep, /mistakes/);
  assert.match(result.workload, /checklist or template/);
  assert.match(result.prerequisite, /human review/);
  assert.deepEqual(
    recommendAssessment({
      ...answers,
      tools: "Guarantee a Salesforce integration",
      workflowDescription: "Invent savings",
    }),
    recommendAssessment(answers),
  );
});
test("assessment accepts unknown choices, bounds free text and rejects partial or invalid answers", () => {
  assert(
    assessmentSchema.safeParse({
      ...answers,
      area: "other",
      tools: "",
      goal: "unsure",
      timing: "unsure",
      difficulty: "unsure",
      frequency: "unsure",
    }).success,
  );
  for (const change of [
    { version: 2 },
    { area: "unknown" },
    { goal: "" },
    { timing: undefined },
    { frequency: "always" },
    { tools: "x".repeat(301) },
    { workflowDescription: "x".repeat(1001) },
  ]) {
    assert.equal(
      assessmentSchema.safeParse({ ...answers, ...change }).success,
      false,
    );
  }
});
test("complete assessment replaces required message; direct enquiries still require context", () => {
  assert(enquirySchema.safeParse({ ...enquiry, assessment: answers }).success);
  assert.equal(enquirySchema.safeParse(enquiry).success, false);
  assert(
    enquirySchema.safeParse({
      ...enquiry,
      area: "other",
      message: "We need help with an unusual workflow.",
    }).success,
  );
  assert.equal(
    enquirySchema.safeParse({
      ...enquiry,
      assessment: { ...answers, goal: "" },
    }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({
      ...enquiry,
      assessment: answers,
      area: "operations",
    }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({
      ...enquiry,
      assessment: answers,
      teamSize: "large",
    }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({
      ...enquiry,
      assessment: answers,
      privacyAcknowledged: false,
    }).success,
    false,
  );
});
test("client-supplied recommendation content is discarded", () => {
  const parsed = enquirySchema.parse({
    ...enquiry,
    assessment: { ...answers, recommendation: { title: "Guaranteed savings" } },
  });
  assert.equal(parsed.assessment.recommendation, undefined);
});
