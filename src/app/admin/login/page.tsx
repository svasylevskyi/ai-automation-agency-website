import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSession } from "@/server/auth";
import { LoginForm } from "@/components/admin-forms";
export default async function Login() {
  if (await ownerSession(await headers())) redirect("/admin");
  return (
    <main className="login-shell">
      <a className="text-link" href="/">
        ← Back to website
      </a>
      <section className="admin-card">
        <div className="eyebrow">Owner workspace</div>
        <h1>A little more clarity.</h1>
        <p>Sign in to manage enquiries and your agency’s identity.</p>
        <LoginForm />
      </section>
    </main>
  );
}
