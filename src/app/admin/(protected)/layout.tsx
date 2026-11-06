import { Arrow } from "@/components/arrow";
import Link from "next/link";
import { requireOwner } from "@/server/owner-page";
import { SignOut } from "@/components/admin-forms";
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();
  return (
    <>
      <a href="#admin-main" className="skip">
        Skip to content
      </a>
      <header className="admin-header">
        <Link className="admin-wordmark" href="/admin">
          Owner workspace<span>One useful next step.</span>
        </Link>
        <nav aria-label="Owner navigation">
          <Link href="/admin">Enquiries</Link>
          <Link href="/admin/settings">Settings</Link>
          <Link href="/admin/account">Account</Link>
          <a href="/" target="_blank" rel="noopener noreferrer">
            View website <Arrow />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <SignOut />
        </nav>
      </header>
      <main id="admin-main" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
