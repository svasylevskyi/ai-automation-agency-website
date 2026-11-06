import { statuses } from "./validation";
import { formatFollowUpDate } from "./follow-up";

type Details = {
  from?: keyof typeof statuses;
  to?: keyof typeof statuses;
  action?: string;
  date?: string;
  channel?: string;
  attempt?: number;
  interrupted?: boolean;
  before?: { action: string; date: string };
  after?: { action: string; date: string };
};
const actionText = (value?: { action: string; date: string }) =>
  value?.action && value.date
    ? `${value.action} — ${formatFollowUpDate(value.date)}`
    : "None";
export function describeActivity(kind: string, details: Details) {
  const channel =
    details.channel === "confirmation"
      ? "Visitor confirmation"
      : "Owner notification";
  switch (kind) {
    case "history_started":
      return "History tracking started. Earlier changes are not available.";
    case "received":
      return "Enquiry received.";
    case "status_changed":
      return `Status: ${statuses[details.from!] ?? details.from} → ${statuses[details.to!] ?? details.to}.`;
    case "notes_updated":
      return "Private notes updated. Previous note text is not retained in history.";
    case "follow_up_scheduled":
      return `Follow-up scheduled: ${actionText(details.after)}.`;
    case "follow_up_changed":
      return `Follow-up changed from ${actionText(details.before)} to ${actionText(details.after)}.`;
    case "follow_up_cleared":
      return `Follow-up cleared without marking complete: ${actionText(details.before)}.`;
    case "follow_up_completed":
      return `Follow-up completed: ${actionText({ action: details.action!, date: details.date! })}.`;
    case "mail_attempted":
      return `${channel}: sending attempt ${details.attempt}.`;
    case "mail_sent":
      return `${channel}: accepted by mail server (attempt ${details.attempt}). This does not confirm inbox delivery or that it was read.`;
    case "mail_failed":
      if (details.interrupted)
        return `${channel}: attempt ${details.attempt} was interrupted. Delivery outcome is unknown; automatic retries have stopped.`;
      return `${channel}: attempt ${details.attempt} failed.`;
    default:
      return "Enquiry updated.";
  }
}
