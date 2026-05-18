import type { Metadata } from "next";

const APP_URL = "https://courtwatchjamaica.com";

export interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}

export function generateSEO({
  title,
  description,
  path,
  image = "/og-image.png",
  type = "website",
}: SEOProps): Metadata {
  const fullTitle = title.includes("CourtWatch JA")
    ? title
    : `${title} | CourtWatch JA`;
  const canonical = `${APP_URL}${path}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: "CourtWatch JA",
      locale: "en_JM",
      type,
      images: [{ url: image, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
