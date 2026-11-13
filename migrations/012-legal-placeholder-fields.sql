-- One-time replacement of the original drafts, explicitly requested by the owner.
-- Later edits are preserved by the checksum-tracked migration runner.
CREATE TABLE legal_details (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO legal_details (data) VALUES ($details${
  "LEGAL_NAME": "Stepan Vasylevskyi - IT Consulting",
  "TRADING_NAME": "Get Automated",
  "WEBSITE_URL": "https://get-automated.ai",
  "POSTAL_ADDRESS": "ul. Smardzowska 5a/14, 52-234 Wrocław, Poland",
  "NIP": "8992779679",
  "REGON": "540469457",
  "CONTACT_EMAIL": "support@get-automated.ai",
  "PRIVACY_CONTACT_EMAIL": "support@get-automated.ai",
  "COMPLAINTS_EMAIL": "support@get-automated.ai",
  "HOSTING_DETAILS": "Hetzner Online GmbH hosts the website and its database in Nuremberg, Germany (eu-central network zone).",
  "DNS_DETAILS": "Cloudflare, Inc. provides DNS services. Website traffic is not proxied through Cloudflare; DNS resolution involves technical query information, not the contents of enquiry forms.",
  "BACKUP_DETAILS": "Encrypted off-server backups are stored with Cloudflare, Inc. using Cloudflare R2 with European Union jurisdiction. This location applies to the backup objects; it is not a promise that all supplier account, support or service metadata stays in the EU.",
  "MAIL_DELIVERY_DETAILS": "Resend (Plus Five Five, Inc., United States) delivers transactional messages. Our sending region is Ireland (eu-west-1). This determines the sending route, not storage residency: Resend stores message content and delivery logs in the United States.",
  "MAILBOX_DETAILS": "Google Workspace/Gmail and Google's subprocessors handle business correspondence and the owner mailbox. Under Google's data-processing terms, processing can take place in countries where Google and its subprocessors operate, including outside the EEA, subject to applicable contractual commitments.",
  "AUTOMATION_DETAILS": "Real enquiries are not currently processed by our n8n Cloud/OpenAI workflow. This workflow is used for testing, with execution-data saving disabled. We review real enquiries ourselves. Before using this or another external AI workflow for real enquiry data, we will assess the supplier arrangements and update this notice to explain the data, purposes, recipients, transfers and retention involved.",
  "TRANSFER_DETAILS": "Resend processes message data in the United States. Google and Cloudflare may also process service data or provide support outside the EEA, including in the United States and the countries identified in their subprocessor information. Their data-processing terms provide for European Commission Standard Contractual Clauses and, where applicable, recognised adequacy mechanisms such as the EU-US Data Privacy Framework. An EU hosting or sending region does not by itself eliminate these transfers. You can request information about the safeguards from our privacy contact.",
  "ENQUIRY_RETENTION": "Automatic deletion of eligible closed enquiries is enabled after 180 days, measured from closure or the latest saved owner edit, whichever is later. An active email-send operation can defer deletion until it finishes. The enquiry, attached assessment, notes, follow-up records, saved drafts/replies and activity history are removed together.",
  "OPEN_ENQUIRY_REVIEW": "Open enquiries are reviewed daily to decide whether further contact is useful, whether the record should be closed, or whether it should be deleted. The closed-enquiry deletion rule does not automatically delete open enquiries.",
  "CORRESPONDENCE_RETENTION": "Gmail correspondence is managed manually; no automatic mailbox-deletion schedule is configured. Messages are kept while needed to handle the conversation, carry out an engagement, meet a legal obligation or deal with a legal claim, and are manually removed when no longer needed for those purposes. Deleting an enquiry from the website does not delete mailbox copies.",
  "MAIL_DELIVERY_RETENTION": "On our Resend Free plan, the provider currently retains email content and delivery logs for 30 days during active service. Its stated deletion period for remaining customer data after account termination is up to 90 days. These provider periods are separate from our enquiry database, backups and Gmail correspondence.",
  "BACKUP_RETENTION": "The configured policies use 7 days for local dumps, a rolling 35-day window for encrypted full backups, and a rolling 65-day window for deletion checkpoints. The newest recovery copies are preserved. Expiration depends on successful backup, verification and pruning jobs, so failed jobs or a preserved final good copy can extend retention. Minimal records containing a random enquiry ID and deletion time are retained for at least 65 days and until managed backups capable of reintroducing that enquiry have expired. Known deletions are reapplied before restored data is made available.",
  "LOG_RETENTION": ""
}$details$::jsonb);

INSERT INTO legal_pages (slug,title,content,is_draft) VALUES ('privacy','Privacy Policy',$document$This Privacy Policy explains how personal data is handled when you visit {WEBSITE_URL}, use the optional workflow assessment, send an enquiry or access the private owner area. It covers the website and the initial enquiry process. Any later client engagement may need a separate privacy notice and data-processing agreement.

## 1. Who is responsible for your data

The controller is {LEGAL_NAME}, operating as {TRADING_NAME}, at {POSTAL_ADDRESS}. Business registration identifiers: NIP {NIP}; REGON {REGON}.

For privacy questions or requests, contact {PRIVACY_CONTACT_EMAIL} or write to the postal address above.

## 2. Data you choose to provide

When you send an enquiry, we receive your name, email address, optional company name, workflow category, team size and message. The service-page form also records whether you requested an enquiry-process review or help with another automation challenge, and any business website and current-tools information you supply. If you attach an assessment, we also receive the task description you supplied, current tools, task frequency, main difficulty, desired outcome, timing and the recommendation shown to you.

We record the submission time and the version of the short enquiry data-use explanation you acknowledged. The owner may add private notes, a status, a next action and a follow-up date to manage the conversation. We keep an activity history of status changes, scheduled, changed, cleared or completed actions, note-update times, and email attempts and outcomes. Previous private-note text is not copied into that history. Confirmation-email wording is saved with the enquiry so retries use the same receipt. Please share only information needed to understand your enquiry. Do not include passwords, access credentials, special-category personal data or confidential information about clients or other people.

When the owner reviews and sends a first reply through the website, we store its preview, approved wording, sender and recipient addresses, subject, reply address, sending attempts and provider acceptance reference with your enquiry. This supports review, prevents duplicate sending and records the conversation's next step. Reply bodies are not copied into the activity log. Any selected follow-up is an internal reminder, not an automatic customer message. Later email correspondence takes place in our business mailbox and is not automatically synchronised back into the website.

Name and email are needed to receive and reply to an enquiry. A direct enquiry needs a short message; a complete attached assessment can supply that context instead. Company details, business website, current tools and the optional free-text assessment fields are not required. If you do not supply the required fields, the form cannot be submitted. You can still browse the website and view an assessment result without identifying yourself.

## 3. The assessment, demonstrations and AI

The assessment uses predefined rules to suggest a possible starting point. Answers remain in the current page's memory until you choose to attach them and send an enquiry. They are not put into the address bar, browser local storage or browser session storage. Reloading or leaving the page clears the unsent assessment.

Selecting a recommendation or attaching it to the form does not send the answers to us. The enquiry form requests a short-lived security token separately, without the assessment answers. The guide does not send your answers to an external AI provider. Workflow demonstrations use illustrative examples; they do not mean that your enquiry has been processed by AI.

{AUTOMATION_DETAILS}

The result is general orientation for a conversation. It does not approve or reject you, set a price or make a decision with legal or similarly significant effects. A person reviews submitted enquiries.

## 4. Technical and security information

Our hosting systems receive information needed to deliver the website, such as the request time, requested address, IP address and browser/request information. Operational and security logs may record this information according to the hosting configuration. We use short-lived, cryptographically derived identifiers based on client addresses and email addresses to limit abusive submissions, rather than storing those values directly in the form's rate-limit keys.

The private owner account has authentication records, a password hash and session information. Plain-text passwords are not stored. Changing the admin sign-in email requires the current password and signs out existing sessions. The owner area is not open for public registration and has no email-based password-reset service.

The public website does not currently use advertising trackers or analytics cookies. The assessment does not require a tracking cookie. Necessary authentication cookies are used for the private owner area; sessions are configured for up to 12 hours and may be renewed through continued use. Your browser may cache ordinary website assets. An external service you choose to visit may use its own cookies under its own notice.

## 5. Why we process data and the legal bases

Enquiry handling includes acknowledging receipt, reviewing your request and following up with you. Where you ask us to take steps towards a possible contract with you personally, necessary enquiry handling is based on Article 6(1)(b) GDPR. Where you represent a business or make a general enquiry, we rely on Article 6(1)(f): our legitimate interest in understanding requests, communicating with business contacts and managing potential work, balanced against your rights.

Website delivery, access control and abuse prevention rely on our legitimate interest in operating a secure, reliable service. Keeping necessary records for establishing, exercising or defending legal claims may also rely on legitimate interests. Where a specific legal obligation requires retention or disclosure, Article 6(1)(c) applies to that obligation.

The form's “I’ve read how my enquiry details will be used” checkbox records acknowledgement of the explanation. It is not marketing consent or a blanket permission for unrelated processing. Sending an enquiry does not subscribe you to a mailing list. If we later introduce processing that relies on consent, we will explain it separately and allow that consent to be withdrawn.

## 6. Who can receive the data

The agency owner manages enquiries. Suppliers process data as needed to provide their services:

- {HOSTING_DETAILS}
- {DNS_DETAILS}
- {BACKUP_DETAILS}
- {MAIL_DELIVERY_DETAILS}
- {MAILBOX_DETAILS}

Owner notifications contain a private inbox link, not your message, assessment or contact details. The automatic acknowledgement sent to you may use your name and describes the next step without copying your enquiry. An owner-approved reply can contain information from your enquiry, so the delivery provider processes that approved text as well as recipient and delivery information. Replies sent back to our business address are handled through Google Workspace/Gmail.

We do not currently provide an external booking integration or connect real enquiries to a CRM. Professional advisers or public authorities may receive limited information where necessary for advice, a legal obligation or a legal claim. We do not sell enquiry data. Additional access is limited to authorised purposes.

## 7. International transfers and external services

{TRANSFER_DETAILS}

Supplier information about these arrangements is available at https://resend.com/legal/dpa, https://cloud.google.com/terms/data-processing-addendum and https://www.cloudflare.com/cloudflare-customer-dpa/. Google and Cloudflare publish subprocessor information at https://workspace.google.com/terms/subprocessors/ and https://www.cloudflare.com/cloudflare-subprocessors/.

If you follow an external link, that service has its own terms and privacy practices. No external scheduling service is currently embedded or loaded by this website.

## 8. How long data is kept

We distinguish website records, business mailboxes, provider logs and recovery copies:

- {ENQUIRY_RETENTION}
- {OPEN_ENQUIRY_REVIEW}
- {CORRESPONDENCE_RETENTION}
- {MAIL_DELIVERY_RETENTION}
- {BACKUP_RETENTION}
- Website and security logs: {LOG_RETENTION}

Expired form rate-limit entries and expired admin sessions are removed by scheduled maintenance. If an enquiry becomes client work, necessary records follow the retention arrangements for that engagement. Statutory records and information required for active legal claims are kept for the applicable legal period or while the claim requires them.

Deletion from the website cannot recall delivered emails or remove copies held independently by recipients. A record may remain in a protected backup until that recovery copy expires. Retention settings and this notice must describe the same operating arrangements; editing legal wording does not itself change a deletion job or supplier setting.

## 9. Your rights and how to use them

Depending on the processing and the applicable legal conditions, you can request access to your data, correction, erasure, restriction and portability. You may object to processing based on legitimate interests, explaining your particular situation. If processing relies on consent, you may withdraw it without affecting the lawfulness of earlier processing.

Send your request to {PRIVACY_CONTACT_EMAIL}. We may ask for proportionate information to confirm your identity before disclosing or changing personal data. We normally respond within one month. Where the law permits an extension because of complexity or the number of requests, we will explain the reason and revised timing within that month. Some rights are limited where retaining or using data is necessary for a legal obligation or claim.

You may complain to the President of the Personal Data Protection Office in Poland (Prezes Urzędu Ochrony Danych Osobowych, UODO), or another competent supervisory authority. UODO provides current procedures at https://uodo.gov.pl. You do not have to obtain our permission to complain.

## 10. Security, intended audience and changes

We use measures appropriate to the website, including HTTPS, restricted owner access, password hashing, form validation and abuse controls. No online system can guarantee absolute security. If you believe information was submitted in error or there is a security problem, contact {CONTACT_EMAIL}.

The website is intended for business-related enquiries and is not directed at children. Please avoid sending personal data about children. If you believe such data was supplied unnecessarily, contact us so we can assess and remove it where appropriate.

The date and revision shown on this page identify the current notice. We will update it when the service or processing arrangements change and provide additional information when required. Adding analytics, scheduling, CRM integrations or external AI processing requires reviewing the data flows and providing the appropriate information before those changes apply. A change to this notice does not authorise an unrelated new purpose or remove rights concerning data already collected.
$document$,true)
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,
  is_draft=true,version=legal_pages.version+1,updated_at=now();

INSERT INTO legal_pages (slug,title,content,is_draft) VALUES ('terms','Website Terms',$document$These Website Terms describe the use of this website, its free workflow assessment and its enquiry form. They are intended as the regulations for those electronic services. They do not set the commercial terms for an automation project, consultancy engagement or ongoing support.

## 1. Website operator and contact

The service provider is {LEGAL_NAME}, operating as {TRADING_NAME}, at {POSTAL_ADDRESS}. Business registration identifiers: NIP {NIP}; REGON {REGON}.

For enquiries, complaints or questions about these terms, contact {CONTACT_EMAIL} or use the postal address above. The website address is {WEBSITE_URL}.

## 2. What the website provides

You can read about our enquiry-handling and sales-follow-up service and broader automation capabilities, explore illustrative workflows, use a short rules-based assessment, request an enquiry-process review or describe another automation challenge. These website functions are free of charge. Your own internet or communications provider may charge you for connectivity.

The assessment suggests a possible first automation opportunity from your selected answers. The “Other / I’m not sure yet” option gives general workflow-review guidance. The result is available without entering contact details. You can attach it to an enquiry or contact us directly without completing an assessment.

The website does not currently offer an external booking integration, public user accounts, online checkout or subscription purchasing. The private owner area is for authorised administration only.

## 3. Starting and ending use of the services

These terms are available before you use the assessment or enquiry form. You can save or print them using your browser. The free assessment service starts when you choose to use the guide; it ends when you stop using it or leave the page. You can go back, edit your answers or stop at any time without a charge.

The electronic enquiry service is requested when you submit the completed form. A successful on-screen confirmation means the website received the enquiry. If the form reports a failure, follow the message and retry when appropriate. We also attempt to send a short confirmation email. Email delivery can be delayed or fail; the on-screen confirmation still means the enquiry was saved. A technical acknowledgement is not acceptance of a project or a promise to reply within a particular period. A person reviews the enquiry and decides the next step. We may send an owner-reviewed first reply through the website and continue correspondence in our business mailbox.

You can end use by closing the page. Unsent assessment answers are then lost. Closing the page does not withdraw a submitted enquiry or automatically erase its record; contact us if you wish to withdraw the request or exercise data rights.

## 4. Enquiries and future paid work

Give a valid reply address and enough context to understand your request. Submit information you are entitled to share, and keep it accurate to the best of your knowledge. You can correct or withdraw an enquiry by contacting {CONTACT_EMAIL}.

An initial fit review carries no obligation to proceed. Detailed discovery or a diagnostic, implementation and optional ongoing support are scoped separately where appropriate. Sending an enquiry or receiving a recommendation does not by itself order paid services or create an obligation to buy them. Any paid engagement requires a separate agreement covering scope, responsibilities, fees, delivery, third-party costs and support. Feasibility, access to systems and relevant security requirements are reviewed before implementation is agreed. No fixed delivery period or commercial result is promised before the work is understood and agreed.

The enquiry-handling service focuses on managing existing interest and sales administration. Advertising, outbound prospecting and lead generation are separate challenges. Other automation projects can be considered and scoped separately.

Examples, workflow demonstrations and recommendations on this website are illustrative; they are not customer testimonials or independently measured results. They are not a technical specification, a binding quotation, a guarantee that an integration is available, or a promise of savings or other results. Do not give the website credentials or make operational changes solely on the basis of the guide.

The browser assessment uses predefined rules rather than an external AI model. The service pages describe how an agreed customer implementation can use AI to prepare work with human approval. The actual handling of data submitted to this website is described in the Privacy Policy. Pricing, qualification, commitments and sensitive decisions require appropriate human judgement.

## 5. Technical requirements and availability

To read the site you need internet access and a current browser capable of displaying standard HTML and CSS. The interactive guide and enquiry form require JavaScript. The private owner area additionally requires necessary session cookies. A working email address is needed for replies to an enquiry.

Browser settings, extensions, connectivity or assistive technology may affect particular features. If you cannot use the form, contact {CONTACT_EMAIL} and describe the problem. You do not need a third-party booking service to contact us.

We aim to keep the website usable, but maintenance, faults or external service interruptions can make functions temporarily unavailable. Save any important information before leaving or reloading the page. We may make reasonable technical changes to maintain or improve the service. A separate client agreement, if any, governs availability commitments for paid services.

## 6. Acceptable use and security

Use the website lawfully and without interfering with other people or its operation. In particular:

- Do not submit unlawful, threatening, fraudulent or abusive content, spam or malicious code.
- Do not impersonate another person or use contact details you are not entitled to use.
- Do not submit passwords, access tokens, confidential client records or unnecessary sensitive personal data.
- Do not attempt unauthorised access to the owner area, other people's information or the underlying systems.
- Do not bypass abuse controls or generate requests intended to overload or disrupt the service.

We may limit or reject abusive submissions and restrict access where reasonably necessary for security, legal compliance or the protection of others. Automated form protections can also block legitimate requests; contact {CONTACT_EMAIL} if this happens. Restrictions should be proportionate and do not remove any rights you have under mandatory law.

## 7. Content and intellectual property

Website text, visual assets and software may be protected by intellectual-property rights held by us or their respective owners. You may read, save or print information for evaluating our services and use your assessment result for your own internal planning. Other reuse must respect applicable law and any permissions attached to particular material.

You retain the rights you have in information you submit. Sending an enquiry permits us to use that information as necessary to understand and respond to the request, subject to the Privacy Policy. It does not transfer ownership of your materials or authorise us to publish them as a case study.

## 8. Privacy and external links

The Privacy Policy at {WEBSITE_URL}/privacy explains the data collected through the website, the browser-based assessment, the enquiry process, security measures and your data rights. The enquiry acknowledgement confirms that you have read the data-use explanation; it is not marketing consent.

External links may lead to independently operated websites with their own terms and privacy practices. Review those before sharing information with them. We do not control their content or availability, and our obligations for our own website remain unaffected.

## 9. Complaints and problems

Send a complaint about the website or an electronic service to {COMPLAINTS_EMAIL} or {POSTAL_ADDRESS}. Describe the affected feature, what happened, the approximate date and the outcome you seek. Include a reply address, but avoid passwords or unnecessary personal information. Screenshots can be helpful if they do not disclose sensitive details.

We will investigate and respond without undue delay, within any deadline required by applicable law. If further information is needed, we will explain what is required. You may stop using the service while a complaint is considered. This process does not limit your right to seek other remedies available under law.

## 10. Responsibility and mandatory rights

We are responsible for the website in accordance with applicable law. The limits of an illustrative assessment described above do not exclude liability that cannot lawfully be excluded. These terms do not waive consumer rights, rights that Polish law extends to qualifying sole traders, or rights concerning the protection of personal data.

You remain responsible for the accuracy and lawfulness of what you submit and for decisions about your business processes. Any responsibility or allocation of risk for paid work must be agreed separately, subject to mandatory legal protections.

## 11. Changes and applicable law

The revision and update date on this page identify the current terms. We may revise them to reflect changes in the website, its services or legal requirements. Updated terms will be made available here before they apply to new use. A change does not retrospectively alter an agreed paid engagement or remove rights that have already arisen.

Polish law applies to these website services, subject to any mandatory protections that apply under other relevant laws. These terms do not impose an exclusive court or take away any court jurisdiction or remedies available to you under mandatory law.

If a provision cannot legally be applied, the remaining provisions continue to operate to the extent permitted by law. Contact {CONTACT_EMAIL} if any part of these terms is unclear.
$document$,true)
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,
  is_draft=true,version=legal_pages.version+1,updated_at=now();
