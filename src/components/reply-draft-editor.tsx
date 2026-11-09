"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { replyDraftLimit, type ReplyReview } from "@/lib/prospect";

export function ReplyDraftEditor({
  id,
  original,
  review,
}: {
  id: string;
  original: string;
  review: ReplyReview;
}) {
  const router = useRouter();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [confirmed, setConfirmed] = useState(review);
  const [edit, setEdit] = useState<{ text: string; version: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  // A router refresh can supply another tab's save. Keep the version on which
  // local edits were based so a subsequent submit cannot overwrite it silently.
  const saved = review.version > confirmed.version ? review : confirmed;
  const savedText = saved.text ?? original;
  const text = edit?.text ?? savedText;
  const valid = text.trim().length > 0;
  const status = edit
    ? "Unsaved changes"
    : saved.ready
      ? "Ready to send"
      : saved.version
        ? "Draft saved"
        : "Draft ready for review";

  async function save(ready: boolean) {
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/admin/enquiries/${id}/prospect/reply-draft`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            ready,
            version: edit?.version ?? saved.version,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.fields?.text?.[0] ?? data.error ?? "Could not save the reply.",
        );
      setConfirmed(data);
      setEdit(null);
      setFeedback(
        ready
          ? "Reply saved and marked ready to send."
          : "Reply saved as a draft.",
      );
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not save the reply. Your edits are still here.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(edit ? "Copied your unsaved edits." : "Reply draft copied.");
    } catch {
      textarea.current?.focus();
      textarea.current?.select();
      setFeedback("Draft selected. Use Ctrl+C or your device’s copy command.");
    }
  }

  return (
    <div className="reply-draft-editor">
      <h3>Reply draft</h3>
      <details>
        <summary>Original n8n draft</summary>
        <p className="enquiry-message">{original}</p>
      </details>
      <div className="field">
        <label htmlFor="owner-reply-text">
          <span>Your reply</span>
        </label>
        <textarea
          id="owner-reply-text"
          ref={textarea}
          rows={12}
          maxLength={replyDraftLimit}
          value={text}
          readOnly={saving}
          onChange={(event) => {
            const value = event.target.value;
            setEdit(
              value === savedText
                ? null
                : { text: value, version: edit?.version ?? saved.version },
            );
            setFeedback("");
          }}
        />
      </div>
      <p>
        <strong>{status}</strong>
      </p>
      <div className="reply-draft-actions">
        <button
          type="button"
          className="button secondary"
          disabled={saving || !valid || (!edit && !saved.ready)}
          onClick={() => save(false)}
        >
          {saved.ready && !edit ? "Return to draft" : "Save draft"}
        </button>
        <button
          type="button"
          className="button"
          disabled={saving || !valid || (!edit && saved.ready)}
          onClick={() => save(true)}
        >
          Mark ready to send
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={!valid}
          onClick={copy}
        >
          Copy reply draft
        </button>
      </div>
      <p role="status">{feedback}</p>
    </div>
  );
}
