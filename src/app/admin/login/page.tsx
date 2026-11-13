import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSession } from "@/server/auth";
import { LoginForm } from "@/components/admin-forms";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ emailChanged?: string }>;
}) {
  if (await ownerSession(await headers())) redirect("/admin");
  const { emailChanged } = await searchParams;
  return (
    <main className="login-shell">
      <a className="text-link" href="/">
        ← Back to website
      </a>
      <section className="admin-card">
        <div className="eyebrow">Owner workspace</div>
        <h1>A little more clarity.</h1>
        <p>Sign in to manage enquiries and your agency’s identity.</p>
        {emailChanged === "1" && (
          <p role="status">
            Email address updated. Sign in with your new email address and
            existing password.
          </p>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
