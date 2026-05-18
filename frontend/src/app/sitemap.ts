import type { MetadataRoute } from "next";

const APP_URL = "https://courtwatchjamaica.com";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function fetchIds<T>(
  path: string,
  mapper: (item: T) => string,
): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) && typeof data === "object" && data !== null) {
      const values = Object.values(data);
      for (const val of values) {
        if (Array.isArray(val)) return val.map(mapper);
      }
      return [];
    }
    if (Array.isArray(data)) return data.map(mapper);
    return [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${APP_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/auth/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/auth/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/court/supreme-court`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/court/court-of-appeal`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/court/parish-court`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${APP_URL}/judges`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  const [judgmentIds, judgeIds, sittingIds] = await Promise.all([
    fetchIds<{ id: number }>(
      "/judgments?limit=500",
      (j) => String(j.id),
    ),
    fetchIds<{ id: number }>(
      "/judges",
      (j) => String(j.id),
    ),
    fetchIds<{ id: number }>(
      "/court-sittings?limit=200",
      (s) => String(s.id),
    ),
  ]);

  const judgmentRoutes: MetadataRoute.Sitemap = judgmentIds.map((id) => ({
    url: `${APP_URL}/cases/${id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const judgeRoutes: MetadataRoute.Sitemap = judgeIds.map((id) => ({
    url: `${APP_URL}/judges/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const sittingRoutes: MetadataRoute.Sitemap = sittingIds.map((id) => ({
    url: `${APP_URL}/cases/sittings/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...judgmentRoutes, ...judgeRoutes, ...sittingRoutes];
}
