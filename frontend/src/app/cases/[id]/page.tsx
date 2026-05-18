import type { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import LegalStructuredData from "@/components/LegalStructuredData";
import CaseDetailClient from "./CaseDetailClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface Judgment {
  id: number;
  case_number: string;
  title: string | null;
  court: string | null;
  judge_name: string | null;
  date: string | null;
  summary_text: string | null;
}

async function fetchJudgment(id: string): Promise<Judgment | null> {
  try {
    const res = await fetch(`${API_BASE}/judgments/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data as { judgment: Judgment }).judgment ?? null;
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
  const judgment = await fetchJudgment(id);

  if (!judgment) {
    return generateSEO({
      title: "Court Judgment",
      description:
        "View a Jamaican court judgment on CourtWatch JA — free access to Supreme Court and Court of Appeal decisions.",
      path: `/cases/${id}`,
    });
  }

  const name = judgment.title ?? judgment.case_number;
  const court = judgment.court ?? "Jamaican court";
  const desc =
    judgment.summary_text?.slice(0, 155) ??
    `Read the full ${court} judgment for case ${judgment.case_number}.`;

  return generateSEO({
    title: name,
    description: desc,
    path: `/cases/${id}`,
    type: "article",
  });
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const judgment = await fetchJudgment(id);

  return (
    <>
      {judgment && (
        <LegalStructuredData
          data={{
            type: "judgment",
            id: judgment.id,
            title: judgment.title,
            caseNumber: judgment.case_number,
            court: judgment.court,
            judgeName: judgment.judge_name,
            date: judgment.date,
            description: judgment.summary_text,
          }}
        />
      )}
      <CaseDetailClient />
    </>
  );
}
