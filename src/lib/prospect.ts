import { z } from "zod";

export const replyDraftLimit = 4000;
export const prospectResultSchema = z
  .object({
    method: z.literal("rules-v1"),
    brief: z.string().trim().min(1).max(3000),
    discoveryQuestions: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(6),
    nextAction: z.string().trim().min(1).max(500),
    replyDraft: z.string().trim().min(1).max(replyDraftLimit),
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
export const replyDraftUpdateSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Enter a reply before saving.")
      .max(replyDraftLimit)
      .refine(
        (value) => !value.includes("\0"),
        "Remove the null character from the reply.",
      ),
    ready: z.boolean(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type ReplyReview = {
  text: string | null;
  ready: boolean;
  version: number;
};
export type ProspectJob = {
  status: string;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
  result: ProspectResult | null;
  review: ReplyReview;
};
export const prospectStatusLabels: Record<string, string> = {
  pending: "Waiting for n8n",
  running: "Processing in n8n",
  completed: "Brief prepared",
  failed: "Processing stopped after five attempts",
  cancelled: "Cancelled when the enquiry was closed",
};
