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
import { getMonsterStats, getDungeonMonsters } from "@/server/actions/game-data-actions";
import { getBossDofensiveSpells, getDofensiveDungeonForBoss } from "@/server/actions/dofensive-actions";
import { getAnomalyBossBattleMap, getAnomalyBossFamily } from "@/server/actions/anomaly-boss-actions";
import { getBountyFiche } from "@/server/actions/bounty-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { PublicBossDetailClient, type DungeonFamily } from "./_components/PublicBossDetailClient";

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
  const titan = dungeon
    ? null
    : await db.titan.findUnique({
        where: { id: dungeonId },
        select: { name: true, level: true, imageUrl: true, zone: true },
      });
  // 🎯 Avis de recherche (3ᵉ repli) : la fiche publique `MonsterStat` est locale, on n'appelle
  // qu'une lecture SQL pour le titre/description.
  const bounty = dungeon || titan
    ? null
    : await db.bounty.findFirst({
        where: { isBountyMonster: true, OR: [{ id: dungeonId }, { slug: dungeonId }] },
        select: { name: true, level: true, imageUrl: true, zoneName: true },
      });

  const { getServerI18n } = await import("@/lib/i18n/server");
  const { t, locale } = await getServerI18n();

  if (!dungeon && !titan && !bounty) {
    return { title: locale === "en" ? "Boss not found — SigilOS" : "Boss introuvable — SigilOS" };
  }

  const bossName = dungeon ? dungeon.bossName || dungeon.name : bounty ? bounty.name : titan!.name;
  const dungeonLabel = dungeon ? dungeon.name : bounty ? bounty.zoneName || (locale === "en" ? "Wanted Bounty" : "Avis de recherche") : titan!.zone || "Titan";
  const level = dungeon ? dungeon.level : bounty ? bounty.level : titan!.level;
  const imageUrl = dungeon ? dungeon.imageUrl : bounty ? bounty.imageUrl : titan!.imageUrl;
  if (bounty) {
    return {
      title: locale === "en"
        ? `${bossName} (${t.bossPage.levelShort} ${level}) Wanted Bounty: Spells, Hunt Zone & Simulation | SigilOS`
        : `Avis de recherche ${bossName} (Niveau ${level}) : Sorts, Zone de traque & Simulation | SigilOS`,
      description: locale === "en"
        ? `Tactical guide for wanted bounty ${bossName} (${t.bossPage.levelShort.toLowerCase()} ${level}, hunt zone: ${dungeonLabel}): monster spells, ranges, resistances, loot and isometric simulation. 100% free.`
        : `Fiche tactique de l'avis de recherche ${bossName} (niveau ${level}, zone de traque : ${dungeonLabel}) : sorts du monstre, portées, résistances, butin et simulation isométrique. 100% gratuit.`,
      alternates: {
        canonical: `${getAppBaseUrl()}/boss/${dungeonId}`,
      },
      openGraph: {
        title: locale === "en" ? `${bossName} — Wanted Bounty (100% Free) | SigilOS` : `${bossName} — Avis de recherche (100% Gratuit) | SigilOS`,
        description: locale === "en"
          ? `Spells, ranges, resistances and hunt zone for ${bossName}. Free, no account required.`
          : `Sorts, portées, résistances et zone de traque de ${bossName}. Gratuit et sans compte requis.`,
        url: `${getAppBaseUrl()}/boss/${dungeonId}`,
        images: imageUrl ? [{ url: imageUrl }] : [],
      },
    };
  }
  return {
    title: locale === "en"
      ? `${bossName} (${t.bossPage.levelShort} ${level}): Spells, Ranges & Strategy | SigilOS`
      : `${bossName} (Niveau ${level}) : Sorts, Portées & Stratégie | SigilOS`,
    description: locale === "en"
      ? `Complete tactical sheet for ${dungeon ? `boss ${bossName} from dungeon ${dungeonLabel}` : `titan ${bossName} (${dungeonLabel})`}. Isometric spell range simulation, resistances and detachable in-game overlay over Dofus. 100% free.`
      : `Fiche tactique complète pour ${dungeon ? `le boss ${bossName} du donjon ${dungeonLabel}` : `le titan ${bossName} (${dungeonLabel})`}. Simulation isométrique de portée des sorts, résistances et mini-fenêtre overlay détachable par-dessus Dofus. 100% gratuit.`,
    alternates: {
      canonical: `${getAppBaseUrl()}/boss/${dungeonId}`,
    },
    openGraph: {
      title: locale === "en" ? `${bossName} — Boss & Dungeon Sheet (100% Free) | SigilOS` : `${bossName} — Fiche Boss & Donjon (100% Gratuit) | SigilOS`,
      description: locale === "en"
        ? `Spells, ranges, resistances and room monsters for ${bossName}. Free, no account required.`
        : `Sorts, portées, résistances et compo de salle pour ${bossName}. Gratuit et sans compte requis.`,
      url: `${getAppBaseUrl()}/boss/${dungeonId}`,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
  };
}

