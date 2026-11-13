"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  legalPages,
  legalKeys,
  resolveLegalText,
  unresolvedLegalKeys,
  type LegalPage,
} from "@/lib/legal";
import { legalField } from "@/lib/legal-fields";
import { LegalContent } from "./legal-content";

export function LegalEditor({
  initial,
  privacyOverride = false,
}: {
  initial: LegalPage;
  privacyOverride?: boolean;
}) {
  const [page, setPage] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const feedback = useRef<HTMLDivElement>(null);
  const keys = legalKeys(page.title + "\n" + page.content);
  const groups = [...new Set(keys.map((key) => legalField(key).group))];
  const missing = unresolvedLegalKeys(
    page.title + "\n" + page.content,
    page.values,
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setFields({});
    setError(false);
    try {
      const response = await fetch(`/api/admin/legal/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: page.title,
          content: page.content,
          isDraft: page.isDraft,
          version: page.version,
          values: page.values,
          valuesVersion: page.valuesVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFields(data.fields ?? {});
        throw new Error(data.error);
      }
      setPage((current) => ({
        ...current,
        version: data.version,
        updatedAt: data.updatedAt,
        values: data.values,
        valuesVersion: data.valuesVersion,
      }));
      setMessage(
        "Page saved. The public pages now use the saved text and shared details.",
      );
    } catch (failure) {
      setError(true);
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Save failed. Your edits are still here.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  const fieldError = (key: string) =>
    fields[key] && (
      <small className="field-error" id={`${page.slug}-${key}-error`}>
        {fields[key].join(" ")}
      </small>
    );
  return (
    <section
      className="admin-card legal-editor"
      aria-labelledby={`${page.slug}-editor-title`}
    >
      <h2 id={`${page.slug}-editor-title`}>{legalPages[page.slug].title}</h2>
      <p>
        Save changes to update the public page immediately. Draft pages are also
        visible, labelled as drafts and excluded from search indexing.
      </p>
      <a
        className="text-link"
        href={legalPages[page.slug].path}
        target="_blank"
        rel="noopener noreferrer"
      >
        View built-in page <span className="sr-only">(opens in a new tab)</span>
      </a>
      {privacyOverride && (
        <p className="notice">
          A custom Privacy Policy URL is set in{" "}
          <a href="/admin/agency-identity">Settings → Agency identity</a>.
          Website links use that URL. Clear it there and save settings to use
          this built-in page.
        </p>
      )}
      <p className="privacy-note">
        Saved revision {page.version}. Copy any text you want to keep before
        replacing it. Page edits do not change server settings, suppliers or
        data-retention processes.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={pending}>
          <label className="field">
            <span>Page title</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
              aria-invalid={!!fields.title}
              aria-describedby={
                fields.title ? `${page.slug}-title-error` : undefined
              }
            />
            {fieldError("title")}
          </label>
          <label className="field">
            <span>Page text template</span>
            <textarea
              required
              minLength={100}
              maxLength={60000}
              rows={22}
              value={page.content}
              onChange={(e) => setPage({ ...page, content: e.target.value })}
              aria-invalid={!!fields.content}
              aria-describedby={`${page.slug}-format${fields.content ? ` ${page.slug}-content-error` : ""}`}
            />
            {fieldError("content")}
          </label>
          <p className="privacy-note" id={`${page.slug}-format`}>
            Use blank lines for paragraphs, ## for headings, and - for bullet
            points. HTML and other markup are displayed as text. This is a text
            editor, not a code editor. Keep placeholders such as{" "}
            {"{CONTACT_EMAIL}"} in the text and fill their values below. A new
            uppercase placeholder creates its own field.
          </p>
          {keys.length > 0 && (
            <div className="legal-placeholder-fields">
              <h3>Details used in this document</h3>
              <p className="privacy-note">
                Values are shared by Privacy Policy and Website Terms. Saving a
                shared value updates both documents wherever that placeholder is
                used. Clearing a required value returns affected pages to draft.
                These fields update legal wording only, not account, email or
                server settings.
              </p>
              {groups.map((group) => (
                <fieldset key={group} className="legal-field-group">
                  <legend>{group}</legend>
                  {keys
                    .filter((key) => legalField(key).group === group)
                    .map((key) => {
                      const definition = legalField(key);
                      const id = `${page.slug}-value-${key}`;
                      const props = {
                        id,
                        name: key,
                        value: page.values[key] ?? "",
                        maxLength: 4000,
                        "aria-describedby": `${id}-help`,
                        "aria-invalid": !page.isDraft && missing.includes(key),
                        onChange: (
                          event: React.ChangeEvent<
                            HTMLInputElement | HTMLTextAreaElement
                          >,
                        ) =>
                          setPage((current) => ({
                            ...current,
                            values: {
                              ...current.values,
                              [key]: event.target.value,
                            },
                          })),
                      };
                      return (
                        <label key={key} className="field" htmlFor={id}>
                          <span>
                            {definition.label} <code>{`{${key}}`}</code>
                          </span>
                          {definition.multiline ? (
                            <textarea {...props} rows={3} />
                          ) : (
                            <input {...props} type="text" />
                          )}
                          <small id={`${id}-help`} className="privacy-note">
                            {definition.help ||
                              "Replaces this placeholder everywhere it appears in either document."}
                            {missing.includes(key) && " Not filled in yet."}
                          </small>
                        </label>
                      );
                    })}
                </fieldset>
              ))}
              {fieldError("values")}
            </div>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={page.isDraft}
              onChange={(e) => setPage({ ...page, isDraft: e.target.checked })}
              aria-describedby={`${page.slug}-draft-help${fields.isDraft ? ` ${page.slug}-isDraft-error` : ""}`}
              aria-invalid={!!fields.isDraft}
            />
            <span>Mark this page as a draft</span>
          </label>
          <p className="privacy-note" id={`${page.slug}-draft-help`}>
            Remove this mark only after filling all placeholder fields and
            reviewing the wording and actual business arrangements.
          </p>
          {fieldError("isDraft")}
          <details className="legal-preview">
            <summary>Preview with filled details</summary>
            <h3>{resolveLegalText(page.title, page.values)}</h3>
            <LegalContent
              content={resolveLegalText(page.content, page.values)}
              idPrefix={`${page.slug}-preview`}
            />
          </details>
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : `Save ${legalPages[page.slug].title}`}
          </button>
        </fieldset>
        <div ref={feedback} tabIndex={-1} role="status" aria-live="polite">
          {message && (
            <p className={`notice ${error ? "error" : "success"}`}>{message}</p>
          )}
        </div>
      </form>
    </section>
  );
}
