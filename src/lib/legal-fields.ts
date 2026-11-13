type LegalField = {
  label: string;
  group: string;
  multiline?: boolean;
  help?: string;
};

const definitions: Record<string, LegalField> = {
  LEGAL_NAME: { label: "Registered legal name", group: "Business identity" },
  TRADING_NAME: { label: "Trading name", group: "Business identity" },
  WEBSITE_URL: { label: "Website URL", group: "Business identity" },
  POSTAL_ADDRESS: {
    label: "Business postal address",
    group: "Business identity",
    multiline: true,
  },
  NIP: { label: "NIP", group: "Business identity" },
  REGON: { label: "REGON", group: "Business identity" },
  CONTACT_EMAIL: { label: "General contact email", group: "Contact addresses" },
  PRIVACY_CONTACT_EMAIL: {
    label: "Privacy requests email",
    group: "Contact addresses",
  },
  COMPLAINTS_EMAIL: { label: "Complaints email", group: "Contact addresses" },
  HOSTING_DETAILS: {
    label: "Website hosting",
    group: "Suppliers and processing",
    multiline: true,
  },
  DNS_DETAILS: {
    label: "DNS service",
    group: "Suppliers and processing",
    multiline: true,
  },
  BACKUP_DETAILS: {
    label: "Backup supplier and location",
    group: "Suppliers and processing",
    multiline: true,
  },
  MAIL_DELIVERY_DETAILS: {
    label: "Transactional email delivery",
    group: "Suppliers and processing",
    multiline: true,
  },
  MAILBOX_DETAILS: {
    label: "Business correspondence",
    group: "Suppliers and processing",
    multiline: true,
  },
  AUTOMATION_DETAILS: {
    label: "Current automation and AI use",
    group: "Suppliers and processing",
    multiline: true,
    help: "Update before sending real enquiry data to n8n, OpenAI or another supplier. Saving this wording does not enable or disable integrations.",
  },
  TRANSFER_DETAILS: {
    label: "International transfers and safeguards",
    group: "Suppliers and processing",
    multiline: true,
  },
  ENQUIRY_RETENTION: {
    label: "Closed-enquiry retention",
    group: "Retention",
    multiline: true,
    help: "Match Settings → Retention & backups. Editing this field does not change automatic deletion.",
  },
  OPEN_ENQUIRY_REVIEW: {
    label: "Open-enquiry review",
    group: "Retention",
    multiline: true,
  },
  CORRESPONDENCE_RETENTION: {
    label: "Mailbox correspondence retention",
    group: "Retention",
    multiline: true,
  },
  MAIL_DELIVERY_RETENTION: {
    label: "Email-provider retention",
    group: "Retention",
    multiline: true,
  },
  BACKUP_RETENTION: {
    label: "Backups and deletion records",
    group: "Retention",
    multiline: true,
  },
  LOG_RETENTION: {
    label: "Website and security log retention",
    group: "Retention",
    multiline: true,
    help: "Not yet confirmed. Check the live server's logging/rotation configuration, then enter its actual period or criteria. Keep the policy as a draft until this is complete.",
  },
};

export function legalField(key: string): LegalField {
  return (
    definitions[key] ?? {
      label: key.replaceAll("_", " "),
      group: "Additional details",
      multiline: true,
    }
  );
}
