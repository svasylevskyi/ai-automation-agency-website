import Link from "next/link";
import { requireOwner } from "@/server/owner-page";
import { AdminNavigation } from "@/components/admin-navigation";
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
        <AdminNavigation />
      </header>
      <main id="admin-main" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
