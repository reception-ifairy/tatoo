import { PublicLanding } from "@/components/public-landing";
import { getBlog } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** Curated one-per-module teaser, with a stable fallback if ids ever change. */
const featuredIds = ["STY-04", "TEC-06", "HIS-09"];

export default async function HomePage() {
  const { articles } = await getBlog();
  const curated = featuredIds
    .map((id) => articles.find((article) => article.id === id))
    .filter((article) => article !== undefined);
  const featured = curated.length === featuredIds.length ? curated : articles.slice(0, 3);

  return <PublicLanding featured={featured} libraryCount={articles.length} />;
}
