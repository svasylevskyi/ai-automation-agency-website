import { z } from "zod";
import { areas, teamSizes, getRecommendation } from "./planner";

export const frequencies = {
  daily: "Every day",
  weekly: "Every week",
  occasionally: "Occasionally",
  unsure: "Not sure yet",
} as const;
export const difficulties = {
  copying: "Copying information between tools",
  chasing: "Chasing updates or replies",
  finding: "Finding the right information",
  errors: "Checking or correcting mistakes",
  unsure: "Something else / not sure yet",
} as const;
export const goals = {
  time: "Less manual work",
  speed: "Faster responses or turnaround",
  accuracy: "Fewer errors",
  knowledge: "Easier access to information",
  unsure: "Help choosing a useful improvement",
} as const;
export const timings = {
  exploring: "Just exploring",
  soon: "I’d like to start soon",
  quarter: "Within the next three months",
  unsure: "Not sure yet",
} as const;

export const assessmentSchema = z.object({
  version: z.literal(1),
  area: z.enum(["sales", "operations", "support", "other"]),
  teamSize: z.enum(["small", "mid", "large"]),
  workflowDescription: z.string().trim().max(1000).default(""),
  tools: z.string().trim().max(300).default(""),
  frequency: z.enum(["daily", "weekly", "occasionally", "unsure"]),
  difficulty: z.enum(["copying", "chasing", "finding", "errors", "unsure"]),
  goal: z.enum(["time", "speed", "accuracy", "knowledge", "unsure"]),
  timing: z.enum(["exploring", "soon", "quarter", "unsure"]),
});
export type AssessmentAnswers = z.infer<typeof assessmentSchema>;

const titles = {
  sales: "Suggested first project: enquiry intake and follow-up",
  operations: "Suggested first project: one document or reporting workflow",
  support: "Suggested first project: answers from approved knowledge",
  other: "Start with a focused workflow review",
} as const;
const measures = {
  time: "Record the manual steps and time spent today so a small pilot can be compared with the current process.",
  speed:
    "Record the current turnaround time and agree where human approval must remain before testing a faster flow.",
  accuracy:
    "Collect examples of common mistakes and agree how a person will check uncertain results.",
  knowledge:
    "Choose a small set of trusted information sources and confirm who can access them and keep them current.",
  unsure:
    "Agree on one useful outcome and how to measure it before deciding whether to build anything.",
} as const;
const checks = {
  copying:
    "Check available integrations and access permissions before proposing connections between tools.",
  chasing:
    "Agree who owns each handover and when reminders or drafts should need approval.",
  finding:
    "Check that the source information is current, approved and accessible to the right people.",
  errors:
    "Collect a few typical inputs and exceptions, and define a human review step.",
  unsure:
    "Walk through a few real examples to identify the bottleneck and any exceptions.",
} as const;

// Both the browser and server derive the same recommendation from bounded answers.
// Free text is context for the owner, never interpreted as integration capability.
export function recommendAssessment(answers: AssessmentAnswers) {
  return {
    title: titles[answers.area],
    detail: getRecommendation(answers.area, answers.teamSize).detail,
    firstStep: measures[answers.goal],
    prerequisite: checks[answers.difficulty],
    workload:
      answers.frequency === "occasionally"
        ? "For an occasional task, compare the effort to automate it with a simpler checklist or template first."
        : answers.frequency === "unsure"
          ? "Observe how often the task occurs before choosing a pilot."
          : "Use a small sample of recent work to establish the starting point before a pilot.",
  };
}
export type AssessmentRecommendation = ReturnType<typeof recommendAssessment>;
export type SavedAssessment = AssessmentAnswers & {
  recommendation: AssessmentRecommendation;
};

export function assessmentFacts(answers: AssessmentAnswers) {
  return [
    ["Workflow", areas[answers.area]],
    ["Team", teamSizes[answers.teamSize]],
    ["Task description", answers.workflowDescription || "Not supplied"],
    ["Current tools", answers.tools || "Not supplied / not sure yet"],
    ["Frequency", frequencies[answers.frequency]],
    ["Main difficulty", difficulties[answers.difficulty]],
    ["Desired outcome", goals[answers.goal]],
    ["Timing", timings[answers.timing]],
  ];
}
