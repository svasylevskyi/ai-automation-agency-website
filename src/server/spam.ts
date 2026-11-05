import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./http";

const signature = (value: string) =>
  createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update(value)
    .digest("base64url");
export function issueChallenge(now = Date.now()) {
  const payload = `${randomUUID()}.${now}`;
  return `${payload}.${signature(`enquiry:${payload}`)}`;
}
export function verifyChallenge(token: string, now = Date.now()) {
  const [id, issued, mac, ...extra] = token.split(".");
  if (
    extra.length ||
    !id ||
    !/^[0-9a-f-]{36}$/.test(id) ||
    !/^\d{13}$/.test(issued ?? "") ||
    !mac
  )
    throw new HttpError(400, "Please refresh the form and try again.");
  const expected = Buffer.from(signature(`enquiry:${id}.${issued}`));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new HttpError(400, "Please refresh the form and try again.");
  const age = now - Number(issued);
  if (age < 2000)
    throw new HttpError(
      400,
      "Please take a moment to review your enquiry, then send it again.",
    );
  if (age > 3600000)
    throw new HttpError(
      400,
      "This form has expired. Refresh the form and try again.",
    );
  return id;
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const hashed = signature(`limit:${key}`);
  const { rows } = await db().query(
    `INSERT INTO request_limits (key, count, expires_at)
    VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN request_limits.expires_at <= now() THEN 1 ELSE request_limits.count + 1 END,
    expires_at = CASE WHEN request_limits.expires_at <= now() THEN now() + $2 * interval '1 second' ELSE request_limits.expires_at END
    RETURNING count, GREATEST(1, ceil(extract(epoch FROM expires_at - now())))::int AS wait`,
    [hashed, seconds],
  );
  if (rows[0].count > limit)
    throw new HttpError(
      429,
      "Too many attempts. Please try again later.",
      rows[0].wait,
    );
}
export function clientKey(headers: Headers) {
  const header = env().TRUSTED_IP_HEADER;
  // An unconfigured deployment never trusts caller-supplied forwarding headers.
  const address = header ? headers.get(header)?.trim() : undefined;
  return address && isIP(address) ? address : "local-or-unidentified";
}
