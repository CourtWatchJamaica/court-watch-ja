import type { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import LegalStructuredData from "@/components/LegalStructuredData";
import CourtPageClient from "./CourtPageClient";

const SLUG_TO_COURT: Record<string, string> = {
  "supreme-court": "Supreme Court",
  "court-of-appeal": "Court of Appeal",
  "parish-court": "Parish Court",
};

const COURT_DESCRIPTIONS: Record<string, string> = {
  "Supreme Court":
    "Jamaica's highest court of original jurisdiction — presiding over civil, criminal, and constitutional matters of national significance.",
  "Court of Appeal":
    "The intermediate appellate court reviewing decisions of the Supreme Court, with jurisdiction over the most consequential civil and criminal appeals.",
  "Parish Court":
    "The court of first instance in Jamaica's fourteen parishes, handling everyday civil and criminal matters for communities across the island.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const court = SLUG_TO_COURT[slug];

  if (!court) {
    return generateSEO({
      title: "Jamaican Court",
      description:
        "Browse Jamaica Supreme Court and Court of Appeal judgments on CourtWatch JA.",
      path: `/court/${slug}`,
    });
  }

  return generateSEO({
    title: `${court} — Jamaica`,
    description: `${COURT_DESCRIPTIONS[court]} Browse all judgments, upcoming sittings, and active judges.`,
    path: `/court/${slug}`,
  });
}

export default async function CourtPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const court = SLUG_TO_COURT[slug];

  return (
    <>
      {court && (
        <LegalStructuredData
          data={{
            type: "court",
            name: court,
            description: COURT_DESCRIPTIONS[court],
            slug,
          }}
        />
      )}
      <CourtPageClient />
    </>
  );
}
