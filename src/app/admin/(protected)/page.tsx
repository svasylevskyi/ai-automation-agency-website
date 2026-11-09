import { Arrow } from "@/components/arrow";
import Link from "next/link";
import { db } from "@/server/db";
import { requireOwner } from "@/server/owner-page";
import { statuses, statusSchema } from "@/lib/validation";
import { areas } from "@/lib/planner";
import {
  warsawToday,
  formatFollowUpDate,
  followUpLabel,
} from "@/lib/follow-up";

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; view?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const parsed = statusSchema.safeParse(params.status);
  const attention =
    params.view === "attention" || (params.view !== "all" && !parsed.success);
  const filter = !attention && parsed.success ? parsed.data : "";
  const requested = Math.min(
    100000,
    Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  );
  const today = warsawToday();
  const counts = await db().query(
    "SELECT status,count(*)::int AS count FROM enquiries GROUP BY status",
  );
  const total = counts.rows.reduce((n, r) => n + r.count, 0);
  const attentionCount = (
    await db().query(
      "SELECT count(*)::int AS count FROM enquiries WHERE status<>'closed' AND (status='new' OR follow_up_on <= $1::date)",
      [today],
    )
  ).rows[0].count;
  const count = attention
    ? attentionCount
    : filter
      ? (counts.rows.find((r) => r.status === filter)?.count ?? 0)
      : total;
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Math.min(requested, pages);
  const { rows } = await db().query(
    `SELECT id,name,company,area,status,created_at,notification_status,confirmation_status,next_action,follow_up_on::text AS due_date,
       EXISTS (SELECT 1 FROM prospect_jobs WHERE enquiry_id=enquiries.id AND status='completed') AS automation_processed
     FROM enquiries WHERE ($2='' OR status=$2) AND (NOT $3 OR (status<>'closed' AND (status='new' OR follow_up_on <= $1::date)))
     ORDER BY ${attention ? "follow_up_on ASC NULLS LAST,created_at ASC,id ASC" : "created_at DESC,id DESC"} LIMIT 20 OFFSET $4`,
    [today, filter, attention, (page - 1) * 20],
  );
  const pageHref = (number: number) =>
    `/admin?${new URLSearchParams({ view: attention ? "attention" : "all", status: filter, page: String(number) })}`;
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Your conversations</div>
          <h1>Enquiry inbox</h1>
          <p>
            {attention
              ? "New enquiries and follow-ups due today or overdue. Dates use Warsaw time."
              : "All your conversations, with their current status and next action."}
          </p>
        </div>
        <span className="inbox-count">
          {total}
          <small>Total enquiries</small>
        </span>
      </div>
      <nav className="filter-bar" aria-label="Filter enquiries">
        <Link
          aria-current={attention ? "page" : undefined}
          href="/admin?view=attention"
        >
          Needs attention <span>{attentionCount}</span>
        </Link>
        <Link
          aria-current={!attention && !filter ? "page" : undefined}
          href="/admin?view=all"
        >
          All <span>{total}</span>
        </Link>
        {Object.entries(statuses).map(([key, label]) => (
          <Link
            key={key}
            aria-current={filter === key ? "page" : undefined}
            href={`/admin?view=all&status=${key}`}
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
                {row.next_action && (
                  <p className="next-action">Next: {row.next_action}</p>
                )}
              </div>
              <div className="row-meta">
                <div className="row-badges">
                  <span className={`status-badge status-${row.status}`}>
                    {statuses[row.status as keyof typeof statuses]}
                  </span>
                  <span
                    className={`status-badge ${row.automation_processed ? "automation-processed" : "automation-unprocessed"}`}
                  >
                    {row.automation_processed
                      ? "Automation processed"
                      : "Not processed yet"}
                  </span>
                </div>
                {row.due_date && (
                  <span
                    className={`follow-up-date ${row.due_date < today ? "overdue" : ""}`}
                  >
                    {followUpLabel(row.due_date, today)} ·{" "}
                    <time dateTime={row.due_date}>
                      {formatFollowUpDate(row.due_date)}
                    </time>
                  </span>
                )}
                <time dateTime={row.created_at.toISOString()}>
                  Received{" "}
                  {row.created_at.toLocaleDateString("en-GB", {
                    timeZone: "Europe/Warsaw",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                {row.notification_status !== "sent" && (
                  <small>Owner notification {row.notification_status}</small>
                )}
                {row.confirmation_status === "failed" && (
                  <small>Visitor confirmation failed</small>
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
              {attention && total
                ? "Nothing needs attention today."
                : filter
                  ? "No enquiries with this status."
                  : "Ready for your first conversation."}
            </h2>
            <p>
              {attention && total
                ? "Future follow-ups and closed conversations are available in All."
                : filter
                  ? "Choose another filter to see more."
                  : "New website enquiries will appear here, ready for your review."}
            </p>
            {!!total && (
              <Link href="/admin?view=all" className="text-link">
                View all enquiries <Arrow />
              </Link>
            )}
            {!total && (
              <a href="/#contact" className="text-link">
                Open the enquiry form <Arrow />
              </a>
            )}
          </div>
        )}
      </section>
      <nav className="pagination" aria-label="Inbox pages">
        {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages && <Link href={pageHref(page + 1)}>Next →</Link>}
      </nav>
    </>
  );
}
