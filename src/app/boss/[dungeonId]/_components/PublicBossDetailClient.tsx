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
  ExternalLink,
  ArrowRight,
  Target,
  Flame,
  Gem,
  Loader2,
  MapPin,
  Check,
  Info,
  Compass,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  kind?: "boss" | "titan";
}

interface FamilyMember {
  id: number;
  name: string;
  imageUrl: string | null;
  isBoss: boolean;
}

interface DungeonFamily {
  familyId: number | null;
  monsters: FamilyMember[];
}

interface PublicBossDetailClientProps {
  dungeon: PublicDungeon;
  monsterStats?: any;
  initialFamily?: DungeonFamily | null;
  initialDungeonMaps?: DofensiveDungeonInfo | null;
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
}: PublicBossDetailClientProps) {
  const bossName = dungeon.bossName || dungeon.name;
  const isTitan = dungeon.kind === "titan";
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
    getMonsterStats(target, dungeon.name)
      .then(async (res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          let data = res.data;
          try {
            const dRes = await getBossDofensiveSpells(target, dungeon.name);
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
  useEffect(() => {
    if (familyByDungeon[dungeon.id]) return;
    let cancelled = false;
    getDungeonMonsters(bossName, dungeon.name)
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
  useEffect(() => {
    if (mapsByBoss[activeBossKey] !== undefined) return;
    let cancelled = false;
    const isMain = !activeMonsterName;
    getDofensiveDungeonForBoss(
      activeBossKey,
      dungeon.name,
      isMain
        ? {
            dofensiveMonsterName: dungeon.dofensiveMonsterName,
            dofensiveDungeonName: dungeon.dofensiveDungeonName,
          }
        : undefined
    )
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
        : undefined
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

  const tabs = (
    [
      { id: "sorts", label: `Sorts du ${isTitan ? "Titan" : "Boss"}`, icon: Zap },
      { id: "overview", label: "Sorts Détaillés", icon: Swords },
      { id: "sim", label: "Simulation Tactique", icon: Target },
      { id: "grades", label: `Grades & Paliers (${grades.length})`, icon: Flame, hidden: grades.length <= 1 },
      { id: "loot", label: "Butin & Drops", icon: Gem },
      { id: "family", label: `Monstres de la salle (${roomMonsters.length})`, icon: Users, hidden: !hasRoomMonsters },
    ] as { id: DetailTab; label: string; icon: any; hidden?: boolean }[]
  ).filter((t) => !t.hidden);

  const resists = activeGrade?.resists || {};
  const coords = currentStats?.coordinates as { x: number; y: number; worldMapId?: number } | null | undefined;
  const travelCmd = coords ? `/travel ${coords.x} ${coords.y}` : null;
  const dbLink = currentStats?.id
    ? `https://dofusdb.fr/fr/database/monster/${currentStats.id}`
    : `https://dofusdb.fr/fr/database/monsters?search=${encodeURIComponent(activeMonsterName ?? bossName)}`;
  const resolvedBossName =
    dungeon.dofensiveMonsterName ?? (activeMonsterName ?? deriveDofensiveMonsterName(bossName) ?? bossName);

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION / HERO CARD ── */}
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-background/80 border border-white/15 flex items-center justify-center p-2 shrink-0 shadow-inner overflow-hidden">
            <MonsterImage
              src={currentStats?.imageUrl ?? dungeon.imageUrl}
              alt={activeMonsterName ?? bossName}
              monsterId={currentStats?.id}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                {isTitan ? "Titan" : "Boss de Donjon"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px]">
                Niveau {dungeon.level ?? 200}
              </span>
              {isTitan && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 font-black text-[10px] uppercase tracking-wider">
                  Titan
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-foreground font-heading tracking-tight mt-1">
              {activeMonsterName ?? bossName}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Donjon : <strong className="text-foreground">{dungeon.name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => openBossOverlay({ monsterName: activeMonsterName ?? bossName, dungeonName: dungeon.name })}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20"
            title="Affiche une mini-fenêtre par-dessus votre jeu Dofus"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ouvrir l&apos;Overlay en jeu</span>
          </button>
          <a
            href={dbLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-bold transition-colors"
            title="Voir sur DofusDB"
          >
            <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
            DofusDB
          </a>
          {dungeon.dofensiveUrl && (
            <a
              href={dungeon.dofensiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-colors"
              title="Voir sur Dofensive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* ── CONVERSION GUILD BANNER ── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-surface to-background flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
            <Users className="w-3.5 h-3.5" />
            <span>Préparez ce donjon en guilde</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Créez une session de donjon sur Discord en 1 clic : les membres s&apos;inscrivent avec leur classe, et leurs succès sont validés automatiquement.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 font-bold text-xs border border-white/10 transition-colors"
        >
          <span>Créer mon espace guilde</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
        </Link>
      </div>

      {/* ── STATS BAR (PV/PA/PM + résistances, comme le module interne) ── */}
      {isLoadingCurrent ? (
        <div className="flex items-center justify-center p-6 rounded-2xl bg-surface border border-white/10 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-xs font-bold">Chargement des caractéristiques de {activeMonsterName ?? bossName}…</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-2 px-1 border-y border-white/10">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface border border-white/10" title="Points de Vie">
              <img src="/assets/module-succes/vitalite.png" alt="PV" className="w-4 h-4 object-contain" />
              <span className="text-sm font-bold text-foreground tabular-nums">
                {activeGrade ? activeGrade.lifePoints?.toLocaleString("fr-FR") : "—"}
              </span>
              <span className="text-[11px] font-bold text-muted-foreground">PV</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20" title="Points d'Action">
              <span className="text-sm font-bold text-sky-400 tabular-nums">{activeGrade?.actionPoints ?? "—"}</span>
              <span className="text-[11px] font-bold text-sky-400/80">PA</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20" title="Points de Mouvement">
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{activeGrade?.movementPoints ?? "—"}</span>
              <span className="text-[11px] font-bold text-emerald-400/80">PM</span>
            </div>
          </div>
          <div className="hidden sm:block h-5 w-px bg-white/10 mx-0.5" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/70 border border-white/10" title="Résistance Neutre">
              <img src="/assets/module-succes/neutre.png" alt="Neutre" className="w-4 h-4 object-contain" />
              <b className="text-sm font-bold text-foreground tabular-nums">{resists.neutral ?? 0}%</b>
              <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">Neutre</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20" title="Résistance Terre">
              <img src="/assets/module-succes/terre.png" alt="Terre" className="w-4 h-4 object-contain" />
              <b className="text-sm font-bold text-amber-400 tabular-nums">{resists.earth ?? 0}%</b>
              <span className="text-[11px] font-bold text-amber-400/80 hidden sm:inline">Terre</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20" title="Résistance Feu">
              <img src="/assets/module-succes/Intelligence.png" alt="Feu" className="w-4 h-4 object-contain" />
              <b className="text-sm font-bold text-red-400 tabular-nums">{resists.fire ?? 0}%</b>
              <span className="text-[11px] font-bold text-red-400/80 hidden sm:inline">Feu</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20" title="Résistance Eau">
              <img src="/assets/module-succes/eau.png" alt="Eau" className="w-4 h-4 object-contain" />
              <b className="text-sm font-bold text-sky-400 tabular-nums">{resists.water ?? 0}%</b>
              <span className="text-[11px] font-bold text-sky-400/80 hidden sm:inline">Eau</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20" title="Résistance Air">
              <img src="/assets/module-succes/Agility.png" alt="Air" className="w-4 h-4 object-contain" />
              <b className="text-sm font-bold text-emerald-400 tabular-nums">{resists.air ?? 0}%</b>
              <span className="text-[11px] font-bold text-emerald-400/80 hidden sm:inline">Air</span>
            </div>
          </div>
          {grades.length > 1 && (
            <button
              type="button"
              onClick={() => setDetailTab("grades")}
              className="ml-auto px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-1"
              title="Ouvrir l'onglet des grades & paliers"
            >
              <Flame className="w-3 h-3" />
              {grades.length === 5 ? `Butin ${4 + gradeIdx}` : `Grade ${1 + gradeIdx}`}
            </button>
          )}
        </div>
      )}

      {/* ── TABS NAVIGATION (parité module interne) ── */}
      <div className="flex items-center gap-1.5 p-1 bg-surface/60 border border-white/10 rounded-xl overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = detailTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                isActive
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isActive ? "text-amber-300" : "text-muted-foreground")} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB: SORTS DU BOSS (mécaniques clés) ── */}
      {detailTab === "sorts" && (
        <div className="space-y-4">
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Aucun sort répertorié pour cette entité.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Mécaniques clés
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300">
                  {spells.length} sorts à anticiper
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {spells.slice(0, 6).map((spell: any) => (
                  <div key={spell.id} className="rounded-2xl bg-surface/60 border border-white/10 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-background border border-white/10 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                          {spell.imageUrl ? (
                            <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-full h-full object-contain" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-foreground truncate">{spell.name}</h5>
                          <span className="text-[11px] font-bold text-muted-foreground block">
                            {spell.apCost || 0} PA · {spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range ?? 0} PO`}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {spell.effectDetails?.[0]?.label ?? (Array.isArray(spell.effects) ? spell.effects[0] : null) ?? spell.description ?? "Effet de combat."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedSpellId(spell.id); setDetailTab("sim"); }}
                      className="mt-3 text-xs font-bold text-amber-300 hover:text-amber-200 self-start transition-colors flex items-center gap-1"
                    >
                      <Target className="w-3.5 h-3.5" /> Voir la portée
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
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-foreground">Tous les sorts ({spells.length})</h4>
          </div>
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Aucun sort détaillé répertorié pour ce boss.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {spells.map((spell: any) => (
                <div key={spell.id} className="p-3.5 rounded-xl bg-surface/60 border border-white/10 flex flex-col space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {spell.imageUrl ? (
                        <MonsterImage src={spell.imageUrl} alt={spell.name} assetType="spells" assetId={spell.id} className="w-8 h-8 object-contain rounded-lg bg-background border border-white/10 p-0.5" />
                      ) : (
                        <Zap className="w-4 h-4 text-amber-400" />
                      )}
                      <div>
                        <span className="flex items-center gap-1.5">
                          <span className="block text-sm font-bold text-foreground">{spell.name}</span>
                          {spell.grade !== undefined && (
                            <span className="text-[11px] font-bold text-muted-foreground bg-background border border-white/10 px-1 py-px rounded">Niv. {spell.grade}</span>
                          )}
                        </span>
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {spell.apCost || 0} PA · {spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range ?? 0} PO`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedSpellId(spell.id); setDetailTab("sim"); }}
                      className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors shrink-0"
                    >
                      Simuler
                    </button>
                  </div>
                  {(() => {
                    const details = spell.effectDetails?.length > 0
                      ? spell.effectDetails
                      : (Array.isArray(spell.effects) ? spell.effects.slice(0, 20).map((e: string) => ({ label: e, duration: null, triggers: [] as string[], masks: [] as string[] })) : []);
                    const criticals = Array.isArray(spell.criticalEffects) ? spell.criticalEffects : [];
                    if (!details.length && !spell.description && !criticals.length && spell.hasCriticalEffects !== false) return null;
                    return (
                      <div className="space-y-2 text-[11px] leading-relaxed">
                        {spell.description && <p className="text-muted-foreground">{spell.description}</p>}
                        {details.length > 0 && (
                          <div className="space-y-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Effet principal</span>
                            <ul className="space-y-1">
                              {details.map((det: any, i: number) => (
                                <li key={i} className="text-muted-foreground">
                                  <span className="text-foreground font-semibold">{det.label}{det.duration ? ` (${det.duration})` : ""}</span>
                                  {det.masks?.length > 0 && <span className="block text-muted-foreground/80">{det.masks.join(" · ")}</span>}
                                  {det.triggers?.length > 0 && (
                                    <span className="block text-muted-foreground/80 flex items-center gap-1">
                                      <Zap className="w-3 h-3 text-amber-400 shrink-0" />{det.triggers.join(" · ")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {spell.hasCriticalEffects === false ? (
                          <p className="text-muted-foreground/80">Effets critiques : aucun.</p>
                        ) : criticals.length > 0 ? (
                          <div className="space-y-0.5 pt-1 border-t border-white/10">
                            <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-300">Effets critiques</span>
                            <ul className="space-y-0.5">
                              {criticals.map((ce: string, k: number) => (
                                <li key={k} className="text-muted-foreground">• {ce}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: SIMULATION TACTIQUE (avec choix de map, comme l'interne) ── */}
      {detailTab === "sim" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-foreground">Simulation & Portée des Sorts</h4>
            </div>
            {hasRoomMonsters && (
              <div className="flex items-center gap-1 bg-background/60 border border-white/10 p-1 rounded-xl overflow-x-auto max-w-full">
                <span className="text-[11px] font-bold text-muted-foreground px-1.5 hidden sm:inline">Entité :</span>
                {roomMonsters.map((m) => {
                  const isActive = (activeMonsterName ?? bossName) === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMonster(m)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors shrink-0",
                        isActive
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                          : "bg-surface border border-white/10 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m.imageUrl && <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-3 h-3 object-contain rounded-xs" />}
                      {m.isBoss && "👑 "}{m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {spells.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Aucun sort disponible pour la simulation.</p>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-surface/50 p-4 sm:p-6 overflow-hidden shadow-2xl">
              <SpellRangeGrid
                spells={spells}
                activeSpellId={selectedSpellId}
                onSelectSpell={(s) => setSelectedSpellId(s.id)}
                bossName={resolvedBossName}
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
            </div>
          )}
        </div>
      )}

      {/* ── TAB: GRADES & PALIERS ── */}
      {detailTab === "grades" && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" /> Paliers de Grades & Caractéristiques de Combat
          </h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Les caractéristiques ci-dessus varient selon le grade sélectionné.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {grades.map((gr: any, idx: number) => {
              const isActive = (activeGradeIndex ?? grades.length - 1) === idx;
              const label = grades.length === 5 ? `Butin ${4 + idx}` : `Grade ${idx + 1}`;
              const r = gr.resists || {};
              return (
                <div key={idx} className={cn("p-3.5 rounded-2xl border transition-colors flex flex-col justify-between space-y-3", isActive ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-surface/60")}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-sm font-bold text-foreground">{label}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-background border border-white/10 text-muted-foreground">Niv. {gr.level}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>PV :</span>
                        <strong className="text-foreground tabular-nums text-right">{gr.lifePoints?.toLocaleString("fr-FR")}</strong>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>PA / PM :</span>
                        <strong className="text-foreground tabular-nums text-right">{gr.actionPoints} / {gr.movementPoints}</strong>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-2.5 pt-2 border-t border-white/10 text-center text-[11px] font-bold tabular-nums">
                      <span title="Neutre" className="text-muted-foreground">{r.neutral ?? 0}%</span>
                      <span title="Terre" className="text-amber-400">{r.earth ?? 0}%</span>
                      <span title="Feu" className="text-red-400">{r.fire ?? 0}%</span>
                      <span title="Eau" className="text-sky-400">{r.water ?? 0}%</span>
                      <span title="Air" className="text-emerald-400">{r.air ?? 0}%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveGradeIndex(idx)}
                    className={cn("w-full py-1.5 rounded-xl text-xs font-bold transition-colors", isActive ? "bg-amber-500 text-zinc-950" : "bg-surface border border-white/10 text-muted-foreground hover:text-foreground")}
                  >
                    {isActive ? "✓ Grade Actif" : "Sélectionner"}
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
          <h4 className="text-sm font-bold text-sky-300 mb-3 flex items-center gap-1.5">
            <Gem className="w-4 h-4" /> Butins notables & Taux de drop
          </h4>
          {drops.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Aucun drop répertorié.</p>
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
                    className="flex items-center gap-2.5 rounded-xl bg-surface/60 border border-white/10 p-2 text-left hover:bg-surface hover:border-white/20 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-background border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <MonsterImage src={drop.imageUrl} alt={drop.name} assetType="items" assetId={drop.objectId ?? drop.id} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{drop.name}</p>
                      <span className="text-[11px] font-bold text-sky-300">{label}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MONSTRES DE LA SALLE ── */}
      {detailTab === "family" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" /> Monstres accompagnateurs de la salle
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {roomMonsters.map((m) => {
              const isActive = (activeMonsterName ?? bossName) === m.name;
              return (
                <div key={m.id} className={cn("p-3 rounded-2xl border transition-colors flex flex-col justify-between space-y-2.5", isActive ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-surface/60")}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {m.imageUrl ? (
                        <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-full h-full object-contain" />
                      ) : (
                        <Swords className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-bold truncate", isActive ? "text-amber-300" : "text-foreground")}>{m.isBoss && "👑 "}{m.name}</p>
                      <span className="text-[11px] text-muted-foreground block">{m.isBoss ? "Boss principal" : "Monstre de salle"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => { selectMonster(m); setDetailTab("sorts"); }}
                      className="flex-1 py-1 px-2 rounded-lg bg-surface border border-white/10 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors text-center"
                    >
                      Fiche & Sorts
                    </button>
                    <button
                      type="button"
                      onClick={() => { selectMonster(m); setDetailTab("sim"); }}
                      className="py-1 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 transition-colors text-center flex items-center gap-1"
                      title="Simuler la portée de ce monstre"
                    >
                      <Target className="w-3 h-3" /> Simuler
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── COORDONNÉES (entrée donjon + /travel) ── */}
      {coords && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (!travelCmd) return;
              navigator.clipboard.writeText(travelCmd).then(() => {
                setCopiedTravel(true);
                window.setTimeout(() => setCopiedTravel(false), 2000);
              }).catch(() => {});
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-white/10 hover:border-amber-500/50 text-foreground transition-colors"
            title="Cliquer pour copier la commande /travel"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Entrée du donjon : <strong className="text-amber-300">[{coords.x}, {coords.y}]</strong></span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface border border-white/10 text-muted-foreground font-mono">{travelCmd}</span>
            {copiedTravel && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
          <span className="text-xs font-bold text-muted-foreground">
            Zone : <strong className="text-foreground">{getWorldName(coords.worldMapId)}</strong>
          </span>
        </div>
      )}

      {/* ── DROP MODAL ── */}
      {selectedDrop && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDrop(null)} />
          <div className="relative bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center">
            <button type="button" onClick={() => setSelectedDrop(null)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-background border border-white/10 p-2 mx-auto mb-3">
              <MonsterImage src={selectedDrop.imageUrl} alt={selectedDrop.name} assetType="items" assetId={selectedDrop.objectId ?? selectedDrop.id} className="w-full h-full object-contain" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{selectedDrop.name}</h3>
            <p className="text-xs text-sky-300 font-bold mt-1">
              Taux de drop : {(() => {
                const byGrade = selectedDrop.percentByGrade;
                const fmt = (v: number) => (v > 0 && v < 0.01 ? v.toFixed(3) : Number(v || 0).toFixed(2));
                if (Array.isArray(byGrade) && byGrade.length) return `${fmt(Math.min(...byGrade))} % – ${fmt(Math.max(...byGrade))} % (grade 1-5)`;
                return `${fmt(selectedDrop.percent ?? selectedDrop.dropPercent ?? 0)}%`;
              })()}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setSelectedDrop(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-surface text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Fermer
              </button>
              {(selectedDrop.objectId ?? selectedDrop.id) && (
                <a
                  href={`https://dofusdb.fr/fr/database/item/${selectedDrop.objectId ?? selectedDrop.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-surface text-xs font-bold text-foreground hover:bg-white/[0.06] transition-colors"
                >
                  <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                  DofusDB
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIENS GUIDES COMPLÉMENTAIRES ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Guides :
        </span>
        {dungeon.dofensiveUrl && (
          <a href={dungeon.dofensiveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-surface/60 text-foreground text-xs font-bold hover:bg-surface transition-colors">
            <img src="https://www.google.com/s2/favicons?domain=dofensive.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
            Dofensive
          </a>
        )}
        {dungeon.dofuspourlesnoobsUrl && (
          <a href={dungeon.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-surface/60 text-foreground text-xs font-bold hover:bg-surface transition-colors">
            <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
            DPLN
          </a>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="w-3.5 h-3.5" /> Fiche publique — sans suivi de guilde (connexion requise dans le dashboard).
        </span>
      </div>
    </div>
  );
}
