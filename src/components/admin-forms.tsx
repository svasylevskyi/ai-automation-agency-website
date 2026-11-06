"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { type SiteSettings } from "@/lib/validation";

async function request(url: string, method: string, data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.fields
        ? Object.entries(body.fields)
            .map(([key, errors]) => `${key}: ${(errors as string[]).join(" ")}`)
            .join(" · ")
        : body.error?.message ||
            body.error ||
            body.message ||
            "The change could not be saved.",
    );
  return body;
}
export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await request("/api/auth/sign-in/email", "POST", {
        email: String(data.get("email")).trim().toLowerCase(),
        password: data.get("password"),
        rememberMe: false,
      });
      window.location.assign("/admin");
    } catch {
      setError(
        "Sign-in failed. Check your credentials or wait before trying again.",
      );
      setPending(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <button className="button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p role="alert" className="field-error">
        {error}
      </p>
    </form>
  );
}
export function SignOut() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        className="button secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await request("/api/auth/sign-out", "POST", {});
            window.location.assign("/admin/login");
          } catch {
            setError("Could not sign out. Please try again.");
            setPending(false);
          }
        }}
      >
        Sign out
      </button>
      <span role="alert">{error}</span>
    </div>
  );
}
export function SettingsForm({
  initial,
  version,
}: {
  initial: SiteSettings;
  version: number;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [currentVersion, setVersion] = useState(version);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  function field(key: keyof SiteSettings, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await request("/api/admin/settings", "PUT", {
        ...settings,
        version: currentVersion,
      });
      setVersion(result.version);
      setMessage("Settings saved. The public website now uses these details.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={save} className="admin-card settings-form">
      <h2>Agency identity</h2>
      <p>
        The name and logo are provisional. Change them here as your agency takes
        shape.
      </p>
      <label className="field">
        <span>Agency name</span>
        <input
          value={settings.name}
          onChange={(e) => field("name", e.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label className="field">
        <span>Tagline</span>
        <input
          value={settings.tagline}
          onChange={(e) => field("tagline", e.target.value)}
          minLength={2}
          maxLength={120}
          required
        />
      </label>
      <label className="field">
        <span>Search and sharing description</span>
        <textarea
          value={settings.description}
          onChange={(e) => field("description", e.target.value)}
          minLength={20}
          maxLength={300}
          required
          rows={3}
        />
      </label>
      <div className="logo-preview">
        <img
          src={
            settings.logoId
              ? `/api/brand-logo/${settings.logoId}`
              : "/brand/placeholder-mark.svg"
          }
          alt="Current logo preview"
        />
      </div>
      <label className="field">
        <span>Upload logo</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setMessage("");
            if (file.size > 2 * 1024 * 1024) {
              setMessage("Choose an image below 2 MB.");
              e.target.value = "";
              return;
            }
            setPending(true);
            try {
              const response = await fetch("/api/admin/logo", {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              field("logoId", data.id);
              setMessage("Logo uploaded. Save settings to publish it.");
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Upload failed.");
            } finally {
              setPending(false);
              e.target.value = "";
            }
          }}
        />
        <small>
          PNG, JPEG or WebP, up to 2 MB. A transparent PNG works well. Used in
          the header, footer and favicon.
        </small>
      </label>
      <button
        className="text-link"
        type="button"
        disabled={pending}
        onClick={() => field("logoId", null)}
      >
        Use placeholder logo
      </button>
      <label className="check-field">
        <input
          type="checkbox"
          checked={settings.showName}
          onChange={(e) => field("showName", e.target.checked)}
        />
        <span>Show agency name beside the logo</span>
      </label>
      <hr />
      <h2>Public contact details</h2>
      <label className="field">
        <span>
          Public email <small>(optional)</small>
        </span>
        <input
          type="email"
          value={settings.contactEmail}
          onChange={(e) => field("contactEmail", e.target.value)}
          maxLength={254}
        />
        <small>
          Shown beside the enquiry form for questions about personal data, and
          as an email fallback if JavaScript is unavailable. Opens the visitor’s
          email application. Also used as the reply-to address for new visitor
          confirmation emails. This does not change the notification recipient.
        </small>
      </label>
      <label className="field">
        <span>
          Booking URL <small>(optional, HTTPS)</small>
        </span>
        <input
          type="url"
          value={settings.bookingUrl}
          onChange={(e) => field("bookingUrl", e.target.value)}
          maxLength={500}
        />
        <small>
          Adds “Prefer a call? Choose a time” below the enquiry form. Use your
          scheduling page URL. Leave blank to hide the option.
        </small>
      </label>
      <label className="field">
        <span>
          Custom Privacy Policy URL <small>(optional, HTTPS)</small>
        </span>
        <input
          type="url"
          value={settings.privacyUrl}
          onChange={(e) => field("privacyUrl", e.target.value)}
          maxLength={500}
        />
        <small>
          Leave blank to use the built-in /privacy page edited below. Set an
          HTTPS URL only if your policy is hosted elsewhere; it overrides policy
          links in the footer, guide and enquiry form.
        </small>
      </label>
      <p className="privacy-note">
        The inbox notification recipient is configured separately on the server.
        Changing the public email does not redirect notifications.
      </p>
      <button className="button" disabled={pending}>
        {pending ? "Working…" : "Save settings"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