export default async function PublicBossDetailPage({ params }: PageProps) {
  const { dungeonId } = await params;
  const session = await auth();
  const { getUserContext } = await import("@/server/actions/user-actions");
  const { getServerI18n } = await import("@/lib/i18n/server");
  const [userContext, { t, locale }] = await Promise.all([getUserContext(), getServerI18n()]);

  const dungeon = await db.dungeon.findUnique({
    where: { id: dungeonId },
  });
  const titan = dungeon
    ? null
    : await db.titan.findUnique({ where: { id: dungeonId } });

  // 🎯 Chantier « Avis de recherche » — **3ᵉ repli** (Dungeon → Titan → Avis), même logique que
  // les Titans : un avis n'a ni salle ni carte Dofensive, mais il a une fiche SIPHONNÉE
  // (`Bounty` + `MonsterStat` + carte de repli déclarée) ⇒ **aucun appel réseau** ici.
  const bountyRes = dungeon || titan ? null : await getBountyFiche(dungeonId);
  const bounty = bountyRes?.success ? bountyRes.data! : null;

  if (!dungeon && !titan && !bounty) {
    notFound();
  }

  const isTitan = !dungeon && !bounty && !!titan;
  const isBounty = !dungeon && !titan && !!bounty;
  const bossName = dungeon
    ? dungeon.bossName || dungeon.name
    : isBounty
      ? bounty!.dungeon.bossName
      : titan!.name;
  const dungeonName = dungeon
    ? dungeon.name
    : isBounty
      ? bounty!.dungeon.name
      : titan!.mapName || titan!.zone || titan!.name;
  // 🌀 Boss d'anomalie (« Gardiens des anomalies ») : Dofensive n'expose PAS ces donjons.
  // Sans branchement dédié, la landing publique restait sans carte ⇒ ni « Salle », ni
  // « Placements de départ », ni Placement/Butin (constat user du 15/09/2026).
  const isAnomalyBoss = !!dungeon?.isAnomalyBoss;

  // Avis de recherche : tout est déjà siphonné (fiche + carte) ⇒ on ne rappelle AUCUNE source.
  const [statsRes, spellsRes, familyRes, mapsRes] = await Promise.all([
    isBounty
      ? Promise.resolve({ success: true, data: bounty!.monsterStats })
      : getMonsterStats(bossName, dungeonName, false, undefined, locale),
    isBounty
      ? Promise.resolve({ success: false, data: null })
      : getBossDofensiveSpells(bossName, dungeonName, undefined, false, undefined, locale),
    // « Famille » (monstres accompagnateurs) : pour une anomalie = les autres gardiens de la
    // même carte + les monstres de l'anomalie (Briko/Bruto/Gromo), 100 % local (siphon).
    isBounty
      ? Promise.resolve({ success: false, data: null })
      : isAnomalyBoss
        ? getAnomalyBossFamily(bossName)
        : getDungeonMonsters(bossName, dungeonName),
    // Carte de combat : pour une anomalie, résolution locale puis repli map par défaut ;
    // pour un avis, la grille locale (ou le repli déclaré) fournie par `getBountyFiche`.
    isBounty
      ? Promise.resolve({ success: true, data: bounty!.dungeonMaps })
      : isAnomalyBoss
        ? getAnomalyBossBattleMap(bossName, dungeon!.anomalyMapId)
        : getDofensiveDungeonForBoss(
            bossName,
            dungeonName,
            dungeon
              ? {
                  dofensiveMonsterName: dungeon.dofensiveMonsterName,
                  dofensiveDungeonName: dungeon.dofensiveDungeonName,
                }
              : undefined
          ),
  ]);

  let monsterStats = statsRes.success ? statsRes.data : null;
  const spellsData = spellsRes.success ? spellsRes.data : null;
  if (monsterStats && spellsData) {
    monsterStats = { ...monsterStats, spells: mergeDofensiveSpells(monsterStats.spells ?? [], spellsData) };
  } else if (!monsterStats && spellsData) {
    monsterStats = { name: bossName, spells: spellsData, grades: [], drops: [] };
  }
  const family: DungeonFamily | null = familyRes.success ? ((familyRes.data as DungeonFamily) ?? null) : null;
  const dungeonMaps = mapsRes.success ? mapsRes.data : null;

  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: getAppBaseUrl() },
        { "@type": "ListItem", position: 2, name: t.bossPage.breadcrumbBoss, item: `${getAppBaseUrl()}/boss` },
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
    <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-success/30 landing-theme text-foreground">
      <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

      <JsonLd id="json-ld-boss-detail" nonce={nonce} data={jsonLdData} />

      <main className="boss-detail-shell flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
        {/* Navigation retour */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/boss"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {locale === "en" ? "All bosses & dungeons" : "Tous les boss & donjons"}
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface/60 text-muted-foreground text-[11px] uppercase tracking-wider">
            <Swords className="w-3.5 h-3.5" /> {locale === "en" ? "Tactical simulation" : "Simulation tactique"}
          </span>
        </div>

        {/* Client Boss Detail Client */}
        <PublicBossDetailClient
          dungeon={
            dungeon
              ? {
                  id: dungeon.id,
                  name: dungeon.name,
                  bossName: dungeon.bossName,
                  level: dungeon.level,
                  imageUrl: dungeon.imageUrl,
                  dofensiveUrl: dungeon.dofensiveUrl,
                  dofuspourlesnoobsUrl: dungeon.dofuspourlesnoobsUrl,
                  dofensiveMonsterName: dungeon.dofensiveMonsterName,
                  dofensiveDungeonName: dungeon.dofensiveDungeonName,
                  isAnomalyBoss: !!dungeon.isAnomalyBoss,
                  anomalyMapId: dungeon.anomalyMapId ?? null,
                  kind: "boss" as const,
                }
              : isBounty
                ? bounty!.dungeon
                : {
                    id: titan!.id,
                    name: titan!.mapName || titan!.zone || titan!.name,
                    bossName: titan!.name,
                    level: titan!.level,
                    imageUrl: titan!.imageUrl,
                    dofensiveUrl: titan!.dofensiveUrl,
                    dofuspourlesnoobsUrl: titan!.dofuspourlesnoobsUrl,
                    kind: "titan" as const,
                  }
          }
          monsterStats={monsterStats}
          initialFamily={family}
          initialDungeonMaps={dungeonMaps ?? undefined}
          bountyMeta={bounty?.meta ?? null}
        />
      </main>

      <GalacticFooter isMember={userContext.isMember} />
    </div>
  );
}
