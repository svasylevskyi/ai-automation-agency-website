import { requireOwner } from "@/server/owner-page";
import { permanentRedirect } from "next/navigation";
export default async function Account() {
  await requireOwner();
  permanentRedirect("/admin/admin-account");
}
