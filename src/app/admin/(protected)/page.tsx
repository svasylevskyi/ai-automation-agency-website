import { Arrow } from "@/components/arrow";
import Link from "next/link";
import { db } from "@/server/db";
import { requireOwner } from "@/server/owner-page";
import { statuses, statusSchema } from "@/lib/validation";
import { areas } from "@/lib/planner";
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const parsed = statusSchema.safeParse(params.status);
  const filter = parsed.success ? parsed.data : "";
  const requested = Math.min(
    100000,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const counts = await db().query(
    "SELECT status, count(*)::int AS count FROM enquiries GROUP BY status",
  );
  const total = counts.rows.reduce((n, r) => n + r.count, 0);
  const count = filter
    ? (counts.rows.find((r) => r.status === filter)?.count ?? 0)
    : total;
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Math.min(requested, pages);
  const { rows } = await db().query(
    "SELECT id,name,company,area,status,created_at,notification_status FROM enquiries WHERE ($1 = '' OR status=$1) ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $2",
    [filter, (page - 1) * 20],
  );
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Your conversations</div>
          <h1>Enquiry inbox</h1>
          <p>Capture the context. Keep the next step clear.</p>
        </div>
        <span className="inbox-count">
          {total}
          <small>Total enquiries</small>
        </span>
      </div>
      <nav className="filter-bar" aria-label="Filter by enquiry status">
        <Link aria-current={!filter ? "page" : undefined} href="/admin">
          All <span>{total}</span>
        </Link>
        {Object.entries(statuses).map(([key, label]) => (
          <Link
            key={key}
            aria-current={filter === key ? "page" : undefined}
            href={`/admin?status=${key}`}
          >
            {label}{" "}
            <span>{counts.rows.find((r) => r.status === key)?.count ?? 0}</span>
          </Link>
        ))}
      </nav>
      <section className="inbox-list" aria-label="Enquiries">
        {rows.length ? (
          rows.map((row) => (
            <Link
              href={`/admin/enquiries/${row.id}`}
              className="enquiry-row"
              key={row.id}
            >
              <div>
                <strong>{row.name}</strong>
                <span>
                  {row.company || "Independent enquiry"} ·{" "}
                  {areas[row.area as keyof typeof areas]}
                </span>
              </div>
              <div className="row-meta">
                <span className={`status-badge status-${row.status}`}>
                  {statuses[row.status as keyof typeof statuses]}
                </span>
                <time dateTime={row.created_at.toISOString()}>
                  {row.created_at.toLocaleDateString("en-GB", {
                    timeZone: "Europe/Warsaw",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                {row.notification_status !== "sent" && (
                  <small>Notification {row.notification_status}</small>
                )}
              </div>
              <span aria-hidden="true">
                <Arrow />
              </span>
            </Link>
          ))
        ) : (
          <div className="admin-card empty-state">
            <h2>
              {filter
                ? "No enquiries with this status."
                : "Ready for your first conversation."}
            </h2>
            <p>
              {filter
                ? "Choose another filter to see more."
                : "New website enquiries will appear here, ready for your review."}
            </p>
            {!filter && (
              <a href="/#contact" className="text-link">
                Open the enquiry form <Arrow />
              </a>
            )}
          </div>
        )}
      </section>
      <nav className="pagination" aria-label="Inbox pages">
        {page > 1 && (
          <Link href={`/admin?status=${filter}&page=${page - 1}`}>
            ← Previous
          </Link>
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages && (
          <Link href={`/admin?status=${filter}&page=${page + 1}`}>Next →</Link>
        )}
      </nav>
    </>
  );
}
