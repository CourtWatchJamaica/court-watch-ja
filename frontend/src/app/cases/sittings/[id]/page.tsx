import type { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import SittingDetailClient from "./SittingDetailClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface CourtSitting {
  id: number;
  case_number: string | null;
  title: string | null;
  judge_name: string | null;
  court_division: string | null;
  event_type: string | null;
  event_date: string | null;
}

async function fetchSitting(id: string): Promise<CourtSitting | null> {
  try {
    const res = await fetch(`${API_BASE}/court-sittings/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data as { sitting: CourtSitting }).sitting ?? null;
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
  const sitting = await fetchSitting(id);

  if (!sitting) {
    return generateSEO({
      title: "Court Sitting",
      description:
        "View a Jamaican court sitting date and details on CourtWatch JA.",
      path: `/cases/sittings/${id}`,
    });
  }

  const name =
    sitting.title ?? sitting.case_number ?? "Court Sitting";
  const division = sitting.court_division ?? "Jamaican court";
  const dateStr = sitting.event_date
    ? new Date(`${sitting.event_date}T00:00:00`).toLocaleDateString("en-JM", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "an upcoming date";

  return generateSEO({
    title: name,
    description: `${division} sitting scheduled for ${dateStr}. Track this case on CourtWatch JA — Jamaica's free court case tracker.`,
    path: `/cases/sittings/${id}`,
  });
}

export default async function SittingDetailPage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SittingDetailClient />;
}
