const APP_URL = "https://courtwatchjamaica.com";

export interface JudgmentSchemaProps {
  type: "judgment";
  id: number;
  title: string | null;
  caseNumber: string;
  court: string | null;
  judgeName: string | null;
  date: string | null;
  description: string | null;
}

export interface JudgeSchemaProps {
  type: "judge";
  id: number;
  name: string;
  court: string | null;
  totalCases: number;
}

export interface CourtSchemaProps {
  type: "court";
  name: string;
  description: string;
  slug: string;
}

export interface OrganizationSchemaProps {
  type: "organization";
}

export type StructuredDataProps =
  | JudgmentSchemaProps
  | JudgeSchemaProps
  | CourtSchemaProps
  | OrganizationSchemaProps;

function buildSchema(data: StructuredDataProps): Record<string, unknown> {
  switch (data.type) {
    case "judgment":
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: data.title ?? data.caseNumber,
        name: data.title ?? data.caseNumber,
        identifier: data.caseNumber,
        url: `${APP_URL}/cases/${data.id}`,
        ...(data.description && { description: data.description }),
        ...(data.date && { datePublished: data.date }),
        ...(data.judgeName && {
          author: { "@type": "Person", name: data.judgeName },
        }),
        publisher: {
          "@type": "Organization",
          name: "CourtWatch JA",
          url: APP_URL,
        },
        isPartOf: {
          "@type": "Organization",
          name: data.court ?? "Jamaican Courts",
        },
        inLanguage: "en-JM",
      };

    case "judge":
      return {
        "@context": "https://schema.org",
        "@type": "Person",
        name: data.name,
        jobTitle: "Judge",
        url: `${APP_URL}/judges/${data.id}`,
        ...(data.court && {
          worksFor: { "@type": "Organization", name: data.court },
        }),
        description: `${data.name} has ${data.totalCases} judgment${
          data.totalCases !== 1 ? "s" : ""
        } on record in Jamaica's court system.`,
      };

    case "court":
      return {
        "@context": "https://schema.org",
        "@type": "GovernmentOrganization",
        name: data.name,
        description: data.description,
        url: `${APP_URL}/court/${data.slug}`,
        areaServed: { "@type": "Country", name: "Jamaica" },
      };

    case "organization":
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "CourtWatch JA",
        url: APP_URL,
        description:
          "Free Jamaican court case tracker. Search Supreme Court and Court of Appeal judgments, browse upcoming court lists, track cases, and receive notifications.",
        foundingLocation: { "@type": "Country", name: "Jamaica" },
        areaServed: { "@type": "Country", name: "Jamaica" },
      };
  }
}

export default function LegalStructuredData({
  data,
}: {
  data: StructuredDataProps;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema(data)) }}
    />
  );
}
