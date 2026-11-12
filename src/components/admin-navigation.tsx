"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Arrow } from "./arrow";
import { SignOut } from "./admin-forms";

const groups = [
  {
    label: "Settings",
    links: [
      { label: "Agency identity", href: "/admin/agency-identity" },
      { label: "Admin account", href: "/admin/admin-account" },
      { label: "Retention & backups", href: "/admin/retention" },
    ],
  },
  {
    label: "Legal docs",
    links: [
      { label: "Privacy Policy", href: "/admin/legal/privacy" },
      { label: "Website Terms", href: "/admin/legal/terms" },
    ],
  },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = () =>
      navigation.current
        ?.querySelectorAll("details[open]")
        .forEach((element) => element.removeAttribute("open"));
    close();
    const outside = (event: PointerEvent) => {
      if (!navigation.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [pathname]);

  return (
    <nav ref={navigation} className="admin-nav" aria-label="Owner navigation">
      <Link
        href="/admin"
        aria-current={pathname === "/admin" ? "page" : undefined}
        data-active={
          pathname === "/admin" || pathname.startsWith("/admin/enquiries/")
        }
      >
        Enquiries
      </Link>
      {groups.map(({ label, links }) => (
        <details
          key={label}
          className="admin-nav-group"
          name="owner-navigation"
          onToggle={(event) => {
            if (!event.currentTarget.open) return;
            navigation.current
              ?.querySelectorAll("details[open]")
              .forEach((element) => {
                if (element !== event.currentTarget)
                  element.removeAttribute("open");
              });
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.preventDefault();
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary data-active={links.some(({ href }) => href === pathname)}>
            {label}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="m2 4 4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </summary>
          <ul className="admin-submenu" aria-label={label}>
            {links.map(({ label: text, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  onClick={(event) => {
                    const group = event.currentTarget.closest("details");
                    if (group) group.open = false;
                  }}
                >
                  {text}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <a href="/" target="_blank" rel="noopener noreferrer">
        View Website <Arrow />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <SignOut />
    </nav>
  );
}
