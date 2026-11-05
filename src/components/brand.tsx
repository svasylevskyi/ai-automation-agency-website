import { brand } from "@/config/brand";

/** A replaceable mark plus a wrapping wordmark; no initials baked into the layout. */
export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={`brand${footer ? " brand-footer" : ""}`}
      href="#home"
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
