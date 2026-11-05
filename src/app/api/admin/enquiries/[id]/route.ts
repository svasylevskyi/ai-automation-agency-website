import { z } from "zod";
import { enquiryUpdateSchema } from "@/lib/validation";
import { db } from "@/server/db";
import {
  apiError,
  json,
  readJson,
  sameOrigin,
  requireApiOwner,
  HttpError,
} from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const input = enquiryUpdateSchema.parse(await readJson(request, 45000));
    const { rows } = await db().query(
      "UPDATE enquiries SET status=$1,notes=$2,version=version+1,updated_at=now() WHERE id=$3 AND version=$4 RETURNING version",
      [input.status, input.notes, id, input.version],
    );
    if (!rows.length)
      throw new HttpError(
        409,
        "This enquiry changed or was deleted. Reload before editing again.",
      );
    return json({ version: rows[0].version });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    const { version } = z
      .object({ version: z.number().int().min(1) })
      .parse(await readJson(request));
    const result = await db().query(
      "DELETE FROM enquiries WHERE id=$1 AND version=$2 RETURNING id",
      [id, version],
    );
    if (!result.rowCount)
      throw new HttpError(
        409,
        "This enquiry changed or was deleted. Reload before deleting.",
      );
    return json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
