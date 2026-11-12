import { permanentRedirect } from "next/navigation";
import { requireOwner } from "@/server/owner-page";
export default async function Settings() {
  await requireOwner();
  permanentRedirect("/admin/agency-identity");
}
