import type { Metadata } from "next";
import { getBrand } from "@/server/settings";
import { env } from "@/server/env";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  ServiceEnquiryForm,
  ServiceEnquiryLink,
  ServiceEnquiryProvider,
} from "@/components/service-enquiry";
import "./service.css";

const title = "Enquiry & Sales Follow-Up Automation | Get Automated";
const description =
  "Keep enquiries moving with connected capture, AI-assisted replies and consistent follow-up. Get Automated helps service businesses reduce sales admin.";
export function generateMetadata(): Metadata {
  const url = new URL(
    "/enquiry-follow-up-automation",
    env().APP_URL,
  ).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Get Automated",
      type: "website",
      locale: "en_GB",
    },
  };
}

const outcomes = [
  [
    "Know what needs attention.",
    "Bring enquiries from the agreed source into your customer records, with a clear owner, status, and next action.",
  ],
  [
    "Prepare responses with less repetitive work.",
    "Use AI to summarise the enquiry, highlight missing information, and draft a response using your approved business information.",
  ],
  [
    "Make follow-up more consistent.",
    "Create reminders and agreed follow-up steps so opportunities do not depend solely on someone remembering them.",
  ],
  [
    "Arrive at meetings with the right context.",
    "Carry the relevant enquiry details into the scheduling and discovery process, reducing repeated questions and manual preparation.",
  ],
];
const steps = [
  [
    "Tell us what happens today",
    "Describe how enquiries reach your business, where the information goes, and which steps are frustrating or time-consuming.",
    "We review the fit and arrange a short discussion where useful.",
  ],
  [
    "Agree the problem and scope",
    "Where deeper discovery is needed, we map the process, identify the bottlenecks, and define a practical implementation.",
    "You receive a clear proposal covering the work, responsibilities, costs, delivery plan, and how the result will be assessed.",
  ],
  [
    "Build and test",
    "We configure the agreed workflow, connect the necessary tools, and test both normal cases and exceptions with you.",
    "Customer-facing wording and approval rules are reviewed before the workflow goes live.",
  ],
  [
    "Launch and hand over",
    "We explain how the workflow operates, how to handle exceptions, and how to make use of the resulting information.",
    "Optional ongoing support can cover agreed monitoring, maintenance, and improvements.",
  ],
];
const faqs = [
  [
    "Do we need a CRM?",
    "Not necessarily. We start by reviewing how you currently record and manage enquiries.",
    "That may mean working with an existing CRM, another suitable system, or recommending a practical change. We confirm what is appropriate before committing to the implementation.",
  ],
  [
    "Will AI send messages to customers without approval?",
    "AI-drafted customer replies require review before sending.",
    "Agreed template messages, such as acknowledgements or certain reminders, can be automated where appropriate. We define those permissions with you in advance.",
  ],
  [
    "What happens when information is missing or something fails?",
    "The workflow should make those cases visible and direct them to an assigned person.",
    "We include agreed exception handling and a manual fallback so that an incomplete or failed action is not simply treated as finished.",
  ],
  [
    "How long does implementation take?",
    "The schedule depends on the scope, the systems involved, access requirements, and approval availability.",
    "We agree a delivery plan in the proposal rather than promise a fixed turnaround before understanding the work.",
  ],
  [
    "How will we know whether it is helping?",
    "We agree a small set of measures before implementation. These may include response time, follow-up completion, administrative effort, and the number of suitable enquiries progressing to meetings.",
    "The aim is a measurable process improvement. More sales may follow, but sales results also depend on factors beyond the automation.",
  ],
  [
    "Can you support the workflow after launch?",
    "Yes. Optional support can cover agreed monitoring, maintenance, and a defined allowance for improvements.",
    "Coverage, response expectations, and change limits are specified in the support agreement.",
  ],
];

