export const workflows = {
  sales: {
    title: "From enquiry to a prepared response.",
    intro:
      "An example for a service business receiving enquiries through its website.",
    steps: [
      ["Capture the enquiry", "Bring the request into one place."],
      ["Add the useful context", "Match company and CRM information."],
      ["Prepare a response", "Draft a relevant next step for your team."],
      ["Review, then send", "A person approves the external response."],
    ],
    note: "Your team owns the decision. Unclear requests go to a person, with the original context attached.",
  },
  operations: {
    title: "From document to organised work.",
    intro:
      "An example for a team handling recurring supplier or project documents.",
    steps: [
      ["Receive the document", "Collect an approved document type."],
      ["Extract the essentials", "Prepare structured fields for checking."],
      [
        "Flag anything uncertain",
        "Route missing or conflicting details for review.",
      ],
      [
        "Update the right system",
        "Approved information reaches the project record.",
      ],
    ],
    note: "Exceptions stay visible. Source documents and human checks remain part of the workflow.",
  },
  support: {
    title: "From question to a grounded draft.",
    intro:
      "An example for a team answering recurring customer or internal questions.",
    steps: [
      ["Understand the question", "Identify the topic and required context."],
      ["Find approved knowledge", "Retrieve relevant internal guidance."],
      ["Prepare a grounded answer", "Draft a response with source references."],
      [
        "Review or escalate",
        "Your team handles ambiguity and sensitive requests.",
      ],
    ],
    note: "Knowledge stays bounded. Missing evidence triggers an escalation instead of a guessed answer.",
  },
} as const;
export type Workflow = keyof typeof workflows;
