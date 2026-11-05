import { settingsUpdateSchema } from "@/lib/validation";
import { db } from "@/server/db";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
  HttpError,
} from "@/server/http";
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const { version, ...settings } = settingsUpdateSchema.parse(
      await readJson(request),
    );
    if (
      settings.logoId &&
      !(
        await db().query("SELECT id FROM brand_assets WHERE id=$1", [
          settings.logoId,
        ])
      ).rowCount
    )
      throw new HttpError(400, "Please upload the logo again.");
    const { rows } = await db().query(
      "UPDATE site_settings SET data=$1,version=version+1,updated_at=now() WHERE singleton=true AND version=$2 RETURNING version",
      [JSON.stringify(settings), version],
    );
    if (!rows.length)
      throw new HttpError(
        409,
        "Settings changed in another window. Reload before saving.",
      );
    return json({ version: rows[0].version });
  } catch (error) {
    return apiError(error);
  }
}
