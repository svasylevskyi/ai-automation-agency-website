import Link from "next/link";
import { db } from "@/server/db";
import { describeActivity } from "@/lib/activity";

export async function EnquiryActivity({
  id,
  requestedPage,
}: {
  id: string;
  requestedPage?: string;
}) {
  const total = (
    await db().query(
      "SELECT count(*)::int AS count FROM enquiry_activity WHERE enquiry_id=$1",
      [id],
    )
  ).rows[0].count;
  const pages = Math.max(1, Math.ceil(total / 50));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(requestedPage ?? "1", 10) || 1),
  );
  const { rows } = await db().query(
    "SELECT kind,details,created_at,id FROM enquiry_activity WHERE enquiry_id=$1 ORDER BY id DESC LIMIT 50 OFFSET $2",
    [id, (page - 1) * 50],
  );
  return (
    <section
      className="admin-card activity-card"
      aria-labelledby="activity-title"
      id="activity"
    >
      <h2 id="activity-title">Activity history</h2>
      <p>
        Newest first · Warsaw time. Actions are recorded here; ordinary email
        replies and calls are not tracked automatically.
      </p>
      <ol className="activity-list">
        {rows.map((event) => (
          <li key={event.id}>
            <time dateTime={event.created_at.toISOString()}>
              {event.created_at.toLocaleString("en-GB", {
                timeZone: "Europe/Warsaw",
              })}
            </time>
            <p>{describeActivity(event.kind, event.details)}</p>
          </li>
        ))}
      </ol>
      {!rows.length && <p>No activity recorded yet.</p>}
      {pages > 1 && (
        <nav className="pagination" aria-label="Activity pages">
          {page > 1 && (
            <Link href={`?activityPage=${page - 1}#activity`}>← Newer</Link>
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`?activityPage=${page + 1}#activity`}>Older →</Link>
          )}
        </nav>
      )}
    </section>
  );
}
