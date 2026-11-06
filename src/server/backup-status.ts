import { readFile } from "node:fs/promises";
import { z } from "zod";
const schema = z.object({
  lastBackupAt: z.iso.datetime().optional(),
  lastCheckpointAt: z.iso.datetime().optional(),
  lastVerifiedAt: z.iso.datetime().optional(),
  lastPrunedAt: z.iso.datetime().optional(),
  failures: z
    .partialRecord(
      z.enum([
        "init",
        "backup",
        "checkpoint",
        "verify",
        "prune",
        "pin",
        "recover",
      ]),
      z.iso.datetime(),
    )
    .optional(),
});
export async function getBackupStatus() {
  try {
    const text = await readFile(
      "/var/lib/agency-backup-status/status.json",
      "utf8",
    );
    if (text.length > 10000) return null;
    return schema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}
