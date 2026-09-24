"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Swords,
  Shield,
  Zap,
  Layers,
  Users,
  ArrowRight,
  Target,
  Flame,
  Gem,
  Loader2,
  MapPin,
  Check,
  Info,
  Compass,
  Crown,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { getMonsterStats, getDungeonMonsters } from "@/server/actions/game-data-actions";
import {
  getBossDofensiveSpells,
  getDofensiveDungeonForBoss,
  type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { deriveDofensiveMonsterName } from "@/lib/dofensive-boss";
import { getWorldName } from "@/lib/dofus-assets";
import { DungeonMinimapCard } from "./DungeonMinimapCard";
import { getAnomalyBossBattleMap, getAnomalyBossFamily } from "@/server/actions/anomaly-boss-actions";
import { getBountyBattleMap } from "@/server/actions/bounty-actions";
import type { BountyPublicMeta } from "@/lib/bounty-fiche";

interface PublicDungeon {
  id: string;
  name: string;
  bossName?: string | null;
  level?: number | null;
  imageUrl?: string | null;
  dofensiveUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  dofensiveMonsterName?: string | null;
  dofensiveDungeonName?: string | null;
  /* 🌀 Chantier « boss d'anomalie » — carte de combat + famille siphonnées localement. */
  isAnomalyBoss?: boolean | null;
  anomalyMapId?: number | null;
  /* 🎯 Chantier « Avis de recherche » — 3ᵉ type de fiche (ni donjon, ni titan). */
  kind?: "boss" | "titan" | "bounty";
}

interface FamilyMember {
  id: number;
  name: string;
  imageUrl: string | null;
  isBoss: boolean;
  /** 🌀 Monstre de l'anomalie (Briko/Bruto/Gromo) — 3 tirés au hasard par combat. */
  isCompanion?: boolean;
  level?: number | null;
  raceName?: string | null;
}

export interface DungeonFamily {
  familyId: number | null;
  monsters: FamilyMember[];
  /** Monstres de l'anomalie uniquement (accompagnateurs) — sous-ensemble de `monsters`. */
  companions?: FamilyMember[];
  /** « 3 au hasard parmi 16 » (fourni par la source siphonnée). */
  companionHint?: string | null;
}

interface PublicBossDetailClientProps {
  dungeon: PublicDungeon;
  monsterStats?: any;
  initialFamily?: DungeonFamily | null;
  initialDungeonMaps?: DofensiveDungeonInfo | null;
  /** 🎯 Avis de recherche : zone de traque, prime, critères de quête, repli de carte déclaré. */
  bountyMeta?: BountyPublicMeta | null;
}

function MonsterImage({
  src,
  alt = "",
  className = "",
  monsterId,
  assetId,
  assetType = "monsters",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  monsterId?: number | string;
  assetId?: number | string;
  assetType?: "monsters" | "items" | "spells";
}) {
  const targetId = monsterId ?? assetId;
  const initialSrc = targetId
    ? `/api/assets-dofus/${assetType}/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ""}`
    : src || null;
  const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = targetId
      ? `/api/assets-dofus/${assetType}/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ""}`
      : src || null;
    setCurrentSrc(next);
    setFailed(false);
  }, [src, targetId, assetType]);

  if (!currentSrc || failed) {
    return (
      <span className={cn("inline-flex items-center justify-center text-muted-foreground/40 bg-background", className)}>
        <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
      </span>
    );
  }
  return (
    <img src={currentSrc} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
  );
}

type DetailTab = "sorts" | "overview" | "sim" | "grades" | "loot" | "family";

