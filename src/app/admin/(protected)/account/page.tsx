import { requireOwner } from "@/server/owner-page";
import { PasswordForm } from "@/components/password-form";
export default async function Account() {
  const session = await requireOwner();
  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Your account</h1>
          <p>Signed in as {session.user.email}</p>
        </div>
      </div>
      <PasswordForm />
    </>
  );
}
