"use client";
import { useRef, useState } from "react";
import type { RetentionPolicy, RetentionPreview } from "@/lib/retention";
export function RetentionEditor({ initial }: { initial: RetentionPolicy }) {
  const [days, setDays] = useState(String(initial.days)),
    [enabled, setEnabled] = useState(initial.enabled);
  const [version, setVersion] = useState(initial.version),
    [preview, setPreview] = useState<RetentionPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  async function run(action: "preview" | "save") {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        action === "preview"
          ? "/api/admin/retention/preview"
          : "/api/admin/retention",
        {
          method: action === "preview" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            days: Number(days),
            version,
            enabled,
            acknowledged,
            previewToken: preview?.token,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.fields
            ? Object.values(data.fields).flat().join(" ") || data.error
            : data.error,
        );
      if (action === "preview") {
        setPreview(data);
        setAcknowledged(false);
        setMessage(
          "Preview ready. No enquiries have been deleted by this preview.",
        );
      } else {
        setVersion(data.version);
        setPreview(null);
        setAcknowledged(false);
        setMessage(
          enabled
            ? "Automatic cleanup enabled. Eligible closed enquiries can be deleted during the next maintenance run."
            : "Automatic cleanup disabled. Enquiries will remain until you delete them or re-enable cleanup.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The request failed.",
      );
      if (action === "preview") setPreview(null);
    } finally {
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <section
      className="admin-card retention-editor"
      aria-labelledby="retention-title"
    >
      <h2 id="retention-title">Closed-enquiry retention</h2>
      <p>
        Keep closed enquiries for a chosen number of days after closure or the
        latest owner edit, whichever is later. Open conversations are excluded.
        The suggested 180 days is an editable starting point, not a legal
        requirement.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run("save");
        }}
      >
        <fieldset disabled={pending}>
          <label className="field">
            <span>Retention period (days)</span>
            <input
              name="days"
              type="number"
              required
              min={30}
              max={3650}
              value={days}
              onChange={(event) => {
                setDays(event.target.value);
                setPreview(null);
                setAcknowledged(false);
              }}
            />
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={() => run("preview")}
          >
            Preview eligible enquiries
          </button>
          {preview && (
            <div className="retention-preview">
              <h3>
                {preview.count} eligible{" "}
                {preview.count === 1 ? "enquiry" : "enquiries"}
              </h3>
              <p>
                Up to 50 oldest matches are shown. The preview expires after 10
                minutes. Other enquiries will become eligible as they age.
              </p>
              {preview.samples.length > 0 && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Enquiry</th>
                        <th>Last closure or edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.samples.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <a
                              href={`/admin/enquiries/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.name}
                              <span className="sr-only">
                                {" "}
                                (opens in a new tab)
                              </span>
                            </a>
                            <small>{item.email}</small>
                          </td>
                          <td>
                            {new Date(item.last_activity).toLocaleString(
                              "en-GB",
                              { timeZone: "Europe/Warsaw" },
                            )}{" "}
                            (Warsaw)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setAcknowledged(false);
              }}
            />
            <span>Automatically delete eligible closed enquiries</span>
          </label>
          {enabled && (
            <>
              <p className="notice">
                Saving with cleanup enabled allows permanent deletion during
                scheduled maintenance, in batches of up to 100. The enquiry,
                notes, assessment, receipt data and activity history are removed
                together. Reopening or editing an enquiry protects it from the
                current expiry deadline.
              </p>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={!preview}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  I reviewed the preview and understand that eligible enquiries
                  will be permanently deleted.
                </span>
              </label>
            </>
          )}
          <p className="privacy-note">
            A minimal record of the random enquiry ID and deletion time remains
            for safe recovery. Backups and captured emails have separate
            retention. Confirm your backup and recovery setup and align your
            Privacy Policy before enabling cleanup.
          </p>
          <button
            className="button"
            disabled={pending || (enabled && (!preview || !acknowledged))}
          >
            Save retention settings
          </button>
        </fieldset>
      </form>
      <p ref={feedback} tabIndex={-1} role="status">
        {message}
      </p>
      <p className="privacy-note">
        Last cleanup:{" "}
        {initial.lastCleanupAt
          ? `${new Date(initial.lastCleanupAt).toLocaleString("en-GB", { timeZone: "Europe/Warsaw" })} (Warsaw), ${initial.lastDeletedCount} deleted`
          : "No cleanup run recorded"}
        . Reload to refresh this result.
      </p>
    </section>
  );
}
