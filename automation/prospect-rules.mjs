// Pure, bounded preparation. Prospect text is data, never executable instructions.
// Embedded into the importable n8n Code node by build-prospect-workflow.mjs.
export function prepareProspect(job) {
  const e = job.enquiry;
  const a = e.assessment;
  const areas = {
    sales: "Sales and enquiries",
    operations: "Documents and operations",
    support: "Knowledge and support",
    other: "Other / workflow to clarify",
  };
  const teams = {
    small: "Small business or growing team",
    mid: "Medium-sized business",
    large: "Department in a larger organisation",
  };
  const timings = {
    soon: "Would like to start soon",
    quarter: "Within three months",
    exploring: "Just exploring",
    unsure: "Not specified",
  };
  const goals = {
    time: "Less manual work",
    speed: "Faster turnaround",
    accuracy: "Fewer errors",
    knowledge: "Easier access to information",
    unsure: "Needs clarification",
  };
  const frequencies = {
    daily: "Daily",
    weekly: "Weekly",
    occasionally: "Occasional",
    unsure: "Not specified",
  };
  const excerpt = (value, limit) =>
    value.length > limit ? value.slice(0, limit) + "… [excerpt]" : value;
  const questions = [];
  if (!a?.workflowDescription)
    questions.push(
      "Could you walk me through one example of the task, from its trigger to the finished result?",
    );
  if (!a?.tools)
    questions.push(
      "Which tools hold the information today, and who manages access to them?",
    );
  if (!a || a.frequency === "unsure")
    questions.push(
      "How often does this task happen, and roughly how much time does it take?",
    );
  else
    questions.push(
      "Roughly how much time does each occurrence take, and where do delays or errors happen?",
    );
  if (!a || a.goal === "unsure")
    questions.push(
      "What would a useful improvement look like, and how would you measure it?",
    );
  if (!a || a.timing === "unsure")
    questions.push("Is there a target date or event driving this work?");
  questions.push(
    "Does the process involve sensitive information, and which steps must remain under human approval?",
  );
  const actions = {
    sales:
      "Review one enquiry-to-response workflow and confirm who approves drafts before proposing a small pilot.",
    operations:
      "Review one document or reporting workflow, sample inputs and exception handling before proposing a small pilot.",
    support:
      "Review one question category, approved information sources and escalation rules before proposing a small pilot.",
    other:
      "Map one recurring task, its inputs, tools and human decisions. Confirm whether automation would help before recommending a solution.",
  };
  const nextAction =
    actions[e.area] +
    (a?.frequency === "occasionally"
      ? " Compare the benefit with a simpler checklist or template."
      : " Establish the current time or error baseline.");
  const lines = [
    `Workflow: ${areas[e.area]}`,
    `Organisation: ${e.company || "Not supplied"} · ${teams[e.teamSize]}`,
    `Timing reported: ${a ? timings[a.timing] : "Not supplied"}`,
    ...(a
      ? [
          `Frequency: ${frequencies[a.frequency]} · Desired outcome: ${goals[a.goal]}`,
          `Tools reported: ${a.tools || "Not supplied"}`,
          `Task reported: ${a.workflowDescription || "Not supplied"}`,
        ]
      : ["No guided assessment attached; clarify the workflow in discovery."]),
    `Message excerpt (visitor's own words): ${e.message ? excerpt(e.message, 700) : "No additional message"}`,
    "Fit, budget, access permissions and feasibility have not been verified.",
  ];
  return {
    jobId: job.jobId,
    claimToken: job.claimToken,
    result: {
      method: "rules-v1",
      brief: lines.join("\n"),
      discoveryQuestions: questions,
      nextAction,
      replyDraft:
        "Hello,\n\nThank you for sharing your enquiry. To understand whether a small automation would be useful, could you tell me:\n\n" +
        questions
          .slice(0, 3)
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n") +
        "\n\nA general description is enough at this stage; please do not send passwords, access keys or sensitive records.\n\nBest regards,\n[Your name]",
    },
  };
}
