"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { emailChangeSchema } from "@/lib/validation";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const input = emailChangeSchema.safeParse({
      ...Object.fromEntries(new FormData(form)),
      currentEmail,
    });
    setError("");
    if (!input.success) {
      setError(input.error.issues[0].message);
      requestAnimationFrame(() => feedback.current?.focus());
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The email address could not be changed.",
        );
      form.reset();
      router.replace("/admin/login?emailChanged=1");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The connection was interrupted. Sign in again to check whether the email was updated.",
      );
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }

  return (
    <form className="admin-card email-form" onSubmit={submit}>
      <h2>Change your email address</h2>
      <p>
        Current sign-in email: <strong>{currentEmail}</strong>
      </p>
      <p>
        Enter the new address twice and confirm your current password. This
        takes effect immediately and signs you out on all devices. Your password
        stays the same.
      </p>
      <p>
        This changes your admin sign-in email only. Your public contact email
        and enquiry notification recipient are managed separately.
      </p>
      <label className="field">
        <span>New email address</span>
        <input
          name="newEmail"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={pending}
        />
      </label>
      <label className="field">
        <span>Confirm new email address</span>
        <input
          name="confirmEmail"
          type="email"
          autoComplete="off"
          required
          maxLength={254}
          disabled={pending}
        />
      </label>
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
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update email and sign out"}
      </button>
      <p ref={feedback} tabIndex={-1} role="alert" className="field-error">
        {error}
      </p>
      {error && (
        <a className="text-link" href="/admin/login">
          Sign in again
        </a>
      )}
    </form>
  );
}
