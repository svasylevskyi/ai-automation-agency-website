import assert from "node:assert/strict";
import { test } from "node:test";
import { getRecommendation } from "../src/lib/planner.ts";

test("recommendations match the selected workflow", () => {
  assert.match(getRecommendation("sales", "small").detail, /CRM access/);
  assert.match(
    getRecommendation("operations", "small").detail,
    /document or reporting/,
  );
  assert.match(
    getRecommendation("support", "small").detail,
    /knowledge sources/,
  );
});

test("larger organisations receive sponsor and IT review guidance", () => {
  const result = getRecommendation("sales", "large");
  assert.match(result.title, /departmental/);
  assert.match(result.detail, /operational sponsor.*IT or security/);
});

test("growing teams and medium businesses receive different scoping guidance", () => {
  assert.match(
    getRecommendation("operations", "small").detail,
    /measurable baseline/,
  );
  assert.match(
    getRecommendation("operations", "mid").detail,
    /handovers between teams/,
  );
});
