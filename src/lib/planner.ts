export const areas = {
  sales: "Sales and enquiries",
  operations: "Documents and operations",
  support: "Knowledge and support",
  other: "Other / I’m not sure yet",
} as const;
export type Area = keyof typeof areas;
export type TeamSize = "small" | "mid" | "large";
export const teamSizes = {
  small: "A small business or growing team",
  mid: "An established medium-sized business",
  large: "A department in a larger organisation",
} as const;

const recommendations: Record<Area, string> = {
  sales:
    "Map one enquiry-to-response workflow, confirm CRM access, and agree how a person will approve drafts.",
  operations:
    "Choose one recurring document or reporting workflow, collect sample inputs, and define how exceptions will be reviewed.",
  support:
    "Identify one repeatable question category, review the approved knowledge sources, and agree escalation rules.",
  other:
    "Choose one recurring task and map what triggers it, what information it needs, which tools are involved, and where human judgement matters. Review whether automation would help before choosing a first step.",
};

export function getRecommendation(area: Area, size: TeamSize) {
  return {
    title:
      size === "large"
        ? "Suggested start: a departmental assessment."
        : "Suggested start: one focused workflow assessment.",
    detail:
      recommendations[area] +
      (size === "large"
        ? " Include an operational sponsor and your IT or security reviewer."
        : size === "mid"
          ? " Include the process owner and map handovers between teams before proposing a pilot."
          : " Define a measurable baseline before proposing a pilot."),
  };
}
