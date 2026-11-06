import { LegalDocument, legalMetadata } from "@/components/legal-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => legalMetadata("terms");
export default function Terms() {
  return <LegalDocument slug="terms" />;
}
