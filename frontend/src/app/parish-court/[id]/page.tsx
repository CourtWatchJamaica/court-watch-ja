import type { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import ParishCaseClient from "./ParishCaseClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface ParishCourtCase {
  id: number;
  parish: string;
  accused_name: string | null;
  offence: string | null;
  status: string | null;
  week_of: string | null;
}

interface ParishCaseDetail {
  case: ParishCourtCase;
  total_count: number;
}

async function fetchParishCase(id: string): Promise<ParishCaseDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/parish-court/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<ParishCaseDetail>;
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
  const detail = await fetchParishCase(id);

  if (!detail) {
    return generateSEO({
      title: "Parish Court Case",
      description:
        "View a Jamaican Parish Court case record on CourtWatch JA.",
      path: `/parish-court/${id}`,
    });
  }

  const { case: c, total_count } = detail;
  const name = c.accused_name ?? "Unknown";
  const charges = total_count > 1 ? `${total_count} charges` : "1 charge";

  return generateSEO({
    title: `${name} — ${c.parish} Parish Court`,
    description: `${name} faces ${charges} in ${c.parish} Parish Court, Jamaica. View full charge list and case record on CourtWatch JA.`,
    path: `/parish-court/${id}`,
  });
}

export default async function ParishCasePage({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ParishCaseClient />;
}
