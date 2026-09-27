import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { RaidOverlayClient } from "@/components/raid-overlay/RaidOverlayClient";
import { RAIDS_DATA } from "@/lib/raid-overlay-data";
import { type RaidSlug } from "@/store/raid-overlay-store";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const raid = RAIDS_DATA[slug];
  if (!raid) return { title: "Overlay de Raid — SigilOS" };

  return {
    title: `Overlay Raid ${raid.name} — SigilOS`,
    description: `Overlay interactif en jeu pour le ${raid.name} : étapes, stratégies de boss, énigmes et barèmes de score.`,
    robots: { index: false, follow: false },
  };
}

export default async function RaidOverlayPage({ params }: Props) {
  const { slug } = await params;
  const validSlug: RaidSlug = slug === "jardin-eternel" ? "jardin-eternel" : "gigalodon";

  if (!RAIDS_DATA[validSlug]) {
    notFound();
  }

  return (
    <div className="w-screen h-screen bg-[#07090e] overflow-hidden">
      <RaidOverlayClient initialRaidSlug={validSlug} pinned={false} />
    </div>
  );
}
