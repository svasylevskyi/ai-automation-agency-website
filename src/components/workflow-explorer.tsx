"use client";

import { useState } from "react";
import { workflows, type Workflow } from "@/lib/workflows";

export function WorkflowExplorer() {
  const [selected, setSelected] = useState<Workflow>("sales");
  const workflow = workflows[selected];
  return (
    <section
      className="section example"
      id="in-practice"
      aria-labelledby="example-title"
      tabIndex={-1}
    >
      <div className="wrap example-layout">
        <div className="example-copy">
          <div className="eyebrow">02 / See the possibility</div>
          <h2 id="example-title">
            Small changes.
            <br />A clearer working day.
          </h2>
          <p>
            Explore an illustrative workflow. The starting point is a real
            business task; the outcome is a better next step.
          </p>
          <div
            className="example-control"
            role="group"
            aria-label="Choose an example workflow"
          >
            {(["sales", "operations", "support"] as const).map((key) => (
              <button
                className="scenario"
                key={key}
                type="button"
                aria-pressed={selected === key}
                aria-controls="workflow-panel"
                onClick={() => setSelected(key)}
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <noscript>
            <p className="privacy-note">
              Enable JavaScript to switch examples. The sales example is shown
              below.
            </p>
          </noscript>
        </div>
        <div
          className="workflow"
          id="workflow-panel"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="workflow-head">
            <span>WORKFLOW EXPLORER</span>
            <span className="demo-label">ILLUSTRATIVE EXAMPLE</span>
          </div>
          <h3>{workflow.title}</h3>
          <p>{workflow.intro}</p>
          <ol className="flow-steps">
            {workflow.steps.map(([title, detail], i) => (
              <li key={title}>
                <span className="step-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </li>
            ))}
          </ol>
          <p className="control-note">{workflow.note}</p>
        </div>
      </div>
    </section>
  );
}
