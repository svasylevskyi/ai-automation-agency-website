import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSession } from "./auth";
export async function requireOwner() {
  const session = await ownerSession(await headers());
  if (!session) redirect("/admin/login");
  return session;
}
