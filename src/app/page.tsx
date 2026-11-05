import { brand } from "@/config/brand";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { WorkflowExplorer } from "@/components/workflow-explorer";
import { Planner } from "@/components/planner";

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section
          className="hero"
          id="home"
          aria-labelledby="hero-title"
          tabIndex={-1}
        >
          <div className="wrap">
            <div className="hero-layout">
              <div className="hero-copy">
                <div className="eyebrow">{brand.tagline}</div>
                <h1 id="hero-title">
                  A little less busy.
                  <br />
                  <span>A lot more possible.</span>
                </h1>
                <p>
                  AI automation that fits the way you work. Start with one
                  everyday challenge, and make more space for the people and
                  ideas that matter.
                </p>
                <div className="actions">
                  <a className="button" href="#contact">
                    Find your starting point{" "}
                    <span className="arrow" aria-hidden="true">
                      <svg
                        className="corner-arrow"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                      >
                        <path d="M5 19 19 5M5 5h14v14" />
                      </svg>
                    </span>
                  </a>
                  <a className="button secondary" href="#in-practice">
                    See it in practice <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <p className="hero-note">
                  Founder-led. Built around your business. One useful step at a
                  time.
                </p>
              </div>
              <div className="hero-art">
                <div
                  className="orbit-art"
                  role="img"
                  aria-label="An AI-assisted connection between incoming work and a prepared next step"
                >
                  <div className="orbit-card">
                    <span className="orbit-dot">↓</span>
                    <strong>Work comes in.</strong>
                    <small>Enquiries, tasks, documents.</small>
                  </div>
                  <div className="orbit-core">
                    <svg
                      viewBox="0 0 48 48"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <ellipse
                        cx="24"
                        cy="24"
                        rx="18"
                        ry="8"
                        transform="rotate(-35 24 24)"
                      />
                      <ellipse
                        cx="24"
                        cy="24"
                        rx="18"
                        ry="8"
                        transform="rotate(35 24 24)"
                      />
                      <circle cx="24" cy="24" r="4" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="orbit-card">
                    <span className="orbit-dot">
                      <svg
                        className="corner-arrow"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                      >
                        <path d="M5 19 19 5M5 5h14v14" />
                      </svg>
                    </span>
                    <strong>Clarity comes out.</strong>
                    <small>Organised. Prepared. Yours.</small>
                  </div>
                  <span className="art-caption">
                    AI assistance · Human judgement
                  </span>
                </div>
              </div>
            </div>
            <div className="hero-foot">
              <span>For growing businesses</span>
              <span>From one workflow to a wider rollout</span>
              <span className="scroll-cue">Explore what’s possible ↓</span>
            </div>
          </div>
        </section>
        <section
          className="section solutions"
          id="solutions"
          aria-labelledby="solutions-title"
          tabIndex={-1}
        >
          <div className="wrap">
            <div className="section-heading">
              <div>
                <div className="eyebrow">01 / What we can simplify</div>
                <h2 id="solutions-title">
                  Better flow.
                  <br />
                  Across your business.
                </h2>
              </div>
              <p>
                Start where repetitive work gets in the way. We connect the
                tools you use and design around the decisions people make.
              </p>
            </div>
            <div className="services">
              <article className="service">
                <div className="service-top">
                  <span className="service-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M4 18 10 12l4 3 6-10M14 5h6v6" />
                    </svg>
                  </span>
                  <span className="micro muted">01</span>
                </div>
                <div className="service-main">
                  <h3>Sales, without the chasing.</h3>
                  <p>
                    Give every enquiry a clear next step, with your team in
                    control.
                  </p>
                </div>
                <ul>
                  <li>Enquiry capture & routing</li>
                  <li>CRM updates & context</li>
                  <li>Follow-up preparation</li>
                </ul>
                <a className="text-link" href="#contact">
                  Explore the fit{" "}
                  <span aria-hidden="true">
                    <svg
                      className="corner-arrow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="M5 19 19 5M5 5h14v14" />
                    </svg>
                  </span>
                  <span className="sr-only"> for sales</span>
                </a>
              </article>
              <article className="service">
                <div className="service-top">
                  <span className="service-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="6" height="6" rx="1" />
                      <rect x="15" y="15" width="6" height="6" rx="1" />
                      <path d="M9 6h9v9M6 9v9h9" />
                    </svg>
                  </span>
                  <span className="micro muted">02</span>
                </div>
                <div className="service-main">
                  <h3>Operations, connected.</h3>
                  <p>
                    Turn scattered information and repeatable tasks into a
                    coherent flow.
                  </p>
                </div>
                <ul>
                  <li>Document processing</li>
                  <li>Onboarding workflows</li>
                  <li>Reporting & system updates</li>
                </ul>
                <a className="text-link" href="#contact">
                  Explore the fit{" "}
                  <span aria-hidden="true">
                    <svg
                      className="corner-arrow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="M5 19 19 5M5 5h14v14" />
                    </svg>
                  </span>
                  <span className="sr-only"> for operations</span>
                </a>
              </article>
              <article className="service">
                <div className="service-top">
                  <span className="service-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
                      <path d="M8 8h8M8 12h5" />
                    </svg>
                  </span>
                  <span className="micro muted">03</span>
                </div>
                <div className="service-main">
                  <h3>Answers, with context.</h3>
                  <p>
                    Help people find what they need and prepare better
                    responses.
                  </p>
                </div>
                <ul>
                  <li>Internal knowledge assistants</li>
                  <li>Request classification</li>
                  <li>Human-reviewed response drafts</li>
                </ul>
                <a className="text-link" href="#contact">
                  Explore the fit{" "}
                  <span aria-hidden="true">
                    <svg
                      className="corner-arrow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="M5 19 19 5M5 5h14v14" />
                    </svg>
                  </span>
                  <span className="sr-only"> for support</span>
                </a>
              </article>
            </div>
            <div className="integration-strip">
              <span>Designed around your existing tools</span>
              <strong>CRM</strong>
              <strong>Email</strong>
              <strong>Documents</strong>
              <strong>Project tools</strong>
              <span>
                Integrations confirmed during assessment{" "}
                <svg
                  className="corner-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M5 19 19 5M5 5h14v14" />
                </svg>
              </span>
            </div>
          </div>
        </section>
        <WorkflowExplorer />
        <section
          className="section approach"
          id="approach"
          aria-labelledby="approach-title"
          tabIndex={-1}
        >
          <div className="wrap">
            <div className="section-heading">
              <div>
                <div className="eyebrow">03 / How we work together</div>
                <h2 id="approach-title">
                  Start focused.
                  <br />
                  Build with confidence.
                </h2>
              </div>
              <p>
                A clear scope, a measurable starting point, and a practical
                route from the first idea to everyday use.
              </p>
            </div>
            <div className="process">
              <article>
                <span className="count">01</span>
                <h3>Understand</h3>
                <p>
                  Map the process, check feasibility and identify the most
                  useful opportunity.
                </p>
                <span className="engagement-type">Fixed-fee assessment</span>
              </article>
              <article>
                <span className="count">02</span>
                <h3>Prove</h3>
                <p>
                  Test one workflow with agreed success measures and a human
                  review step.
                </p>
                <span className="engagement-type">Defined-scope pilot</span>
              </article>
              <article>
                <span className="count">03</span>
                <h3>Put to work</h3>
                <p>
                  Integrate, test, document and help your team adopt the new
                  process.
                </p>
                <span className="engagement-type">Milestone-based rollout</span>
              </article>
              <article>
                <span className="count">04</span>
                <h3>Keep improving</h3>
                <p>
                  Monitor the workflow, resolve issues and agree the next
                  improvements.
                </p>
                <span className="engagement-type">Scoped monthly support</span>
              </article>
            </div>
            <aside className="enterprise" aria-labelledby="enterprise-title">
              <div>
                <div className="eyebrow">For larger organisations</div>
                <h3 id="enterprise-title">
                  Start with a department.
                  <br />
                  Plan for the bigger picture.
                </h3>
                <p>
                  A focused pilot can sit within a wider organisation. We agree
                  the operational, technical and governance requirements before
                  implementation.
                </p>
              </div>
              <ul>
                <li>A named sponsor and a defined business outcome</li>
                <li>IT, security and procurement requirements reviewed</li>
                <li>Clear ownership, documentation and handover</li>
                <li>Support and continuity scoped to the engagement</li>
              </ul>
            </aside>
          </div>
        </section>
        <section
          className="section questions"
          id="questions"
          aria-labelledby="questions-title"
          tabIndex={-1}
        >
          <div className="wrap faq-layout">
            <div className="faq-intro">
              <div className="eyebrow">04 / A little more clarity</div>
              <h2 id="questions-title">
                Good questions.
                <br />
                Clear answers.
              </h2>
              <p>
                No need to arrive with a technical specification. Start with the
                work you would like to make easier.
              </p>
            </div>
            <div className="faq-list">
              <details>
                <summary>Do we need to replace our current tools?</summary>
                <p>
                  Usually the first step is to assess what you already use. We
                  check available integrations, access and constraints before
                  recommending any changes.
                </p>
              </details>
              <details>
                <summary>How much does an engagement cost?</summary>
                <p>
                  Assessment and pilot work are scoped before a quote.
                  Implementation, third-party usage and ongoing support are
                  shown separately, so you can see the full commitment.
                </p>
              </details>
              <details>
                <summary>Will AI make decisions without our team?</summary>
                <p>
                  We agree the review and approval boundaries with you.
                  Sensitive actions, uncertain inputs and exceptions can require
                  human approval. Not every task needs AI.
                </p>
              </details>
              <details>
                <summary>How do you handle access and business data?</summary>
                <p>
                  Data sources, permissions, providers and retention
                  requirements are reviewed during assessment. The design should
                  use only the access needed for the agreed workflow.
                </p>
              </details>
              <details>
                <summary>Can we start small and expand later?</summary>
                <p>
                  Yes. Start with one measurable workflow, document what works,
                  and use the results to decide whether a wider rollout is
                  worthwhile.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section
          className="section contact"
          id="contact"
          aria-labelledby="contact-title"
          tabIndex={-1}
        >
          <div className="wrap contact-layout">
            <div className="contact-copy">
              <div className="eyebrow">05 / Your next useful step</div>
              <h2 id="contact-title">
                What would you
                <br />
                like to make easier?
              </h2>
              <p>
                Bring one process that takes too much time. We’ll explore where
                automation could help and what a sensible first step looks like.
              </p>
              <div className="founder">
                <span className="founder-monogram" aria-hidden="true">
                  {brand.founder.initials}
                </span>
                <div>
                  <strong>{brand.founder.name}</strong>
                  <small>{brand.founder.detail}</small>
                </div>
              </div>
            </div>
            <Planner />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div>
            <Brand footer />
            <p>Practical AI automation. Built around your business.</p>
          </div>
          <p>
            Illustrative workflows. Every engagement starts with an assessment.
          </p>
          <a className="back-to-top" href="#home">
            Back to top ↑
          </a>
        </div>
      </footer>
    </>
  );
}
