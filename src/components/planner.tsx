"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { areas, teamSizes } from "@/lib/planner";
import {
  assessmentSchema,
  recommendAssessment,
  frequencies,
  difficulties,
  goals,
  timings,
  type AssessmentAnswers,
} from "@/lib/assessment";
import { AssessmentSummary, Recommendation } from "./assessment-summary";
import { Arrow } from "./arrow";

const initialDraft = {
  version: 1 as const,
  area: "",
  teamSize: "",
  workflowDescription: "",
  tools: "",
  frequency: "",
  difficulty: "",
  goal: "",
  timing: "",
};
const steps = ["Choose a workflow", "Your current process", "What would help?"];

export function Planner({
  onDiscuss,
  onSkip,
  editRequest,
}: {
  onDiscuss: (answers: AssessmentAnswers) => void;
  onSkip: () => void;
  editRequest: number;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AssessmentAnswers | null>(null);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function goToStep(next: number) {
    setStep(next);
    setResult(null);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  useEffect(() => {
    if (editRequest) goToStep(0);
  }, [editRequest]);

  function update(
    key: Exclude<keyof typeof initialDraft, "version">,
    value: string,
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function select(
    key: "area" | "teamSize" | "frequency" | "difficulty" | "goal" | "timing",
    label: string,
    options: Record<string, string>,
  ) {
    return (
      <label className="field">
        <span>{label}</span>
        <select
          required
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
        >
          <option value="" disabled>
            Choose an option
          </option>
          {Object.entries(options).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      goToStep(step + 1);
      return;
    }
    const parsed = assessmentSchema.safeParse({
      ...draft,
      workflowDescription:
        draft.area === "other" ? draft.workflowDescription : "",
    });
    if (!parsed.success) {
      setError("Please go back and complete the choices on each step.");
      return;
    }
    setResult(parsed.data);
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  return (
    <div className="planner">
      <h3>Find a starting point.</h3>
      <p>
        Three short steps to explore an opportunity. No contact details needed
        to see your recommendation.
      </p>
      {result ? (
        <div
          className="plan-result"
          ref={resultRef}
          tabIndex={-1}
          aria-label="Your workflow recommendation"
        >
          <Recommendation result={recommendAssessment(result)} />
          <details className="assessment-review">
            <summary>Review your answers</summary>
            <AssessmentSummary answers={result} />
          </details>
          <button
            className="button"
            type="button"
            onClick={() => onDiscuss(result)}
          >
            Discuss this workflow <Arrow />
          </button>
          <button
            className="text-link"
            type="button"
            onClick={() => goToStep(0)}
          >
            Edit answers
          </button>
          <p className="privacy-note">
            Your answers will be attached to the enquiry form for you to review
            before sending.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="assessment-progress" aria-live="polite">
            Step {step + 1} of 3
          </p>
          <h4 ref={heading} tabIndex={-1}>
            {steps[step]}
          </h4>
          {step === 0 && (
            <>
              {select(
                "area",
                "Where does repetitive work slow you down?",
                areas,
              )}
              {draft.area === "other" && (
                <label className="field">
                  <span>
                    Briefly describe the task you’d like to improve{" "}
                    <small>(optional)</small>
                  </span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={draft.workflowDescription}
                    onChange={(event) =>
                      update("workflowDescription", event.target.value)
                    }
                  />
                </label>
              )}
              {select("teamSize", "What best describes your team?", teamSizes)}
            </>
          )}
          {step === 1 && (
            <>
              <label className="field">
                <span>
                  Which tools do you use? <small>(optional)</small>
                </span>
                <input
                  maxLength={300}
                  value={draft.tools}
                  onChange={(event) => update("tools", event.target.value)}
                  placeholder="For example: email, spreadsheets, a CRM"
                  aria-describedby="tools-hint"
                />
                <small id="tools-hint">
                  Leave blank if you’re not sure yet.
                </small>
              </label>
              {select(
                "frequency",
                "How often does this task happen?",
                frequencies,
              )}
              {select(
                "difficulty",
                "What is the biggest difficulty?",
                difficulties,
              )}
            </>
          )}
          {step === 2 && (
            <>
              {select("goal", "What would you most like to improve?", goals)}
              {select("timing", "When are you thinking of starting?", timings)}
            </>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <div className="assessment-actions">
            {step > 0 && (
              <button
                className="button secondary"
                type="button"
                onClick={() => goToStep(step - 1)}
              >
                Back
              </button>
            )}
            <button className="button" type="submit">
              {step === 2 ? "See my recommendation" : "Next"} <Arrow />
            </button>
          </div>
        </form>
      )}
      <button type="button" className="text-link" onClick={onSkip}>
        Go directly to the enquiry form <Arrow />
      </button>
      <p className="privacy-note">
        Your answers stay in this page until you send an enquiry. Reloading
        clears them. Please leave out passwords and sensitive client
        information.
      </p>
      <noscript>
        <p className="privacy-note">
          The guide needs JavaScript. A useful first step is to map one
          recurring workflow, its owner and the time it takes today.
        </p>
      </noscript>
    </div>
  );
}
