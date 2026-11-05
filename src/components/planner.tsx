"use client";

import { useRef, useState, type FormEvent } from "react";
import { brand } from "@/config/brand";
import {
  areas,
  getRecommendation,
  type Area,
  type TeamSize,
} from "@/lib/planner";
import { Arrow } from "./arrow";

export function Planner() {
  const [area, setArea] = useState<Area>("sales");
  const [size, setSize] = useState<TeamSize>("small");
  const [result, setResult] = useState<ReturnType<
    typeof getRecommendation
  > | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(getRecommendation(area, size));
    requestAnimationFrame(() =>
      resultRef.current?.focus({ preventScroll: true }),
    );
  }
  const contactHref =
    brand.bookingUrl ||
    (brand.contactEmail ? `mailto:${brand.contactEmail}` : "");

  return (
    <form className="planner" onSubmit={submit} action="#contact">
      <h3>Find a starting point.</h3>
      <p>Explore a first step for your business. No contact details needed.</p>
      <label className="field">
        <span>Where does work get stuck?</span>
        <select
          value={area}
          onChange={(event) => {
            setArea(event.target.value as Area);
            setResult(null);
          }}
        >
          {Object.entries(areas).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>What best describes your team?</span>
        <select
          value={size}
          onChange={(event) => {
            setSize(event.target.value as TeamSize);
            setResult(null);
          }}
        >
          <option value="small">A small business or growing team</option>
          <option value="mid">An established medium-sized business</option>
          <option value="large">A department in a larger organisation</option>
        </select>
      </label>
      <button className="button" type="submit">
        Find my first step <Arrow />
      </button>
      <p className="privacy-note">
        This guide runs in your browser. Nothing is sent or saved.
      </p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {result && (
          <div className="plan-result" ref={resultRef} tabIndex={-1}>
            <strong>{result.title}</strong>
            <p>{result.detail}</p>
            {contactHref && (
              <a className="text-link" href={contactHref}>
                {brand.bookingUrl
                  ? "Arrange a conversation"
                  : "Email about this workflow"}{" "}
                <Arrow />
              </a>
            )}
          </div>
        )}
      </div>
      <noscript>
        <p className="privacy-note">
          The guide needs JavaScript. A useful first step is to map one
          recurring workflow, its owner and the time it takes today.
        </p>
      </noscript>
    </form>
  );
}
