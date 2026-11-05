"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicBrand } from "@/server/settings";
import { areas } from "@/lib/planner";
import { Arrow } from "./arrow";

export function EnquiryForm({ brand }: { brand: PublicBrand }) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  async function refreshToken() {
    try {
      const response = await fetch("/api/enquiry-token", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setToken(data.token);
      setMessage("");
    } catch {
      setMessage("The form could not be loaded. Please try refreshing it.");
    }
  }
  useEffect(() => {
    void refreshToken();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          company: form.get("company"),
          area: form.get("area"),
          teamSize: form.get("teamSize"),
          message: form.get("message"),
          privacyAcknowledged: form.get("privacyAcknowledged") === "on",
          website: form.get("website"),
          token,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFields(data.fields ?? {});
        throw new Error(data.error);
      }
      setSent(true);
      setMessage(data.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The connection was interrupted. Your text is still here; please try again.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  const errorFor = (name: string) =>
    fields[name] ? (
      <small className="field-error" id={`${name}-error`}>
        {fields[name].join(" ")}
      </small>
    ) : null;
  return (
    <div className="enquiry-card">
      <h3>Let’s start with your workflow.</h3>
      <p>
        Tell us what takes too much time. We’ll use your details to reply about
        your enquiry.
      </p>
      {sent ? (
        <div
          className="notice success"
          ref={feedback}
          tabIndex={-1}
          role="status"
        >
          <strong>{message}</strong>
          <p>
            No need to send it again. We’ll review the context before getting in
            touch.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Your name</span>
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                aria-invalid={!!fields.name}
                aria-describedby={fields.name ? "name-error" : undefined}
              />
              {errorFor("name")}
            </label>
            <label className="field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? "email-error" : undefined}
              />
              {errorFor("email")}
            </label>
          </div>
          <label className="field">
            <span>
              Company <small>(optional)</small>
            </span>
            <input name="company" autoComplete="organization" maxLength={120} />
          </label>
          <label className="field">
            <span>Where does work get stuck?</span>
            <select name="area">
              {Object.entries(areas).map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Your team</span>
            <select name="teamSize">
              <option value="small">A small business or growing team</option>
              <option value="mid">An established medium-sized business</option>
              <option value="large">
                A department in a larger organisation
              </option>
            </select>
          </label>
          <label className="field">
            <span>What would you like to make easier?</span>
            <textarea
              name="message"
              rows={5}
              required
              minLength={20}
              maxLength={5000}
              placeholder="The process, tools you use, and where the manual work happens…"
              aria-invalid={!!fields.message}
              aria-describedby={fields.message ? "message-error" : undefined}
            />
            {errorFor("message")}
          </label>
          <p className="privacy-note" id="enquiry-privacy">
            Please leave out passwords and sensitive client information. Your
            name, email and message are stored for the agency owner to review
            and respond. We do not add you to a marketing list.
            {brand.privacyUrl && (
              <>
                {" "}
                <a href={brand.privacyUrl}>Read the privacy notice.</a>
              </>
            )}
            {brand.contactEmail && (
              <>
                {" "}
                For questions about your details, email{" "}
                <a href={`mailto:${brand.contactEmail}`}>
                  {brand.contactEmail}
                </a>
                .
              </>
            )}
          </p>
          <label className="check-field">
            <input
              type="checkbox"
              name="privacyAcknowledged"
              required
              aria-describedby="enquiry-privacy"
            />
            <span>I’ve read how my enquiry details will be used.</span>
          </label>
          <div className="honeypot" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <button className="button" type="submit" disabled={pending || !token}>
            {pending ? "Sending…" : "Send enquiry"} <Arrow />
          </button>
          <div ref={feedback} tabIndex={-1} role="status" aria-live="polite">
            {message && <p className="notice error">{message}</p>}
          </div>
          {message && (
            <button
              type="button"
              className="text-link"
              onClick={refreshToken}
              disabled={pending}
            >
              Refresh form security check
            </button>
          )}
          <noscript>
            <p>
              This form needs JavaScript.
              {brand.contactEmail && (
                <>
                  {" "}
                  You can email{" "}
                  <a href={`mailto:${brand.contactEmail}`}>
                    {brand.contactEmail}
                  </a>
                  .
                </>
              )}
            </p>
          </noscript>
        </form>
      )}
      {brand.bookingUrl && (
        <p>
          <a className="text-link" href={brand.bookingUrl}>
            Prefer a call? Choose a time <Arrow />
          </a>
        </p>
      )}
    </div>
  );
}
