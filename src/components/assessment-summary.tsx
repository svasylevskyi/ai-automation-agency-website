import { Fragment } from "react";
import {
  assessmentFacts,
  type AssessmentAnswers,
  type AssessmentRecommendation,
} from "@/lib/assessment";

export function AssessmentSummary({ answers }: { answers: AssessmentAnswers }) {
  return (
    <dl className="assessment-facts">
      {assessmentFacts(answers).map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function Recommendation({
  result,
}: {
  result: AssessmentRecommendation;
}) {
  return (
    <div className="assessment-recommendation">
      <h4>{result.title}</h4>
      <p>{result.detail}</p>
      <p>
        <strong>A useful first step. </strong>
        {result.firstStep}
      </p>
      <p>
        <strong>Before building. </strong>
        {result.prerequisite}
      </p>
      <p>{result.workload}</p>
      <p className="privacy-note">
        An initial suggestion to discuss. Scope, integrations and feasibility
        need to be confirmed together.
      </p>
    </div>
  );
}
