import { cache } from "react";
import { brand as defaults } from "@/config/brand";
import { type SiteSettings, settingsSchema } from "@/lib/validation";
import { db } from "./db";
import { env } from "./env";

export const defaultSettings: SiteSettings = {
  name: defaults.name,
  description: defaults.description,
  tagline: defaults.tagline,
  contactEmail: defaults.contactEmail,
  bookingUrl: defaults.bookingUrl,
  privacyUrl: "",
  showName: true,
  logoId: null,
};
export const getSettings = cache(async () => {
  const { rows } = await db().query(
    "SELECT data, version FROM site_settings WHERE singleton = true",
  );
  if (!rows.length)
    throw new Error("Run npm run db:migrate before starting the website.");
  return {
    settings: settingsSchema.parse(rows[0].data),
    version: rows[0].version as number,
  };
});
export const getBrand = cache(async () => {
  const { settings } = await getSettings();
  let logo = {
    ...defaults.logo,
    src: defaults.logo.src as string,
    width: defaults.logo.width as number,
    height: defaults.logo.height as number,
    showName: settings.showName,
  };
  if (settings.logoId) {
    const { rows } = await db().query(
      "SELECT width, height FROM brand_assets WHERE id = $1",
      [settings.logoId],
    );
    if (rows.length)
      logo = {
        ...logo,
        src: `/api/brand-logo/${settings.logoId}`,
        width: rows[0].width,
        height: rows[0].height,
      };
  }
  return {
    ...defaults,
    ...settings,
    logo,
    icon: logo.src,
    siteUrl: env().INDEX_SITE === "true" ? env().APP_URL : "",
  };
});
export type PublicBrand = Awaited<ReturnType<typeof getBrand>>;
