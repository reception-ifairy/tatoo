import { InkTelligenceApp } from "@/components/ink-telligence-app";
import { getCompendium } from "@/lib/compendium";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const compendium = await getCompendium();
  return <InkTelligenceApp initialData={compendium} />;
}
