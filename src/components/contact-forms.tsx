"use client";

import { useRef, useState } from "react";
import type { PublicBrand } from "@/server/settings";
import type { AssessmentAnswers } from "@/lib/assessment";
import { EnquiryForm } from "./enquiry-form";
import { privacyHref } from "@/lib/legal";
import { Planner } from "./planner";

export function ContactForms({ brand }: { brand: PublicBrand }) {
  const [assessment, setAssessment] = useState<AssessmentAnswers | null>(null);
  const [editRequest, setEditRequest] = useState(0);
  const [sent, setSent] = useState(false);
  const guide = useRef<HTMLDetailsElement>(null);
  const enquiryHeading = useRef<HTMLHeadingElement>(null);

  function goToEnquiry() {
    if (guide.current) guide.current.open = false;
    requestAnimationFrame(() => enquiryHeading.current?.focus());
  }

  return (
    <div className="contact-forms">
      {!sent && (
        <details className="planner-disclosure" ref={guide}>
          <summary>Explore a starting point — optional 3-step guide</summary>
          <Planner
            privacyUrl={privacyHref(brand.privacyUrl)}
            editRequest={editRequest}
            onDiscuss={(answers) => {
              setAssessment(answers);
              goToEnquiry();
            }}
            onSkip={goToEnquiry}
          />
        </details>
      )}
      <EnquiryForm
        brand={brand}
        assessment={assessment}
        headingRef={enquiryHeading}
        onEditAssessment={() => {
          if (guide.current) guide.current.open = true;
          setEditRequest((value) => value + 1);
        }}
        onRemoveAssessment={() => setAssessment(null)}
        onSent={() => {
          setAssessment(null);
          setSent(true);
        }}
      />
    </div>
  );
}
