import { requireOwner } from "@/server/owner-page";
import { PasswordForm } from "@/components/password-form";
import { EmailForm } from "@/components/email-form";

export default async function AdminAccount() {
  const session = await requireOwner();
  return (
    <>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Admin account</h1>
          <p>Signed in as {session.user.email}</p>
        </div>
      </div>
      <div className="account-settings">
        <EmailForm currentEmail={session.user.email} />
        <PasswordForm />
      </div>
    </>
  );
}
