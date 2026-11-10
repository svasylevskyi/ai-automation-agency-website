"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { statuses } from "@/lib/validation";

type Item = { id: string; version: number; name: string; detail: ReactNode };
type Status = keyof typeof statuses;

export function InboxSelection({
  items,
  children,
}: {
  items: Item[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<Status | "">("");
  const [busy, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const selectAll = useRef<HTMLInputElement>(null);
  const selection = items.filter(({ id }) => selected.includes(id));
  const count = selection.length;

  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate = count > 0 && count < items.length;
  }, [count, items.length]);

  function applyStatus() {
    if (!target || !count || busy) return;
    startTransition(async () => {
      setFeedback("");
      try {
        const response = await fetch("/api/admin/enquiries/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: target,
            enquiries: selection.map(({ id, version }) => ({ id, version })),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          setFeedback(
            result.error ||
              "Could not update the selected enquiries. Please try again.",
          );
          return;
        }
        const { updated, unchanged } = result;
        const message = [
          updated &&
            `${updated} ${updated === 1 ? "enquiry" : "enquiries"} moved to ${statuses[target]}.`,
          unchanged && `${unchanged} already ${statuses[target]}.`,
        ]
          .filter(Boolean)
          .join(" ");
        setFeedback(message);
        setSelected([]);
        setTarget("");
        router.refresh();
      } catch {
        setFeedback(
          "Could not confirm the update. Reload the inbox to check the selected enquiries.",
        );
      }
    });
  }

  return (
    <section className="inbox-list" aria-label="Enquiries">
      {!!items.length && (
        <div className="inbox-toolbar">
          <label className="inbox-check">
            <input
              type="checkbox"
              ref={selectAll}
              checked={count === items.length}
              disabled={busy}
              onChange={(e) =>
                setSelected(e.target.checked ? items.map(({ id }) => id) : [])
              }
            />
            Select all on this page
          </label>
          <span className="selection-count" aria-live="polite">
            {count} selected
          </span>
          <select
            aria-label="New status"
            disabled={busy}
            value={target}
            onChange={(e) => setTarget(e.target.value as Status | "")}
          >
            <option value="">Choose status</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="button"
            type="button"
            disabled={busy || !target || !count}
            onClick={applyStatus}
          >
            {busy ? "Updating…" : "Apply status"}
          </button>
          {target === "closed" && (
            <p className="inbox-close-note">
              Closing clears scheduled follow-ups and cancels unfinished
              prospect jobs for these enquiries.
            </p>
          )}
        </div>
      )}
      <div role="status" className="inbox-feedback">
        {feedback}
      </div>
      {items.map(({ id, name, detail }) => (
        <div className="selectable-enquiry" key={id}>
          <label className="inbox-check row-check">
            <input
              type="checkbox"
              aria-label={`Select ${name}`}
              disabled={busy}
              checked={selected.includes(id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, id]
                    : selected.filter((value) => value !== id),
                )
              }
            />
          </label>
          {detail}
        </div>
      ))}
      {!items.length && children}
    </section>
  );
}