export default async function EnquiryFollowUpService() {
  const brand = await getBrand();
  return (
    <ServiceEnquiryProvider>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader brand={brand} />
      <nav className="service-navigation" aria-label="Service navigation">
        <div className="wrap">
          <a href="/">Home</a>
          <a href="#service">The service</a>
          <a href="#approach">How it works</a>
          <a href="#investment">Investment</a>
          <a href="#questions">Service FAQ</a>
          <a href="#contact">Let’s talk</a>
        </div>
      </nav>
      <main id="main" className="service-page" tabIndex={-1}>
        <section className="service-hero" aria-labelledby="service-title">
          <div className="wrap service-hero-grid">
            <div className="service-hero-copy">
              <p className="eyebrow">Enquiry handling &amp; sales follow-up</p>
              <h1 id="service-title">
                Keep good enquiries moving. <span>Cut the sales admin.</span>
              </h1>
              <p className="service-lead">
                When someone gets in touch, the next step should be clear—not
                buried in an inbox or dependent on someone remembering to follow
                up.
              </p>
              <p>
                Get Automated connects your enquiry capture, customer records,
                and follow-up process. We help your business organise incoming
                opportunities, prepare responses, and keep the right
                conversations moving.
              </p>
              <p className="service-emphasis">
                AI helps prepare the work. Your people stay in control.
              </p>
              <div className="service-actions">
                <ServiceEnquiryLink />
                <ServiceEnquiryLink route="custom automation" textOnly />
              </div>
              <p className="service-small">
                Start with a no-obligation fit review. Detailed discovery and
                implementation are scoped separately.
              </p>
            </div>
            <aside className="service-demo" aria-labelledby="demo-title">
              <div className="service-demo-caption">
                <span className="micro">Illustrative demonstration</span>
                <span className="service-demo-dot" aria-hidden="true" />
              </div>
              <h2 id="demo-title">
                One enquiry.
                <br />A clearer next step.
              </h2>
              <p className="service-small">
                Fictional example of an agreed workflow. No live messages or
                customer results.
              </p>
              <ol className="service-demo-stages">
                <li>
                  <span className="service-demo-number">01</span>
                  <div>
                    <h3>Enquiry captured</h3>
                    <p>
                      “We run training courses. Can you help us keep track of
                      requests for team bookings?”
                    </p>
                    <span className="service-demo-tag">
                      Owner assigned · New enquiry
                    </span>
                  </div>
                </li>
                <li>
                  <span className="service-demo-number">02</span>
                  <div>
                    <h3>Reply prepared</h3>
                    <p>
                      “Where do booking requests arrive today, and who decides
                      which course or date to suggest?”
                    </p>
                    <span className="service-demo-tag review">
                      AI draft · Awaiting human review
                    </span>
                  </div>
                </li>
                <li>
                  <span className="service-demo-number">03</span>
                  <div>
                    <h3>Next action visible</h3>
                    <p>
                      The owner reviews the reply. A follow-up reminder keeps
                      the conversation on their list.
                    </p>
                    <span className="service-demo-tag">
                      Reminder · Human decision
                    </span>
                  </div>
                </li>
              </ol>
            </aside>
          </div>
        </section>

        <section className="section" aria-labelledby="problem-title">
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">The problem</p>
              <h2 id="problem-title">
                The enquiry arrived. What happens next?
              </h2>
            </div>
            <div className="service-prose">
              <p>
                Someone needs to read it, find the relevant information, decide
                who should respond, write a useful reply, update the records,
                and remember to follow up.
              </p>
              <p>
                When those steps are spread across inboxes, spreadsheets,
                calendars, and people, it can become difficult to see what needs
                attention.
              </p>
              <p>
                Perhaps your team responds quickly but spends too much time
                preparing each reply. Perhaps follow-up is inconsistent. Or
                perhaps everything depends on the person who already has the
                most to do.
              </p>
              <p className="service-emphasis">
                We help turn those disconnected steps into a process your
                business can manage.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section service-tint"
          id="outcomes"
          tabIndex={-1}
          aria-labelledby="outcomes-title"
        >
          <div className="wrap">
            <div className="service-section-heading">
              <p className="eyebrow">The outcome</p>
              <h2 id="outcomes-title">
                Less chasing information.
                <br />
                More useful conversations.
              </h2>
            </div>
            <div className="service-outcomes">
              {outcomes.map(([heading, copy], index) => (
                <article key={heading}>
                  <span className="micro">0{index + 1}</span>
                  <h3>{heading}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <p className="service-closing">
              The aim is not to automate every interaction. It is to remove
              unnecessary work around the interactions that matter.
            </p>
          </div>
        </section>

        <section
          className="section"
          id="service"
          tabIndex={-1}
          aria-labelledby="process-title"
        >
          <div className="wrap">
            <div className="service-section-heading">
              <p className="eyebrow">The service</p>
              <h2 id="process-title">A connected enquiry-to-meeting process</h2>
              <p>
                Our flagship service brings together the steps between an
                incoming sales enquiry and a qualified conversation.
              </p>
            </div>
            <ol
              className="service-flow"
              aria-label="Enquiry-to-meeting process"
            >
              {[
                "Capture",
                "Organise",
                "Prepare",
                "Review",
                "Follow up",
                "Meet",
              ].map((step, index) => (
                <li key={step}>
                  <span className="micro">0{index + 1}</span>
                  <strong>{step}</strong>
                  {index < 5 && (
                    <span aria-hidden="true" className="service-flow-arrow">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="service-prose service-readable">
              <p>
                We start with a clearly defined workflow and connect the systems
                needed to support it. Depending on the agreed scope, this can
                include your website form or shared inbox, customer records,
                email, and scheduling tools.
              </p>
              <p>
                You receive a working process, agreed approval rules, tested
                exception handling, and documentation explaining how to use
                it—and what to do when something needs human attention.
              </p>
              <p>
                <strong>
                  This is not a requirement to replace all your software.
                </strong>{" "}
                We assess what your existing tools can support before
                recommending anything new.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section service-control"
          aria-labelledby="control-title"
        >
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">Human control</p>
              <h2 id="control-title">
                Automate the preparation—not your judgement.
              </h2>
            </div>
            <div className="service-prose">
              <p>
                Some actions are straightforward: record an enquiry, assign an
                owner, create a reminder, or send an approved acknowledgement.
              </p>
              <p>Others deserve a person’s attention.</p>
              <p>
                <strong>AI-drafted replies are reviewed before sending.</strong>{" "}
                Qualification decisions, pricing, commitments, and sensitive
                cases remain with your team.
              </p>
              <p>
                We agree those boundaries before implementation, so it is clear
                what the system can do, what requires approval, and when someone
                needs to intervene.
              </p>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="fit-title">
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">Who it is for</p>
              <h2 id="fit-title">
                Built for businesses that already have enquiries to manage.
              </h2>
            </div>
            <div className="service-prose">
              <p>
                This service is a good fit when you have an established offering
                and a recurring sales process, but handling enquiries takes more
                effort than it should.
              </p>
              <p>
                You might be a consultancy, agency, recruitment business,
                training provider, or another service company. The important
                question is not your industry label—it is whether there is a
                worthwhile process to improve.
              </p>
              <p>
                It is particularly relevant when a founder or small team is
                juggling sales alongside delivery, and the next action is not
                always visible.
              </p>
              <p className="service-callout">
                <strong>Looking primarily for more enquiries?</strong> This
                service focuses on handling existing interest more effectively.
                Advertising, outbound prospecting, and lead generation are
                separate challenges.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section service-tint"
          id="approach"
          tabIndex={-1}
          aria-labelledby="approach-title"
        >
          <div className="wrap">
            <div className="service-section-heading">
              <p className="eyebrow">How it works</p>
              <h2 id="approach-title">
                Start with the process.
                <br />
                Build what is useful.
              </h2>
            </div>
            <ol className="service-steps">
              {steps.map(([heading, first, second], index) => (
                <li key={heading}>
                  <span className="service-step-number">0{index + 1}</span>
                  <div className="service-prose">
                    <h3>{heading}</h3>
                    <p>{first}</p>
                    <p>{second}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" aria-labelledby="delivery-title">
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">Delivery approach</p>
              <h2 id="delivery-title">
                Direct collaboration. Clear boundaries. A practical handover.
              </h2>
            </div>
            <div className="service-prose">
              <p>
                Get Automated is founder-led. You work directly with the person
                responsible for understanding the process and delivering the
                implementation.
              </p>
              <p>
                We favour a defined, useful first project over an open-ended
                transformation programme. That means agreeing what is included,
                identifying dependencies early, and making sure your team
                understands the finished workflow.
              </p>
              <p>
                Where a simpler configuration can solve the problem, that is
                worth considering before adding more technology.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section"
          id="investment"
          tabIndex={-1}
          aria-labelledby="investment-title"
        >
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">Investment</p>
              <h2 id="investment-title">
                A defined project, with costs agreed before implementation.
              </h2>
            </div>
            <div className="service-prose">
              <p>
                The right scope depends on your process, the systems involved,
                and the amount of discovery required.
              </p>
              <p>
                Following the initial fit review, we explain whether a paid
                diagnostic is needed and provide a proposal for the appropriate
                next step.
              </p>
              <p>
                Implementation and optional ongoing support are quoted
                separately. Any required software subscriptions or usage charges
                are identified as part of the proposal.
              </p>
              <p className="service-emphasis">
                You should understand what you are buying—and what is outside
                the scope—before work begins.
              </p>
            </div>
          </div>
        </section>

        <section
          className="section"
          id="questions"
          tabIndex={-1}
          aria-labelledby="questions-title"
        >
          <div className="wrap faq-layout">
            <div>
              <p className="eyebrow">Frequently asked questions</p>
              <h2 id="questions-title">A few useful details.</h2>
            </div>
            <div className="faq-list">
              {faqs.map(([question, first, second]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{first}</p>
                  <p>{second}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section service-tint"
          aria-labelledby="broader-title"
        >
          <div className="wrap service-split">
            <div>
              <p className="eyebrow">Broader capabilities</p>
              <h2 id="broader-title">
                A different process slowing your business down?
              </h2>
            </div>
            <div className="service-prose">
              <p>
                Enquiry handling and follow-up are our starting point—not the
                limit of what we can explore.
              </p>
              <p>
                Get Automated also considers custom projects involving workflow
                integration, document processing, customer operations,
                reporting, and access to internal information.
              </p>
              <p>
                Tell us the business outcome you are looking for. We will assess
                whether automation is a suitable approach and scope any work
                separately.
              </p>
              <ServiceEnquiryLink route="custom automation" secondary />
            </div>
          </div>
        </section>

        <section
          className="section contact"
          id="contact"
          tabIndex={-1}
          aria-labelledby="contact-title"
        >
          <div className="wrap service-contact">
            <div className="service-prose">
              <p className="eyebrow">Let’s talk</p>
              <h2 id="contact-title">Let’s make the next step clearer.</h2>
              <p>
                Tell us how enquiries reach your business, what happens after
                they arrive, and where the process becomes difficult to manage.
              </p>
              <p>
                We will review whether this service is a suitable fit and
                explain the appropriate next step.
              </p>
              <ServiceEnquiryLink />
              <p className="service-small">
                An initial fit review carries no obligation to proceed.
              </p>
            </div>
            <ServiceEnquiryForm brand={brand} />
          </div>
        </section>
      </main>
      <SiteFooter brand={brand} />
    </ServiceEnquiryProvider>
  );
}
