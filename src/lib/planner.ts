export const areas = {
  sales: "Sales and enquiries",
  operations: "Documents and operations",
  support: "Knowledge and support",
} as const;
export type Area = keyof typeof areas;
export type TeamSize = "small" | "mid" | "large";

const recommendations: Record<Area, string> = {
  sales:
    "Map one enquiry-to-response workflow, confirm CRM access, and agree how a person will approve drafts.",
  operations:
    "Choose one recurring document or reporting workflow, collect sample inputs, and define how exceptions will be reviewed.",
  support:
    "Identify one repeatable question category, review the approved knowledge sources, and agree escalation rules.",
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
