import { z } from "zod";
export const retentionDays = z.number().int().min(30).max(3650);
export const retentionPreviewSchema = z.object({
  days: retentionDays,
  version: z.number().int().positive(),
});
export const retentionUpdateSchema = retentionPreviewSchema
  .extend({
    enabled: z.boolean(),
    previewToken: z.string().max(2000).optional(),
    acknowledged: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && (!value.previewToken || !value.acknowledged))
      ctx.addIssue({
        code: "custom",
        path: ["previewToken"],
        message:
          "Preview the affected enquiries and acknowledge automatic deletion before enabling cleanup.",
      });
  });
export type RetentionPolicy = {
  enabled: boolean;
  days: number;
  version: number;
  lastCleanupAt: string | null;
  lastDeletedCount: number;
};
export type RetentionPreview = {
  count: number;
  cutoff: string;
  token: string;
  samples: Array<{
    id: string;
    name: string;
    email: string;
    last_activity: string;
  }>;
};
