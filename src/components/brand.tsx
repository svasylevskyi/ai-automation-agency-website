import type { PublicBrand } from "@/server/settings";

/** A replaceable mark plus a wrapping wordmark; no initials baked into the layout. */
export function Brand({
  brand,
  footer = false,
}: {
  brand: PublicBrand;
  footer?: boolean;
}) {
  return (
    <a
      className={`brand${footer ? " brand-footer" : ""}`}
      href="/#home"
      aria-label={`${brand.name} home`}
    >
      <img
        className="brand-logo"
        src={brand.logo.src}
        width={brand.logo.width}
        height={brand.logo.height}
        alt=""
      />
      {brand.logo.showName && <span className="brand-name">{brand.name}</span>}
    </a>
  );
}
