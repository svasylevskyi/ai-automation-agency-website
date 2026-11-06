import type { PublicBrand } from "@/server/settings";
import { privacyHref } from "@/lib/legal";
import { Brand } from "./brand";
import { HomeLink } from "./home-link";

export function SiteFooter({
  brand,
  home = false,
}: {
  brand: PublicBrand;
  home?: boolean;
}) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <Brand brand={brand} footer />
          <p>Practical AI automation. Built around your business.</p>
        </div>
        <div>
          <p>
            Illustrative workflows. Every engagement starts with an assessment.
          </p>
          <nav className="legal-links" aria-label="Legal information">
            <a href={privacyHref(brand.privacyUrl)}>Privacy Policy</a>
            <a href="/terms">Website Terms</a>
          </nav>
        </div>
        <HomeLink className="back-to-top">
          {home ? "Back to top ↑" : "Back to website"}
        </HomeLink>
      </div>
    </footer>
  );
}
