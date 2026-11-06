import { z } from "zod";

export const followUpDate = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date between 2000 and 2099.");

export function warsawToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function formatFollowUpDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function followUpLabel(date: string, today: string) {
  return date < today ? "Overdue" : date === today ? "Due today" : "Scheduled";
}
export const deliveryLabels: Record<string, string> = {
  not_required: "Not scheduled (earlier enquiry)",
  pending: "Waiting to send",
  sending: "Sending",
  sent: "Accepted by mail server",
  failed: "Last attempt failed or was interrupted",
};
