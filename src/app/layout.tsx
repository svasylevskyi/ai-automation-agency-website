import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.name} | Practical AI automation`,
  description: brand.description,
  applicationName: brand.name,
  icons: { icon: brand.icon },
  // Keep review builds out of search until a real domain is configured.
  robots: { index: Boolean(brand.siteUrl), follow: Boolean(brand.siteUrl) },
  ...(brand.siteUrl
    ? { metadataBase: new URL(brand.siteUrl), alternates: { canonical: "/" } }
    : {}),
  openGraph: {
    title: `${brand.name} | Practical AI automation`,
    description: brand.description,
    siteName: brand.name,
    type: "website",
    locale: "en_GB",
  },
};

export const viewport: Viewport = { themeColor: "#f4f1fc" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="orbit">{children}</body>
    </html>
  );
}
