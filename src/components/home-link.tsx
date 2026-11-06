"use client";

import type { ComponentProps, MouseEvent } from "react";

/** Return to the top without reloading the page or clearing an enquiry draft. */
export function HomeLink({
  children,
  ...props
}: Pick<ComponentProps<"a">, "children" | "className" | "aria-label">) {
  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      window.location.pathname !== "/"
    )
      return;

    event.preventDefault();
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    document.getElementById("home")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0 });
  }

  return (
    <a {...props} href="/" onClick={goHome}>
      {children}
    </a>
  );
}
