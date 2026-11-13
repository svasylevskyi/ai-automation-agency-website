import type { z } from "zod";
import {
  legalKeys,
  legalUpdateSchema,
  resolveLegalText,
  unresolvedLegalKeys,
  type LegalSlug,
} from "@/lib/legal";
import { transaction } from "./db";
import { HttpError } from "./http";

export async function updateLegalPage(
  slug: LegalSlug,
  input: z.infer<typeof legalUpdateSchema>,
) {
  return transaction(async (client) => {
    // Always lock shared values first, then documents in a stable order.
    const details = (
      await client.query(
        "SELECT * FROM legal_details WHERE singleton FOR UPDATE",
      )
    ).rows[0];
    const pages = (
      await client.query("SELECT * FROM legal_pages ORDER BY slug FOR UPDATE")
    ).rows;
    const page = pages.find((row) => row.slug === slug);
    if (!page || !details) throw new Error("Run legal page migrations first.");
    if (
      page.version !== input.version ||
      details.version !== input.valuesVersion
    )
      throw new HttpError(
        409,
        "This page or its shared details changed in another window. Copy your edits, then reload before saving.",
      );
    const values: Record<string, string> = { ...details.data };
    // A page may only change the fields in its own template. Retain unused
    // saved values so removing/re-adding a token does not erase its value.
    for (const key of legalKeys(input.title + "\n" + input.content))
      values[key] = input.values[key] ?? "";
    const changed = Object.keys(values).some(
      (key) => values[key] !== details.data[key],
    );
    if (Object.keys(values).length > 64)
      throw new HttpError(
        400,
        "The shared details already contain 64 fields. Reuse an existing placeholder.",
      );
    const valuesVersion = details.version + (changed ? 1 : 0);
    if (changed)
      await client.query(
        "UPDATE legal_details SET data=$1,version=$2,updated_at=now() WHERE singleton",
        [JSON.stringify(values), valuesVersion],
      );
    for (const other of pages.filter((row) => row.slug !== slug)) {
      const template = other.title + "\n" + other.content;
      if (
        resolveLegalText(template, details.data) !==
        resolveLegalText(template, values)
      )
        await client.query(
          "UPDATE legal_pages SET version=version+1,updated_at=now(),is_draft=$1 WHERE slug=$2",
          [
            other.is_draft || unresolvedLegalKeys(template, values).length > 0,
            other.slug,
          ],
        );
    }
    const saved = (
      await client.query(
        `UPDATE legal_pages SET title=$1,content=$2,is_draft=$3,version=version+1,updated_at=now()
       WHERE slug=$4 RETURNING version,updated_at`,
        [input.title, input.content, input.isDraft, slug],
      )
    ).rows[0];
    return {
      version: saved.version,
      updatedAt: saved.updated_at.toISOString(),
      values,
      valuesVersion,
    };
  });
}
