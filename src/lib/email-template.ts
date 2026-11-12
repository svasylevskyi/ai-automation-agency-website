import { z } from "zod";

// HTML is optional so saved receipts from before this release still send unchanged.
export const emailPayloadSchema = z.object({
  subject: z.string().max(200),
  text: z.string().max(5000),
  html: z.string().max(30000).optional(),
  replyTo: z.email().optional(),
});

export type EmailBrand = {
  name: string;
  tagline?: string;
  contactEmail: string;
  bookingUrl: string;
  logo?: { src: string; width: number; height: number };
};

export function escapeEmailHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function safeLink(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new Error("Email links must use HTTPS outside localhost.");
  return escapeEmailHtml(url.href);
}

export function emailTemplate(input: {
  brand: EmailBrand;
  appUrl: string;
  eyebrow: string;
  title: string;
  preview: string;
  greeting?: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  closing?: string;
  notice: string;
}) {
  const { brand } = input;
  const site = new URL(input.appUrl).origin;
  const siteLink = safeLink(site);
  // Uploaded website logos are already PNG. Use a PNG export for the SVG default;
  // many mail clients cannot display SVG. Never load an arbitrary external image.
  const uploaded = /^\/api\/brand-logo\/[0-9a-f-]{36}$/i.test(
    brand.logo?.src ?? "",
  );
  const logoUrl = safeLink(
    new URL(uploaded ? brand.logo!.src : "/brand/email-mark.png", site).href,
  );
  const scale = uploaded
    ? Math.min(40 / brand.logo!.height, 120 / brand.logo!.width)
    : 1;
  const width = uploaded
    ? Math.max(1, Math.round(brand.logo!.width * scale))
    : 40;
  const height = uploaded
    ? Math.max(1, Math.round(brand.logo!.height * scale))
    : 40;
  const paragraph = (text: string) =>
    `<p style="margin:0 0 18px;color:#685d7b;font-size:16px;line-height:1.65;overflow-wrap:anywhere;">${escapeEmailHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
  // Tables, inline styles, system fonts and a fluid width keep the core layout
  // usable without external CSS, downloaded fonts, or images being enabled.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailHtml(input.eyebrow)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f1fc;font-family:Arial,Helvetica,sans-serif;color:#30234e;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeEmailHtml(input.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f1fc" style="background-color:#f4f1fc;"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;text-align:left;">
<tr><td style="padding:0 12px 20px;font-size:13px;line-height:20px;font-weight:bold;letter-spacing:0.3px;color:#30234e;">${escapeEmailHtml(brand.name)}</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #ded6ec;border-radius:24px;padding:32px 24px;">
<p style="margin:0 0 14px;font-size:11px;line-height:18px;letter-spacing:1.8px;font-weight:bold;text-transform:uppercase;color:#6740b3;">${escapeEmailHtml(input.eyebrow)}</p>
<h1 style="margin:0 0 28px;font-size:32px;line-height:1.15;letter-spacing:-0.8px;font-weight:500;color:#30234e;overflow-wrap:anywhere;">${escapeEmailHtml(input.title)}</h1>
${input.greeting ? `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#30234e;overflow-wrap:anywhere;">${escapeEmailHtml(input.greeting)}</p>` : ""}
${input.paragraphs.map(paragraph).join("\n")}
${input.action ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td bgcolor="#6b48c4" style="background-color:#6b48c4;border-radius:24px;text-align:center;mso-padding-alt:14px 24px;"><a href="${safeLink(input.action.url)}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:14px;line-height:20px;font-weight:bold;text-decoration:none;border:1px solid #6b48c4;border-radius:24px;">${escapeEmailHtml(input.action.label)}</a></td></tr></table>` : ""}
${input.closing ? `<p style="margin:24px 0 20px;font-size:16px;line-height:1.6;color:#30234e;">${escapeEmailHtml(input.closing)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ded6ec;"><tr><td width="${width}" valign="middle" style="width:${width}px;padding-top:24px;"><img src="${logoUrl}" width="${width}" height="${height}" alt="" style="display:block;width:${width}px;height:${height}px;border:0;"></td><td valign="middle" style="padding:24px 0 0 12px;">
<p style="margin:0;font-size:16px;line-height:22px;font-weight:bold;color:#30234e;overflow-wrap:anywhere;">${escapeEmailHtml(brand.name)}</p>
${brand.tagline ? `<p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#685d7b;overflow-wrap:anywhere;">${escapeEmailHtml(brand.tagline)}</p>` : ""}
<p style="margin:6px 0 0;font-size:12px;line-height:18px;"><a href="${siteLink}" style="color:#6740b3;text-decoration:underline;">Visit our website</a></p>
</td></tr></table>
</td></tr><tr><td style="padding:20px 12px 0;font-size:12px;line-height:19px;color:#685d7b;overflow-wrap:anywhere;">${escapeEmailHtml(input.notice)}</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
