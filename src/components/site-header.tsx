"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Brand } from "./brand";
import { Arrow } from "./arrow";

const links = [
  ["solutions", "Solutions"],
  ["in-practice", "In practice"],
  ["approach", "Approach"],
  ["questions", "Questions"],
  ["contact", "Let’s talk"],
] as const;

export function SiteHeader() {
  const [current, setCurrent] = useState("");
  const disclosure = useRef<HTMLDetailsElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let active = "";
      const offset = (header.current?.offsetHeight ?? 72) + 36;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("main section[id]"),
      );
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= offset) active = section.id;
      });
      // A short final section may never reach the header at the end of the page.
      if (
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2
      ) {
        active = sections.at(-1)?.id ?? active;
      }
      setCurrent(active);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const close = () => {
      if (disclosure.current) disclosure.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        close();
        disclosure.current.querySelector("summary")?.focus();
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        close();
    };
    const breakpoint = matchMedia("(max-width: 800px)");
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("hashchange", onScroll);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    breakpoint.addEventListener("change", close);
    const resizeHeader = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--header-height",
        `${header.current?.offsetHeight ?? 72}px`,
      );
      onScroll();
    });
    if (header.current) resizeHeader.observe(header.current);
    update();
    return () => {
      resizeHeader.disconnect();
      document.documentElement.style.removeProperty("--header-height");
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("hashchange", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      breakpoint.removeEventListener("change", close);
    };
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (disclosure.current) disclosure.current.open = false;
    document.getElementById(id)?.focus({ preventScroll: true });
  };

  const navigation = links.map(([id, label]) => (
    <a
      key={id}
      className={id === "contact" ? "nav-cta" : "nav-link"}
      href={`#${id}`}
      aria-current={current === id ? "location" : undefined}
      onClick={(event) => navigate(event, id)}
    >
      {label}
      {id === "contact" && <Arrow />}
    </a>
  ));

  return (
    <header className="site-header" ref={header}>
      <div className="wrap header-inner">
        <Brand />
        <nav className="nav desktop-navigation" aria-label="Main navigation">
          {navigation}
        </nav>
        <details
          className="mobile-navigation"
          ref={disclosure}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)
            )
              event.currentTarget.open = false;
          }}
        >
          <summary className="menu-toggle" aria-label="Navigation menu">
            <svg
              className="menu-open-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            <svg
              className="menu-close-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </summary>
          <nav className="nav" aria-label="Mobile navigation">
            {navigation}
          </nav>
        </details>
      </div>
    </header>
  );
}
