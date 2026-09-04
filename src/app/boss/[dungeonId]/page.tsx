import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { db } from "@/lib/prisma";
import { getMonsterStats } from "@/server/actions/game-data-actions";
import { getBossDofensiveSpells } from "@/server/actions/dofensive-actions";
import { PublicBossDetailClient } from "./_components/PublicBossDetailClient";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ dungeonId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dungeonId } = await params;
  const dungeon = await db.dungeon.findUnique({
    where: { id: dungeonId },
    select: { name: true, bossName: true, level: true, imageUrl: true },
  });

  if (!dungeon) {
    return { title: "Boss introuvable — SigilOS" };
  }

  const bossName = dungeon.bossName || dungeon.name;
  return {
    title: `${bossName} (Niveau ${dungeon.level}) : Sorts, Portées & Stratégie | SigilOS`,
    description: `Fiche tactique complète pour le boss ${bossName} du donjon ${dungeon.name}. Simulation isométrique de portée des sorts, résistances et mini-fenêtre overlay détachable par-dessus Dofus. 100% gratuit.`,
    alternates: {
      canonical: `${getAppBaseUrl()}/boss/${dungeonId}`,
    },
    openGraph: {
      title: `${bossName} — Fiche Boss & Donjon (100% Gratuit) | SigilOS`,
      description: `Sorts, portées, résistances et compo de salle pour ${bossName}. Gratuit et sans compte requis.`,
      url: `${getAppBaseUrl()}/boss/${dungeonId}`,
      images: dungeon.imageUrl ? [{ url: dungeon.imageUrl }] : [],
    },
  };
}

export default async function PublicBossDetailPage({ params }: PageProps) {
  const { dungeonId } = await params;
  const session = await auth();
  const { getUserContext } = await import("@/server/actions/user-actions");
  const userContext = await getUserContext();

  const dungeon = await db.dungeon.findUnique({
    where: { id: dungeonId },
  });

  if (!dungeon) {
    notFound();
  }

  const bossName = dungeon.bossName || dungeon.name;

  const [statsRes, spellsRes] = await Promise.all([
    getMonsterStats(bossName, dungeon.name),
    getBossDofensiveSpells(bossName, dungeon.name),
  ]);

  const monsterStats = statsRes.success ? statsRes.data : null;
  const spellsData = spellsRes.success ? spellsRes.data : null;

  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: getAppBaseUrl() },
        { "@type": "ListItem", position: 2, name: "Fiches Boss", item: `${getAppBaseUrl()}/boss` },
        {
          "@type": "ListItem",
          position: 3,
          name: bossName,
          item: `${getAppBaseUrl()}/boss/${dungeonId}`,
        },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-amber-500/30 landing-theme text-foreground">
      <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

      <JsonLd id="json-ld-boss-detail" nonce={nonce} data={jsonLdData} />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
        {/* Navigation retour */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/boss"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tous les boss & donjons
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Swords className="w-3.5 h-3.5" /> Simulation Dofensive
          </span>
        </div>

        {/* Client Boss Detail Client */}
        <PublicBossDetailClient
          dungeon={{
            id: dungeon.id,
            name: dungeon.name,
            bossName: dungeon.bossName,
            level: dungeon.level,
            imageUrl: dungeon.imageUrl,
            dofensiveUrl: dungeon.dofensiveUrl,
            dofuspourlesnoobsUrl: dungeon.dofuspourlesnoobsUrl,
          }}
          monsterStats={monsterStats}
          spellsData={spellsData}
        />
      </main>

      <GalacticFooter isMember={userContext.isMember} />
    </div>
  );
}
