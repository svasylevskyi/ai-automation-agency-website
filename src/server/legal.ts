import { cache } from "react";
import { db } from "./db";
import type { LegalPage, LegalSlug } from "@/lib/legal";

export const getLegalPage = cache(
  async (slug: LegalSlug): Promise<LegalPage> => {
    const { rows } = await db().query(
      "SELECT slug,title,content,is_draft,version,updated_at FROM legal_pages WHERE slug=$1",
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
    };
  },
);
