import { z } from "zod";
import { db } from "@/server/db";
import {
  apiError,
  json,
  sameOrigin,
  requireApiOwner,
  HttpError,
} from "@/server/http";
import { sendConfirmation } from "@/server/mail";
import { rateLimit } from "@/server/spam";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireApiOwner(request);
    const id = z.uuid().parse((await context.params).id);
    await rateLimit(`confirmation:${id}`, 3, 300);
    const { rows } = await db().query(
      "SELECT confirmation_status,confirmation_attempts FROM enquiries WHERE id=$1",
      [id],
    );
    if (!rows.length) throw new HttpError(404, "Enquiry not found.");
    if (rows[0].confirmation_status === "not_required")
      throw new HttpError(
        400,
        "Earlier enquiries are not sent retrospective confirmation emails.",
      );
    if (
      rows[0].confirmation_status !== "sent" &&
      rows[0].confirmation_attempts >= 5
    )
      throw new HttpError(
        409,
        "The five-attempt limit has been reached. Check the address and contact the visitor manually if appropriate.",
      );
    await sendConfirmation(id, true);
    const current = await db().query(
      "SELECT confirmation_status AS status,confirmation_attempts AS attempts FROM enquiries WHERE id=$1",
      [id],
    );
    return json(current.rows[0] ?? { status: "deleted" });
  } catch (error) {
    return apiError(error);
  }
}
