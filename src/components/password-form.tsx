"use client";
import { useRef, useState, type FormEvent } from "react";

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const input = Object.fromEntries(values);
    setMessage("");
    setError("");
    if (input.newPassword !== input.confirmPassword) {
      setError("The new passwords must match.");
      return;
    }
    if (input.newPassword === input.currentPassword) {
      setError("Choose a different password.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The password could not be changed.");
      form.reset();
      setMessage(data.message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The connection was interrupted. Please try again.",
      );
    } finally {
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <form className="admin-card password-form" onSubmit={submit}>
      <h2>Change your password</h2>
      <p>
        Use 12–128 characters. You’ll stay signed in here; other sessions will
        be signed out.
      </p>
      <label className="field">
        <span>Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={pending}
        />
      </label>
      <label className="field">
        <span>New password</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          disabled={pending}
        />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          disabled={pending}
        />
      </label>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
      <p
        ref={feedback}
        tabIndex={-1}
        role="status"
        className={error ? "field-error" : ""}
      >
        {error || message}
      </p>
    </form>
  );
}