export function PublicBossDetailClient({
  dungeon,
  monsterStats: initialStats,
  initialFamily,
  initialDungeonMaps,
  bountyMeta,
}: PublicBossDetailClientProps) {
  const bossName = dungeon.bossName || dungeon.name;
  const isTitan = dungeon.kind === "titan";
  // 🎯 Avis de recherche : ni donjon ni titan — pas de salle, pas de carte Dofensive, mais une
  // zone de traque, une prime (curée dans God) et des critères de quête SIPHONNÉS.
  const isBounty = dungeon.kind === "bounty";
  // 🌀 Boss d'anomalie : Dofensive n'expose pas ces donjons ⇒ carte + famille sont résolues
  // LOCALEMENT (lecteurs dédiés) au lieu du resolver Dofensive standard.
  const isAnomalyBoss = !!dungeon.isAnomalyBoss;
  const { openBossOverlay } = useBossOverlay("public");

  const [detailTab, setDetailTab] = useState<DetailTab>("sorts");
  const [activeMonsterName, setActiveMonsterName] = useState<string | null>(null);
  const [activeGradeIndex, setActiveGradeIndex] = useState<number | null>(null);
  const [selectedSpellId, setSelectedSpellId] = useState<number | undefined>(
    initialStats?.spells?.[0]?.id
  );
  const [statsByKey, setStatsByKey] = useState<Record<string, any>>(
    initialStats ? { [dungeon.id]: initialStats } : {}
  );
  const [loadingByKey, setLoadingByKey] = useState<Record<string, boolean>>({});
  const [familyByDungeon, setFamilyByDungeon] = useState<Record<string, DungeonFamily>>(
    initialFamily ? { [dungeon.id]: initialFamily } : {}
  );
  const [mapsByBoss, setMapsByBoss] = useState<Record<string, DofensiveDungeonInfo | null>>(
    initialDungeonMaps !== undefined ? { [bossName]: initialDungeonMaps } : {}
  );
  const [selectedDrop, setSelectedDrop] = useState<any>(null);
  const [copiedTravel, setCopiedTravel] = useState(false);
  const [expandedSpells, setExpandedSpells] = useState<Record<number, boolean>>({});

  const toggleSpellExpanded = (id: number) => {
    setExpandedSpells((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const entityKey = activeMonsterName ? `${dungeon.id}::${activeMonsterName}` : dungeon.id;
  const currentStats = statsByKey[entityKey];
  const isLoadingCurrent = !!loadingByKey[entityKey] && !currentStats;
  const grades: any[] = currentStats?.grades ?? [];
  const gradeIdx = activeGradeIndex ?? (grades.length > 0 ? grades.length - 1 : 0);
  const activeGrade = grades.length > 0 ? grades[Math.min(gradeIdx, grades.length - 1)] : null;
  const spells: any[] = currentStats?.spells ?? [];
  const drops: any[] = currentStats?.drops ?? [];
  const roomMonsters = familyByDungeon[dungeon.id]?.monsters ?? [];
  const hasRoomMonsters = roomMonsters.length > 1;
  const activeBossKey = activeMonsterName ?? bossName;
  const dungeonMaps = mapsByBoss[activeBossKey];

  // Reset quand on change de fiche.
  useEffect(() => {
    setActiveMonsterName(null);
    setActiveGradeIndex(null);
    setDetailTab("sorts");
    setSelectedSpellId(initialStats?.spells?.[0]?.id);
    setStatsByKey(initialStats ? { [dungeon.id]: initialStats } : {});
    setFamilyByDungeon(initialFamily ? { [dungeon.id]: initialFamily } : {});
    setMapsByBoss(initialDungeonMaps !== undefined ? { [bossName]: initialDungeonMaps } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon.id]);

  // Lazy-load stats de l'entité active (boss ou monstre de salle).
  useEffect(() => {
    if (statsByKey[entityKey] || loadingByKey[entityKey]) return;
    let cancelled = false;
    setLoadingByKey((p) => ({ ...p, [entityKey]: true }));
    const target = activeMonsterName ?? bossName;
    getMonsterStats(target, dungeon.name, false, undefined, locale)
      .then(async (res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          let data = res.data;
          try {
            const dRes = await getBossDofensiveSpells(target, dungeon.name, undefined, false, undefined, locale);
            if (!cancelled && dRes.success && dRes.data) {
              data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
            }
          } catch { /* sorts locaux conservés */ }
          if (!cancelled) {
            setStatsByKey((p) => ({ ...p, [entityKey]: data }));
            setSelectedSpellId((prev) => prev ?? data.spells?.[0]?.id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingByKey((p) => ({ ...p, [entityKey]: false }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  // Lazy-load famille si absente (rare : la page serveur la pré-charge déjà).
  // 🌀 Anomalie : les « monstres de la salle » viennent du siphon local (co-gardiens + 3
  // accompagnateurs au hasard) et non du donjon Dofensive (inexistant pour une anomalie).
  useEffect(() => {
    if (isBounty || familyByDungeon[dungeon.id]) return;
    let cancelled = false;
    const request = isAnomalyBoss
      ? getAnomalyBossFamily(bossName)
      : getDungeonMonsters(bossName, dungeon.name);
    request
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setFamilyByDungeon((p) => ({ ...p, [dungeon.id]: res.data as DungeonFamily }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon.id]);

  // Lazy-load maps Dofensive pour l'entité active.
  // 🌀 Anomalie : carte de combat résolue LOCALEMENT (siphon) — sans ce branchement la landing
  // publique n'exposait ni sélecteur de « Salle », ni « Placements de départ », ni
  // Placement/Butin (constat user du 15/09/2026).
  useEffect(() => {
    // 🎯 Avis de recherche : la carte (grille locale ou repli déclaré) est pré-chargée par la
    // page serveur (`initialDungeonMaps`) — on ne rappelle AUCUNE source ici.
    if (isBounty) return;
    if (mapsByBoss[activeBossKey] !== undefined) return;
    let cancelled = false;
    const isMain = !activeMonsterName;
    const resolution = isAnomalyBoss
      ? getAnomalyBossBattleMap(activeBossKey, dungeon.anomalyMapId)
      : getDofensiveDungeonForBoss(
          activeBossKey,
          dungeon.name,
          isMain
            ? {
                dofensiveMonsterName: dungeon.dofensiveMonsterName,
                dofensiveDungeonName: dungeon.dofensiveDungeonName,
              }
            : undefined
        );
    resolution
      .then((res) => {
        if (!cancelled) setMapsByBoss((p) => ({ ...p, [activeBossKey]: res.success && res.data ? res.data : null }));
      })
      .catch(() => {
        if (!cancelled) setMapsByBoss((p) => ({ ...p, [activeBossKey]: null }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon.id, activeMonsterName]);

  // Re-fetch sorts Dofensive quand le grade change (données de combat PAR GRADE).
  useEffect(() => {
    if (activeGradeIndex === null) return;
    if (!grades.length) return;
    const gradeNumber = activeGradeIndex + 1;
    let cancelled = false;
    getBossDofensiveSpells(
      activeMonsterName ?? bossName,
      dungeon.name,
      gradeNumber,
      false,
      !activeMonsterName
        ? {
            dofensiveMonsterName: dungeon.dofensiveMonsterName,
            dofensiveDungeonName: dungeon.dofensiveDungeonName,
          }
        : undefined,
      locale
    )
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        setStatsByKey((prev) => {
          const cur = prev[entityKey];
          if (!cur) return prev;
          return { ...prev, [entityKey]: { ...cur, spells: mergeDofensiveSpells(cur.spells ?? [], res.data) } };
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dungeon.id, activeMonsterName, activeGradeIndex]);

  const selectMonster = (m: FamilyMember) => {
    if (m.isBoss || m.name === bossName) {
      setActiveMonsterName(null);
    } else {
      setActiveMonsterName(m.name);
    }
    setActiveGradeIndex(null);
    setSelectedSpellId(undefined);
  };

  const { t, locale } = useI18n();

  const tabs = (
    [
      { id: "sorts", label: locale === "en" ? `${isTitan ? "Titan" : isBounty ? "Bounty Monster" : "Boss"} Spells` : `Sorts du ${isTitan ? "Titan" : isBounty ? "monstre recherché" : "Boss"}`, asset: "/assets/dofus/modules/spells.png" },
      { id: "overview", label: locale === "en" ? "Detailed Spells" : "Sorts Détaillés", asset: "/assets/dofus/icons/crossedSwords.png" },
      { id: "sim", label: locale === "en" ? "Tactical Simulation" : "Simulation Tactique", asset: "/assets/dofus/modules/map.png" },
      { id: "grades", label: locale === "en" ? `Grades & Tiers (${grades.length})` : `Grades & Paliers (${grades.length})`, asset: "/assets/dofus/modules/character.png", hidden: grades.length <= 1 },
      { id: "loot", label: locale === "en" ? "Loot & Drops" : "Butin & Drops", asset: "/assets/dofus/modules/chest.png" },
      { id: "family", label: locale === "en" ? `Room Monsters (${roomMonsters.length})` : `Monstres de la salle (${roomMonsters.length})`, asset: "/assets/dofus/modules/party.png", hidden: !hasRoomMonsters },
    ] as { id: DetailTab; label: string; asset: string; hidden?: boolean }[]
  ).filter((t) => !t.hidden);

  const resists = activeGrade?.resists || {};
  const coords = currentStats?.coordinates as { x: number; y: number; worldMapId?: number } | null | undefined;
  const travelCmd = coords ? `/travel ${coords.x} ${coords.y}` : null;
  const resolvedBossName =
    dungeon.dofensiveMonsterName ?? (activeMonsterName ?? deriveDofensiveMonsterName(bossName) ?? bossName);

  return (
    <div className="space-y-6">
      {/* ── EN-TÊTE ──────────────────────────────────────────────────────────
          Action (overlay) posée à droite, puis deux colonnes qui démarrent sur la
          même ligne : (1) qui est l’entité — identité, entrée du donjon, PV/PA/PM,
          résistances ; (2) où se trouve son donjon — carte statique 5×3 cliquable. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => openBossOverlay({ monsterName: activeMonsterName ?? bossName, dungeonName: dungeon.name })}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground/90 px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground"
            title={locale === "en" ? "Displays a detachable mini-window over your Dofus game" : "Affiche une mini-fenêtre par-dessus votre jeu Dofus"}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.bossPage.overlayButton}</span>
          </button>
        </div>

        <div className={cn("grid gap-4", coords && "lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start")}>
          {/* ── Colonne gauche : identité, entrée du donjon, caractéristiques ── */}
          <div className="min-w-0 space-y-3.5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-lg border border-border bg-background/60 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                <MonsterImage
                  src={currentStats?.imageUrl ?? dungeon.imageUrl}
                  alt={activeMonsterName ?? bossName}
                  monsterId={currentStats?.id}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {isTitan ? "Titan" : isBounty ? (bountyMeta?.raceName ?? (locale === "en" ? "Wanted Bounty" : "Avis de recherche")) : (locale === "en" ? "Dungeon Boss" : "Boss de donjon")}
                  <span className="font-mono normal-case">{t.bossPage.levelShort} {dungeon.level ?? 200}</span>
                </p>
                <h1 className="mt-0.5 truncate text-2xl font-semibold text-foreground sm:text-3xl">
                  {activeMonsterName ?? bossName}
                </h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Compass className="w-3.5 h-3.5 opacity-70" />
                  {isBounty ? (locale === "en" ? "Hunt Zone:" : "Zone de traque :") : (locale === "en" ? "Dungeon:" : "Donjon :")}{" "}
                  <span className="text-foreground/90">{dungeon.name}</span>
                </p>
              </div>
            </div>

            {/* Entrée du donjon : coordonnées copiables (clic) + zone. */}
            {coords && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    if (!travelCmd) return;
                    navigator.clipboard.writeText(travelCmd).then(() => {
                      setCopiedTravel(true);
                      window.setTimeout(() => setCopiedTravel(false), 2000);
                    }).catch(() => {});
                  }}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-border-strong text-foreground transition-colors cursor-pointer"
                  title={t.bossPage.copyTravelTitle}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span>
                    {t.bossPage.dungeonEntrance}{" "}
                    <strong className="font-mono text-foreground/90">
                      [{coords.x}, {coords.y}]
                    </strong>
                  </span>
                  {copiedTravel ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-mono">
                      {travelCmd}
                    </span>
                  )}
                </button>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t.bossPage.zoneLabel}{" "}
                  <strong className="text-foreground">{getWorldName(coords.worldMapId, locale)}</strong>
                </span>
              </div>
            )}

            {/* Caractéristiques : PV / PA / PM en cartes, résistances dans un encadré. */}
            {isLoadingCurrent ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-3.5 py-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Chargement des caractéristiques de {activeMonsterName ?? bossName}…</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-2" title={t.bossPage.stats.hp}>
                    <span className="flex items-baseline gap-1.5">
                      <img src="/assets/dofus/stats/pv.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                      <span className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
                        {activeGrade ? activeGrade.lifePoints?.toLocaleString(locale === "en" ? "en-US" : "fr-FR") : "—"}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">{t.bossPage.stats.hpShort}</span>
                    </span>
                  </div>
                  <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-2" title={t.bossPage.stats.ap}>
                    <span className="flex items-baseline gap-1.5">
                      <img src="/assets/dofus/stats/pa.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                      <span className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{activeGrade?.actionPoints ?? "—"}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{t.bossPage.stats.ap}</span>
                    </span>
                  </div>
                  <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-2" title={t.bossPage.stats.mp}>
                    <span className="flex items-baseline gap-1.5">
                      <img src="/assets/dofus/stats/pm.png" alt="" className="w-4 h-4 shrink-0 self-center object-contain" />
                      <span className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{activeGrade?.movementPoints ?? "—"}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{t.bossPage.stats.mp}</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-2.5">
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t.bossPage.resistance}</span>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {(
                        [
                          { key: "neutral", label: t.bossPage.stats.neutral, icon: "/assets/dofus/stats/resNeutre.png", value: resists.neutral ?? 0 },
                          { key: "earth", label: t.bossPage.stats.earth, icon: "/assets/dofus/stats/resTerre.png", value: resists.earth ?? 0 },
                          { key: "fire", label: t.bossPage.stats.fire, icon: "/assets/dofus/stats/resFeu.png", value: resists.fire ?? 0 },
                          { key: "water", label: t.bossPage.stats.water, icon: "/assets/dofus/stats/resEau.png", value: resists.water ?? 0 },
                          { key: "air", label: t.bossPage.stats.air, icon: "/assets/dofus/stats/resAir.png", value: resists.air ?? 0 },
                        ] as const
                      ).map(({ key, label, icon, value }) => (
                        <span key={key} className="inline-flex items-center gap-1.5" title={label + " %"}>
                          <img src={icon} alt="" className="w-4 h-4 object-contain" />
                          <span
                            className={cn(
                              "font-mono text-[13px] tabular-nums",
                              value < 0 ? "text-rose-400" : "text-foreground/85"
                            )}
                          >
                            {value}%
                          </span>
                          <span className="hidden text-[11px] text-muted-foreground sm:inline">{label}</span>
                        </span>
                      ))}
                    </div>
                    {grades.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDetailTab("grades")}
                        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title={locale === "en" ? "Open grades & tiers tab" : "Ouvrir l'onglet des grades & paliers"}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span className="font-mono">
                          {grades.length === 5 ? `${locale === "en" ? "loot" : "butin"} ${4 + gradeIdx}` : `${locale === "en" ? "grade" : "grade"} ${1 + gradeIdx}`}
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Colonne droite : où se trouve le donjon (carte statique 5×3) ── */}
          {coords && (
            <DungeonMinimapCard
              x={coords.x}
              y={coords.y}
              worldMapId={coords.worldMapId}
              title={t.bossPage.minimapTitle}
              placeName={dungeon.name}
              openLabel={t.bossPage.minimapOpen}
            />
          )}
        </div>
      </div>

      {/* ── BANDEAU « AVIS DE RECHERCHE » ─────────────────────────────────────
          100 % SIPHONNÉ (DofusDB + Dofensive) + champs curés dans God : zone de traque,
          prime, critères de quête et — quand la grille n'est pas exposée par la source —
          la mention explicite que la simulation tourne sur une **carte générique**. */}
      {isBounty && bountyMeta && (
        <div className="mt-4 grid gap-2.5 rounded-xl border border-border bg-surface/50 p-3.5 text-xs sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
              <Target className="w-3 h-3" /> {bountyMeta.raceName}
            </span>
            {bountyMeta.zone && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Compass className="w-3.5 h-3.5 opacity-70" /> Zone de traque :{" "}
                <strong className="font-medium text-foreground/90">{bountyMeta.zone}</strong>
              </span>
            )}
            {bountyMeta.travelCommand && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(bountyMeta.travelCommand as string)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                title="Copier la commande de trajet"
              >
                <MapPin className="w-3 h-3" /> {bountyMeta.travelCommand}
              </button>
            )}
            {bountyMeta.milice && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Shield className="w-3.5 h-3.5 opacity-70" /> {bountyMeta.milice}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {bountyMeta.rewards.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Gem className="w-3.5 h-3.5 opacity-70" /> Prime :{" "}
                <strong className="font-medium text-foreground/90">
                  {bountyMeta.rewards.map((r) => `${r.amount > 0 ? `${r.amount} ` : ""}${r.type}`).join(" + ")}
                </strong>
              </span>
            )}
            {bountyMeta.battleMapLabel && (
              <span
                className="inline-flex items-center gap-1.5 text-muted-foreground"
                title="Aucune carte de combat n'est exposée pour un avis (Dofensive ne publie que les salles de donjon) : la simulation utilise la grille vide, sans décor trompeur."
              >
                <Info className="w-3.5 h-3.5" /> Simulation : {bountyMeta.battleMapLabel}
              </span>
            )}
          </div>

          {bountyMeta.criteria.length > 0 && (
            <p className="sm:col-span-2 text-muted-foreground">
              <span className="text-foreground/70">Critères de chasse :</span> {bountyMeta.criteria.join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:col-span-2">
            {bountyMeta.dofensiveUrl && (
              <a href={bountyMeta.dofensiveUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                Source Dofensive
              </a>
            )}
            {bountyMeta.dpnlUrl && (
              <a href={bountyMeta.dpnlUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                Dofus Pour Les Noobs
              </a>
            )}
            {bountyMeta.syncedAt && (
              <span>Données synchronisées le {new Date(bountyMeta.syncedAt).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLETS ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border">
        {tabs.map((tab) => {
          const isActive = detailTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs transition-colors whitespace-nowrap border-b-2 -mb-px cursor-pointer",
                isActive
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tab.asset} alt="" className={cn("w-4 h-4 object-contain", !isActive && "opacity-60")} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── PANNEAU D'ONGLET ───────────────────────────────────────────────── */}
      <div className="min-h-[560px] [overflow-anchor:none]">
      {/* ── TAB: SORTS DU BOSS (mécaniques clés) ── */}
      {detailTab === "sorts" && (
        <div className="space-y-4">
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {t.bossPage.noSpellsFound}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 opacity-70" /> {t.bossPage.keyMechanics}
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {t.bossPage.spellsToAnticipate.replace("{count}", String(spells.length))}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {spells.slice(0, 6).map((spell: any) => (
                  <div key={spell.id} className="rounded-xl bg-surface/50 border border-border/70 p-3.5 flex flex-col justify-between hover:border-border transition-colors">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-xs">
                          {spell.imageUrl ? (
                            <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-full h-full object-contain" />
                          ) : (
                            <Zap className="w-4 h-4 opacity-70" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-sm font-bold text-foreground truncate">{locale === "en" ? (spell.nameEn || spell.name) : spell.name}</h5>
                          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-0.5">
                              <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain inline" />
                              {spell.apCost || 0}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain inline" />
                              {spell.minRange === spell.range ? `${spell.range}` : `${spell.minRange ?? 0}-${spell.range ?? 0}`}
                            </span>
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-1">
                        {spell.effectDetails?.[0]?.label ?? (Array.isArray(spell.effects) ? spell.effects[0] : null) ?? spell.description ?? (locale === "en" ? "Combat effect." : "Effet de combat.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedSpellId(spell.id); setDetailTab("sim"); }}
                      className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground self-start transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5" /> {t.bossPage.viewRange}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: SORTS DÉTAILLÉS ── */}
      {detailTab === "overview" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 opacity-70" />
            <h4 className="text-sm font-bold text-foreground">
              {t.bossPage.allSpellsTitle.replace("{count}", String(spells.length))}
            </h4>
          </div>
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">{t.bossPage.noSpellsDetailed}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {spells.map((spell: any) => {
                const isExpanded = !!expandedSpells[spell.id];
                const details = spell.effectDetails?.length > 0
                  ? spell.effectDetails
                  : (Array.isArray(spell.effects) ? spell.effects.slice(0, 20).map((e: string) => ({ label: e, duration: null, triggers: [] as string[], masks: [] as string[] })) : []);
                const criticals = Array.isArray(spell.criticalEffects) ? spell.criticalEffects : [];
                const hasBody = details.length > 0 || spell.description || criticals.length > 0 || spell.hasCriticalEffects === false;

                return (
                  <div key={spell.id} className="p-3.5 rounded-xl bg-surface/50 border border-border/70 flex flex-col space-y-2 hover:border-border transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => hasBody && toggleSpellExpanded(spell.id)}
                        className={cn("flex items-center gap-2.5 text-left flex-1 min-w-0", hasBody && "cursor-pointer group")}
                        title={hasBody ? (isExpanded ? (locale === "en" ? "Collapse details" : "Replier les détails") : (locale === "en" ? "Expand details" : "Déplier les détails")) : undefined}
                      >
                        {spell.imageUrl ? (
                          <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-8 h-8 object-contain rounded-lg bg-background border border-border p-0.5 shrink-0" />
                        ) : (
                          <Zap className="w-4 h-4 opacity-70 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="block text-sm font-bold text-foreground truncate group-hover:text-warning transition-colors">
                              {locale === "en" ? (spell.nameEn || spell.name) : spell.name}
                            </span>
                            {spell.grade !== undefined && (
                              <span className="text-[11px] font-mono text-muted-foreground bg-background border border-border px-1 py-px rounded shrink-0">
                                {t.bossPage.levelShort} {spell.grade}
                              </span>
                            )}
                            {hasBody && (
                              <span className="text-muted-foreground group-hover:text-foreground transition-colors ml-0.5">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                            <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain inline" />
                            <span>{spell.apCost || 0}</span>
                            <span>·</span>
                            <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain inline" />
                            <span>{spell.minRange === spell.range ? `${spell.range}` : `${spell.minRange ?? 0}-${spell.range ?? 0}`}</span>
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedSpellId(spell.id); setDetailTab("sim"); }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                      >
                        {t.bossPage.simulateSpell}
                      </button>
                    </div>

                    {isExpanded && hasBody && (
                      <div className="pt-2 border-t border-border/60 space-y-2 text-[11px] leading-relaxed">
                        {spell.description && <p className="text-muted-foreground">{spell.description}</p>}
                        {details.length > 0 && (
                          <div className="space-y-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t.bossPage.mainEffect}
                            </span>
                            <ul className="space-y-1">
                              {details.map((det: any, i: number) => (
                                <li key={i} className="text-muted-foreground">
                                  <span className="text-foreground font-medium">{det.label}{det.duration ? ` (${det.duration})` : ""}</span>
                                  {det.masks?.length > 0 && <span className="block text-muted-foreground/80">{det.masks.join(" · ")}</span>}
                                  {det.triggers?.length > 0 && (
                                    <span className="block text-muted-foreground/80 flex items-center gap-1">
                                      <Zap className="w-3 h-3 shrink-0 opacity-70" />{det.triggers.join(" · ")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {spell.hasCriticalEffects === false ? (
                          <p className="text-muted-foreground/80">{t.bossPage.noCriticalEffects}</p>
                        ) : criticals.length > 0 ? (
                          <div className="space-y-0.5 pt-1 border-t border-border">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t.bossPage.criticalEffects}
                            </span>
                            <ul className="space-y-0.5">
                              {criticals.map((ce: string, k: number) => (
                                <li key={k} className="text-muted-foreground">• {ce}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET SIMULATION ──────────────────────────────────────────────── */}
      {detailTab === "sim" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/dofus/modules/map.png" alt="" className="w-4 h-4 object-contain opacity-80" />
              {t.bossPage.tabs.simulation}
            </h4>
            {hasRoomMonsters && (
              <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background/40 p-1">
                <span className="hidden shrink-0 px-1.5 text-[11px] text-muted-foreground sm:inline">{locale === "en" ? "Entity:" : "Entité :"}</span>
                {roomMonsters.map((m) => {
                  const isActive = (activeMonsterName ?? bossName) === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMonster(m)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
                        isActive
                          ? "bg-white/[0.10] text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m.imageUrl && <MonsterImage src={m.imageUrl} alt="" monsterId={m.id} className="h-3 w-3 object-contain" />}
                      {m.isBoss && <Crown className="h-3 w-3 text-amber-300/80" />}
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {spells.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {locale === "en" ? "No spells available for simulation." : "Aucun sort disponible pour la simulation."}
            </p>
          ) : (
            <SpellRangeGrid
              spells={spells}
              activeSpellId={selectedSpellId}
              onSelectSpell={(s) => setSelectedSpellId(s.id)}
              bossName={locale === "en" ? (currentStats?.nameEn || resolvedBossName) : resolvedBossName}
              bossImageUrl={currentStats?.imageUrl ?? dungeon.imageUrl ?? undefined}
              dungeonMaps={dungeonMaps?.maps}
              dungeonName={dungeonMaps?.dungeonName ?? dungeon.name}
              grades={grades.map((g: any) => ({ level: g.level }))}
              activeGradeIndex={activeGradeIndex ?? (grades.length - 1)}
              onGradeChange={(idx) => setActiveGradeIndex(idx)}
              monsters={roomMonsters}
              entityScale={isTitan ? 4 : 1}
              allowFreeCasterMove
            />
          )}
        </div>
      )}

      {/* ── TAB: GRADES & PALIERS ── */}
      {detailTab === "grades" && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dofus/modules/character.png" alt="" className="w-4 h-4 object-contain opacity-80" /> {t.bossPage.gradesTitle}
          </h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> {t.bossPage.gradesDesc}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {grades.map((gr: any, idx: number) => {
              const isActive = (activeGradeIndex ?? grades.length - 1) === idx;
              const label = grades.length === 5 ? `${locale === "en" ? "Loot" : "Butin"} ${4 + idx}` : `Grade ${idx + 1}`;
              const r = gr.resists || {};
              return (
                <div key={idx} className={cn("p-3.5 rounded-xl border transition-colors flex flex-col justify-between space-y-3", isActive ? "border-border-strong bg-surface/80 shadow-xs" : "border-border/60 bg-surface/40 hover:border-border")}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-sm font-bold text-foreground">{label}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground">
                        {t.bossPage.levelShort} {gr.level}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>{t.bossPage.stats.hp} :</span>
                        <strong className="text-foreground font-mono tabular-nums text-right">
                          {gr.lifePoints?.toLocaleString(locale === "en" ? "en-US" : "fr-FR")}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>{t.bossPage.stats.ap} / {t.bossPage.stats.mp} :</span>
                        <strong className="text-foreground font-mono tabular-nums text-right">{gr.actionPoints} / {gr.movementPoints}</strong>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-2.5 pt-2 border-t border-border text-center text-[11px] font-mono font-bold tabular-nums">
                      <span title={t.bossPage.stats.neutral} className="text-muted-foreground">{r.neutral ?? 0}%</span>
                      <span title={t.bossPage.stats.earth} className="text-amber-400">{r.earth ?? 0}%</span>
                      <span title={t.bossPage.stats.fire} className="text-red-400">{r.fire ?? 0}%</span>
                      <span title={t.bossPage.stats.water} className="text-sky-400">{r.water ?? 0}%</span>
                      <span title={t.bossPage.stats.air} className="text-emerald-400">{r.air ?? 0}%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveGradeIndex(idx)}
                    className={cn("w-full py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer", isActive ? "bg-foreground text-background" : "bg-surface border border-border text-muted-foreground hover:text-foreground")}
                  >
                    {isActive ? t.bossPage.activeGrade : t.bossPage.selectGrade}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: BUTIN & DROPS ── */}
      {detailTab === "loot" && (
        <div>
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dofus/modules/chest.png" alt="" className="w-4 h-4 object-contain opacity-80" /> {t.bossPage.lootTitle}
          </h4>
          {drops.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">{t.bossPage.noLootFound}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {drops.map((drop: any, idx: number) => {
                const pct = drop.percent ?? drop.dropPercent ?? 0;
                const label = pct > 0 && pct < 0.01 ? pct.toFixed(3) : Number(pct || 0).toFixed(2);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDrop(drop)}
                    title={`${drop.name} — ${label}%`}
                    className="flex items-center gap-2.5 rounded-xl bg-surface/50 border border-border/70 p-2 text-left hover:bg-surface hover:border-border transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-background border border-border p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      <MonsterImage src={drop.imageUrl} alt={drop.name} assetType="items" assetId={drop.objectId ?? drop.id} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {locale === "en" ? (drop.nameEn || drop.name) : drop.name}
                      </p>
                      <span className="text-[11px] font-mono font-semibold text-sky-400">{label}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MONSTRES DE LA SALLE ── */}
      {detailTab === "family" && (() => {
        const companionCount = familyByDungeon[dungeon.id]?.companions?.length ?? 0;
        const companionHint = familyByDungeon[dungeon.id]?.companionHint ?? null;
        return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/dofus/modules/party.png" alt="" className="w-4 h-4 object-contain opacity-80" /> {t.bossPage.roomMonstersTitle}
            </h4>
            {companionCount > 0 && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-info/30 text-info bg-info/10"
                title={locale === "en" ? "In combat, the keeper is accompanied by 3 of these monsters, randomly chosen." : "En combat, le gardien est accompagné de 3 de ces monstres, tirés au hasard à l'ouverture de l'anomalie."}
              >
                {locale === "en" ? "Anomaly" : "Anomalie"} · {companionHint ?? (locale === "en" ? `${companionCount} possible monsters` : `${companionCount} monstres possibles`)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {roomMonsters.map((m) => {
              const isActive = (activeMonsterName ?? bossName) === m.name;
              return (
                <div key={m.id} className={cn("p-3 rounded-xl border transition-colors flex flex-col justify-between space-y-2.5", isActive ? "border-border-strong bg-surface/80 shadow-xs" : "border-border/60 bg-surface/40 hover:border-border")}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-xs">
                      {m.imageUrl ? (
                        <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-full h-full object-contain" />
                      ) : (
                        <Swords className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-bold truncate", isActive ? "text-foreground" : "text-muted-foreground")}>{m.isBoss && "👑 "}{m.name}</p>
                      <span className="text-[11px] text-muted-foreground block">
                        {m.isBoss
                          ? t.bossPage.mainBossBadge
                          : m.isCompanion
                          ? (locale === "en" ? `Anomaly monster${m.raceName ? ` · ${m.raceName}` : ""}` : `Monstre de l'anomalie${m.raceName ? ` · ${m.raceName}` : ""}`)
                          : t.bossPage.roomMonsterBadge}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => { selectMonster(m); setDetailTab("sorts"); }}
                      className="flex-1 py-1 px-2 rounded-lg bg-surface border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors text-center cursor-pointer"
                    >
                      {t.bossPage.sheetAndSpells}
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectMonster(m); setDetailTab("sim"); }}
                      className="py-1 px-2.5 rounded-lg border border-border text-muted-foreground text-[11px] hover:text-foreground transition-colors text-center flex items-center gap-1 cursor-pointer"
                      title={locale === "en" ? "Simulate this monster's range" : "Simuler la portée de ce monstre"}
                    >
                      <Target className="w-3 h-3" /> {t.bossPage.simulateSpell}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
      </div>

      {/* ── PASSAGE À L'ESPACE GUILDE ── */}
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5 shrink-0 opacity-70" />
          {t.bossPage.guildBannerDesc}
        </p>
        <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 text-xs text-foreground transition-colors hover:underline">
          {t.bossPage.guildBannerCta}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── DROP MODAL ── */}
      {selectedDrop && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDrop(null)} />
          <div className="relative bg-surface border border-border rounded-xl p-5 w-full max-w-xs text-center shadow-lg">
            <button type="button" onClick={() => setSelectedDrop(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer" aria-label={t.bossPage.closeModal}>
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-xl bg-background border border-border p-2 mx-auto mb-3 shadow-xs">
              <MonsterImage src={selectedDrop.imageUrl} alt={selectedDrop.name} assetType="items" assetId={selectedDrop.objectId ?? selectedDrop.id} className="w-full h-full object-contain" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {locale === "en" ? (selectedDrop.nameEn || selectedDrop.name) : selectedDrop.name}
            </h3>
            <p className="text-xs text-sky-400 font-mono font-semibold mt-1">
              {t.bossPage.dropRate} {(() => {
                const byGrade = selectedDrop.percentByGrade;
                const fmt = (v: number) => (v > 0 && v < 0.01 ? v.toFixed(3) : Number(v || 0).toFixed(2));
                if (Array.isArray(byGrade) && byGrade.length) return `${fmt(Math.min(...byGrade))}% – ${fmt(Math.max(...byGrade))}% (${locale === "en" ? "tier" : "grade"} 1-5)`;
                return `${fmt(selectedDrop.percent ?? selectedDrop.dropPercent ?? 0)}%`;
              })()}
            </p>
            <button
              type="button"
              onClick={() => setSelectedDrop(null)}
              className="mt-5 w-full px-4 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {t.bossPage.closeModal}
            </button>
          </div>
        </div>
      )}

      {/* ── LIENS GUIDES COMPLÉMENTAIRES ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {dungeon.dofuspourlesnoobsUrl && (
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> {locale === "en" ? "External guides:" : "Guides :"}
          </span>
        )}
        {dungeon.dofuspourlesnoobsUrl && (
          <a href={dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface/60 text-foreground text-xs font-semibold hover:bg-surface transition-colors">
            <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
            DPLN
          </a>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="w-3.5 h-3.5" /> {t.bossPage.publicSheetNotice}
        </span>
      </div>
    </div>
  );
}
