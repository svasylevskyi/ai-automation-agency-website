import { z } from "zod";

export const prospectResultSchema = z
  .object({
    method: z.literal("rules-v1"),
    brief: z.string().trim().min(1).max(3000),
    discoveryQuestions: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(6),
    nextAction: z.string().trim().min(1).max(500),
    replyDraft: z.string().trim().min(1).max(4000),
  })
  .strict();
export const prospectCompletionSchema = z
  .object({
    jobId: z.uuid(),
    claimToken: z.uuid(),
    result: prospectResultSchema,
  })
  .strict();
export type ProspectResult = z.infer<typeof prospectResultSchema>;
export type ProspectJob = {
  status: string;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
  result: ProspectResult | null;
};
export const prospectStatusLabels: Record<string, string> = {
  pending: "Waiting for n8n",
  running: "Processing in n8n",
  completed: "Draft ready for review",
  failed: "Processing stopped after five attempts",
  cancelled: "Cancelled when the enquiry was closed",
};
