import { LegalDocument, legalMetadata } from "@/components/legal-page";
export const dynamic = "force-dynamic";
export const generateMetadata = () => legalMetadata("privacy");
export default function Privacy() {
  return <LegalDocument slug="privacy" />;
}
