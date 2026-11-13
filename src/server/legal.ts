import { cache } from "react";
import { db } from "./db";
import type { LegalPage, LegalSlug } from "@/lib/legal";

export const getLegalPage = cache(
  async (slug: LegalSlug): Promise<LegalPage> => {
    const { rows } = await db().query(
      `SELECT p.*, d.data AS values, d.version AS values_version
       FROM legal_pages p CROSS JOIN legal_details d WHERE p.slug=$1 AND d.singleton`,
      [slug],
    );
    if (!rows.length)
      throw new Error("Run database migrations to initialise the legal pages.");
    const row = rows[0];
    return {
      slug: row.slug,
      title: row.title,
      content: row.content,
      isDraft: row.is_draft,
      version: row.version,
      updatedAt: row.updated_at.toISOString(),
      values: row.values,
      valuesVersion: row.values_version,
    };
  },
);
