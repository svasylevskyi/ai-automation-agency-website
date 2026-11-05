import { betterAuth, type BetterAuthOptions } from "better-auth";
import { db } from "./db";
import { env } from "./env";

export function authOptions(): BetterAuthOptions {
  const config = env();
  return {
    appName: "Agency owner area",
    database: db(),
    baseURL: config.APP_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.APP_URL],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    session: {
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    advanced: {
      useSecureCookies: config.APP_URL.startsWith("https:"),
      ipAddress: {
        ipAddressHeaders: config.TRUSTED_IP_HEADER
          ? [config.TRUSTED_IP_HEADER]
          : [],
      },
    },
  };
}
let instance: ReturnType<typeof betterAuth> | undefined;
export function auth() {
  return (instance ??= betterAuth(authOptions()));
}

export async function ownerSession(headers: Headers) {
  const session = await auth().api.getSession({ headers });
  if (!session) return null;
  const owner = await db().query(
    "SELECT user_id FROM site_owner WHERE singleton = true AND user_id = $1",
    [session.user.id],
  );
  return owner.rowCount === 1 ? session : null;
}
