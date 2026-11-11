"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PublicBrand } from "@/server/settings";
import type { EnquiryRoute } from "@/lib/enquiry-routes";
import { EnquiryForm } from "./enquiry-form";
import { Arrow } from "./arrow";

const ServiceEnquiryContext = createContext<{
  route: EnquiryRoute;
  selectRoute: (route: EnquiryRoute) => void;
} | null>(null);

export function ServiceEnquiryProvider({ children }: { children: ReactNode }) {
  const [route, selectRoute] = useState<EnquiryRoute>("enquiry-process review");
  return (
    <ServiceEnquiryContext.Provider value={{ route, selectRoute }}>
      {children}
    </ServiceEnquiryContext.Provider>
  );
}

export function ServiceEnquiryLink({
  route = "enquiry-process review",
  secondary = false,
  textOnly = false,
}: {
  route?: EnquiryRoute;
  secondary?: boolean;
  textOnly?: boolean;
}) {
  const context = useContext(ServiceEnquiryContext)!;
  return (
    <a
      className={
        textOnly ? "text-link" : `button${secondary ? " secondary" : ""}`
      }
      href="#contact"
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        context.selectRoute(route);
        requestAnimationFrame(() =>
          document
            .getElementById("service-form")
            ?.querySelector<HTMLElement>("h3")
            ?.focus({ preventScroll: true }),
        );
      }}
    >
      {route === "enquiry-process review"
        ? "Review your enquiry process"
        : "Discuss another automation challenge"}{" "}
      <Arrow />
    </a>
  );
}

export function ServiceEnquiryForm({ brand }: { brand: PublicBrand }) {
  const context = useContext(ServiceEnquiryContext)!;
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <div id="service-form">
      <EnquiryForm
        brand={brand}
        assessment={null}
        headingRef={heading}
        onEditAssessment={() => {}}
        onRemoveAssessment={() => {}}
        onSent={() => {}}
        enquiryRoute={context.route}
        onRouteChange={context.selectRoute}
      />
    </div>
  );
}
