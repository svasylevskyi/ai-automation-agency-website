"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { statuses, enquiryUpdateSchema } from "@/lib/validation";
import { deliveryLabels } from "@/lib/follow-up";

type Props = {
  id: string;
  status: string;
  notes: string;
  version: number;
  nextAction: string;
  followUpDate: string | null;
  notification: string;
  confirmation: string;
  confirmationAttempts: number;
};
async function request(url: string, method: string, input: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.fields
        ? Object.values(data.fields).flat().join(" ") || data.error
        : data.error,
    );
  return data;
}
export function EnquiryEditor(props: Props) {
  const router = useRouter();
  const initial = {
    status: props.status,
    notes: props.notes,
    nextAction: props.nextAction,
    followUpDate: props.followUpDate ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [version, setVersion] = useState(props.version);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmation, setConfirmation] = useState(props.confirmation);
  const [confirmationAttempts, setConfirmationAttempts] = useState(
    props.confirmationAttempts,
  );
  const [notification, setNotification] = useState(props.notification);
  const feedback = useRef<HTMLParagraphElement>(null);
  const dirty = Object.keys(saved).some(
    (key) =>
      form[key as keyof typeof form] !== saved[key as keyof typeof saved],
  );
  const url = `/api/admin/enquiries/${props.id}`;
  function field(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function perform(run: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      await run();
      router.refresh();
    } catch (failure) {
      setError(true);
      setMessage(
        failure instanceof Error
          ? failure.message
          : "The action failed. Your edits are still here.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const parsed = enquiryUpdateSchema.safeParse({
        ...form,
        followUpDate: form.followUpDate || null,
        version,
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues.map((issue) => issue.message).join(" "),
        );
      const result = await request(url, "PATCH", parsed.data);
      const normalized = { ...form, nextAction: parsed.data.nextAction };
      setVersion(result.version);
      setForm(normalized);
      setSaved(normalized);
      setMessage("Changes saved.");
    });
  }
  async function retry(channel: "notification" | "confirmation") {
    await perform(async () => {
      const result = await request(`${url}/${channel}`, "POST", {});
      if (channel === "notification") setNotification(result.status);
      else {
        setConfirmation(result.status);
        setConfirmationAttempts(result.attempts);
      }
      setMessage(
        result.status === "sent"
          ? "Accepted by the mail server. Inbox delivery is not confirmed."
          : "Not accepted by the mail server yet. Check the delivery state and mail settings.",
      );
    });
  }
  return (
    <div className="admin-card enquiry-editor">
      <h2>Follow-up</h2>
      <form className="follow-up-form" onSubmit={save}>
        <fieldset disabled={pending}>
          <label className="field">
            <span>Status</span>
            <select
              name="status"
              value={form.status}
              onChange={(e) => field("status", e.target.value)}
            >
              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Next action <small>(optional)</small>
            </span>
            <input
              name="nextAction"
              value={form.nextAction}
              maxLength={300}
              onChange={(e) => field("nextAction", e.target.value)}
              placeholder="For example: Send initial questions"
              aria-describedby="follow-up-help"
            />
          </label>
          <label className="field">
            <span>
              Follow-up date <small>(Warsaw time)</small>
            </span>
            <input
              type="date"
              name="followUpDate"
              min="2000-01-01"
              max="2099-12-31"
              value={form.followUpDate}
              onChange={(e) => field("followUpDate", e.target.value)}
              aria-describedby="follow-up-help"
            />
          </label>
          <p className="privacy-note" id="follow-up-help">
            Add an action and date together. Due and overdue actions appear in
            Needs attention. Complete or clear the action before closing this
            enquiry. This does not schedule an email to the visitor.
          </p>
          <label className="field">
            <span>Private notes</span>
            <textarea
              name="notes"
              value={form.notes}
              rows={7}
              maxLength={10000}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Context for the next conversation…"
            />
          </label>
          <div className="follow-up-buttons">
            <button className="button" disabled={pending}>
              {pending ? "Working…" : "Save changes"}
            </button>
            {(form.nextAction || form.followUpDate) && (
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    nextAction: "",
                    followUpDate: "",
                  }))
                }
              >
                Clear follow-up fields
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {!!saved.nextAction && (
        <div className="complete-follow-up">
          <button
            className="button secondary"
            disabled={pending || dirty}
            onClick={() =>
              perform(async () => {
                const result = await request(`${url}/follow-up`, "POST", {
                  version,
                });
                const updated = { ...saved, nextAction: "", followUpDate: "" };
                setForm(updated);
                setSaved(updated);
                setVersion(result.version);
                setMessage(
                  "Follow-up completed and recorded in history. You can now schedule the next action.",
                );
              })
            }
          >
            Mark saved follow-up complete
          </button>
          {dirty && (
            <p className="privacy-note">
              Save your changes before completing the saved follow-up.
            </p>
          )}
        </div>
      )}
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className={error ? "field-error" : undefined}
      >
        {message}
      </p>
      <hr />
      <h3>Email delivery</h3>
      <p>
        Owner notification:{" "}
        <strong>{deliveryLabels[notification] ?? notification}</strong>
      </p>
      {notification !== "sent" && (
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => retry("notification")}
        >
          Retry owner notification
        </button>
      )}
      <p>
        Visitor confirmation:{" "}
        <strong>{deliveryLabels[confirmation] ?? confirmation}</strong>
      </p>
      {!["sent", "not_required"].includes(confirmation) &&
        confirmationAttempts < 5 && (
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => retry("confirmation")}
          >
            Retry visitor confirmation
          </button>
        )}
      {confirmation === "failed" && confirmationAttempts >= 5 && (
        <p className="notice error">
          Five attempts used. Check the address and contact the visitor manually
          if appropriate.
        </p>
      )}
      <p className="privacy-note">
        Automatic retries stop after five attempts. An email accepted by the
        server may still bounce or go to spam. In the test environment, messages
        are captured in Mailpit. Reload to see background delivery updates.
      </p>
      <details className="danger-zone">
        <summary>Delete enquiry</summary>
        <p>
          Permanently removes this enquiry, notes, follow-up and activity
          history from the inbox. Already accepted emails cannot be recalled.
        </p>
        <button
          className="button danger"
          disabled={pending || dirty}
          onClick={() => {
            if (
              !window.confirm(
                "Permanently delete this enquiry, notes and activity history? This cannot be undone.",
              )
            )
              return;
            void perform(async () => {
              await request(url, "DELETE", { version });
              router.push("/admin");
            });
          }}
        >
          Delete permanently
        </button>
        {dirty && (
          <p className="privacy-note">Save your changes before deleting.</p>
        )}
      </details>
    </div>
  );
}
