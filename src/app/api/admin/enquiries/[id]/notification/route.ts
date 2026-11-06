import { z } from "zod";
import { db } from "@/server/db";
import {
  apiError,
  json,
  sameOrigin,
  requireApiOwner,
  HttpError,
} from "@/server/http";
import { sendNotification } from "@/server/mail";
import { rateLimit } from "@/server/spam";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    await rateLimit(`notification:${id}`, 3, 300);
    if (
      !(await db().query("SELECT id FROM enquiries WHERE id=$1", [id])).rowCount
    )
      throw new HttpError(404, "Enquiry not found.");
    await sendNotification(id, true);
    const { rows } = await db().query(
      "SELECT notification_status FROM enquiries WHERE id=$1",
      [id],
    );
    return json({ status: rows[0]?.notification_status });
  } catch (error) {
    return apiError(error);
  }
}
