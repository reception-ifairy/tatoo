import { InkTelligenceApp } from "@/components/ink-telligence-app";
import { requireOwner } from "@/lib/auth";
import { getBlog } from "@/lib/blog";
import { getCompendium } from "@/lib/compendium";
import { getHistory } from "@/lib/history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Private Studio — InkTelligence" };

export default async function StudioPage() {
  const owner = await requireOwner();
  const [compendium, history, blog] = await Promise.all([getCompendium(), getHistory(), getBlog()]);
  return <InkTelligenceApp initialData={compendium} initialHistory={history} articles={blog.articles} owner={owner} />;
}
