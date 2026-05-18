import type { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import LegalStructuredData from "@/components/LegalStructuredData";
import JudgeDetailClient from "./JudgeDetailClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface Judge {
  id: number;
  name: string;
  court: string | null;
  total_cases?: number;
}

async function fetchJudge(id: string): Promise<{ judge: Judge; judgmentCount: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/judges/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      judge: Judge;
      judgments: unknown[];
    };
    return {
      judge: data.judge,
      judgmentCount: data.judge.total_cases ?? data.judgments?.length ?? 0,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchJudge(id);

  if (!result) {
    return generateSEO({
      title: "Judge Profile",
      description:
        "Browse a Jamaican judge's case history and upcoming sittings on CourtWatch JA.",
      path: `/judges/${id}`,
    });
  }

  const { judge, judgmentCount } = result;
  const court = judge.court ? ` of ${judge.court}` : "";
  return generateSEO({
    title: `${judge.name} — Jamaican Judge Profile`,
    description: `View ${judgmentCount} judgment${judgmentCount !== 1 ? "s" : ""} and case history for ${judge.name}${court}. Browse Jamaica's judicial records on CourtWatch JA.`,
    path: `/judges/${id}`,
  });
}

export default async function JudgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchJudge(id);

  return (
    <>
      {result && (
        <LegalStructuredData
          data={{
            type: "judge",
            id: result.judge.id,
            name: result.judge.name,
            court: result.judge.court,
            totalCases: result.judgmentCount,
          }}
        />
      )}
      <JudgeDetailClient />
    </>
  );
}
