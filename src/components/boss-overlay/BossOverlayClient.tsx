"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Compass,
  ExternalLink,
  Loader2,
  Search,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  getBestiaireCatalog,
  getDungeonMonsters,
  getMonsterStats,
  type BestiaireEntry,
} from "@/server/actions/game-data-actions";
import {
  getBossDofensiveSpells,
  getDofensiveDungeonForBoss,
  type DofensiveDungeonInfo,
} from "@/server/actions/dofensive-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { cn } from "@/lib/utils";
import { SpellData, SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonsterStats {
  id?: number;
  name?: string;
  imageUrl?: string;
  grades?: {
    level: number;
    lifePoints: number;
    actionPoints: number;
    movementPoints: number;
    rangePoints?: number;
    tackleEvade?: number;
    tackleBlock?: number;
    initiative?: number;
    resists?: {
      neutral?: number;
      earth?: number;
      fire?: number;
      water?: number;
      air?: number;
    };
  }[];
  drops?: {
    objectId: number;
    name: string;
    imageUrl: string;
    percent: number;
    percentByGrade?: number[];
  }[];
  spells?: SpellData[];
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

type CatalogFilter = "boss" | "monstre" | "titan";
type OverlayTab = "info" | "sorts" | "sim";

// ─── MonsterImage ─────────────────────────────────────────────────────────────

function MonsterImage({
  src,
  alt = "",
  className = "",
  monsterId,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  monsterId?: number | string;
}) {
  const initialSrc = monsterId
    ? `/api/assets-dofus/monsters/${monsterId}${src ? `?url=${encodeURIComponent(src)}` : ""}`
    : src || null;
  const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
  const [triedRemote, setTriedRemote] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const newSrc = monsterId
      ? `/api/assets-dofus/monsters/${monsterId}${src ? `?url=${encodeURIComponent(src)}` : ""}`
      : src || null;
    setCurrentSrc(newSrc);
    setTriedRemote(false);
    setFailed(false);
  }, [src, monsterId]);

  const handleError = () => {
    if (!triedRemote && src && currentSrc !== src) {
      setTriedRemote(true);
      setCurrentSrc(src);
    } else {
      setFailed(true);
    }
  };

  if (!currentSrc || failed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground/40 bg-background",
          className
        )}
      >
        <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
      </span>
    );
  }
  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
    />
  );
}

// ─── ResistBar avec icône officielle Dofus ─────────────────────────────────────

function ResistBar({
  label,
  value,
  iconSrc,
  colorClass,
  barColor,
}: {
  label: string;
  value: number;
  iconSrc: string;
  colorClass: string;
  barColor: string;
}) {
  const isNeg = value < 0;
  const pct = Math.max(0, Math.min(100, Math.abs(value)));
  return (
    <div className="flex items-center gap-2 text-[11px] py-0.5">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        <img src={iconSrc} alt={label} className="w-4 h-4 object-contain" />
      </div>
      <span className={cn("w-10 text-right font-bold tabular-nums shrink-0", isNeg ? "text-rose-400" : colorClass)}>
        {value}%
      </span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", isNeg ? "bg-rose-500" : barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-white/40 w-12 text-[10px] font-medium truncate">{label}</span>
    </div>
  );
}

// ─── SpellCard accordéon avec boîte d'effets scrollable ────────────────────────

function SpellCard({
  spell,
  isOpen,
  onToggle,
}: {
  spell: SpellData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all overflow-hidden",
        isOpen
          ? "border-amber-500/50 bg-amber-500/[0.06] shadow-md shadow-black/40"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-2.5 flex items-center gap-2.5 text-left transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {spell.imageUrl ? (
            <img
              src={`/api/assets-dofus/spells/${spell.id}?url=${encodeURIComponent(spell.imageUrl)}`}
              alt={spell.name}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Zap className="w-4 h-4 text-amber-400/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-bold text-white/90 truncate">{spell.name}</span>
            {spell.apCost !== undefined && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
                <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain" />
                {spell.apCost}
              </span>
            )}
            {spell.range !== undefined && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 shrink-0">
                <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain" />
                {spell.minRange && spell.minRange !== spell.range ? `${spell.minRange}-${spell.range}` : spell.range}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
            {spell.castInLine && <span className="text-amber-400/70">Ligne</span>}
            {spell.castInDiagonal && <span className="text-purple-400/70">Diagonale</span>}
            {spell.castTestLos === false && <span className="text-emerald-400/80 font-semibold">Sans LdV</span>}
            {spell.criticalChance !== undefined && spell.criticalChance > 0 && (
              <span className="text-orange-400/70">{spell.criticalChance}% CC</span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-amber-400"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/[0.08] text-[11px]">
          <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-[10px]">
            <div>
              <span className="text-white/40">Portée : </span>
              <strong className="text-white font-semibold">
                {spell.minRange && spell.minRange !== spell.range ? `${spell.minRange} à ${spell.range} PO` : `${spell.range ?? 0} PO`}
              </strong>
            </div>
            <div>
              <span className="text-white/40">Ligne de vue : </span>
              <strong className={spell.castTestLos ? "text-white" : "text-emerald-400"}>
                {spell.castTestLos ? "Oui" : "Non"}
              </strong>
            </div>
            {spell.maxCastPerTurn !== undefined && (
              <div>
                <span className="text-white/40">Lancers/tour : </span>
                <strong className="text-white font-semibold">{spell.maxCastPerTurn}</strong>
              </div>
            )}
            {spell.minCastInterval !== undefined && spell.minCastInterval > 0 && (
              <div>
                <span className="text-white/40">Relance : </span>
                <strong className="text-amber-400 font-semibold">{spell.minCastInterval} tour{spell.minCastInterval > 1 ? "s" : ""}</strong>
              </div>
            )}
            {spell.zone && spell.zone.shape !== "Inconnue" && (
              <div className="col-span-2">
                <span className="text-white/40">Zone : </span>
                <strong className="text-amber-300 font-semibold">{spell.zone.shape} ({spell.zone.size} case{spell.zone.size > 1 ? "s" : ""})</strong>
              </div>
            )}
          </div>

          {spell.description && (
            <p className="text-[11px] text-white/60 italic leading-relaxed bg-white/[0.02] p-2 rounded-md border border-white/[0.04]">
              {spell.description}
            </p>
          )}

          {spell.effects && spell.effects.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">Effets</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-black/60 border border-white/10 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                {spell.effects.map((eff, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 mt-1.5 shrink-0" />
                    <span className="flex-1">{eff}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-white/30 italic">Aucun effet descriptif renseigné</p>
          )}

          {spell.criticalEffects && spell.criticalEffects.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider block">Effets Critiques</span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                {spell.criticalEffects.map((eff, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span className="flex-1">{eff}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BossOverlayClient ────────────────────────────────────────────────────────

export interface BossOverlayClientProps {
  guildId?: string;
  initialMonsterName?: string;
  initialDungeonName?: string;
  onClose: () => void;
  /**
   * Faux quand la fenêtre est la popup `about:blank` de secours (navigateur sans
   * Document PiP, ex. Opera GX) → bandeau "fenêtre non épinglée". Vrai par défaut.
   */
  pinned?: boolean;
}

export function BossOverlayClient({
  guildId = "public",
  initialMonsterName,
  initialDungeonName,
  onClose,
  pinned = true,
}: BossOverlayClientProps) {
  const [catalog, setCatalog] = useState<BestiaireEntry[]>([]);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("boss");
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState(initialMonsterName ?? "");
  const [selected, setSelected] = useState<BestiaireEntry | null>(null);
  const [stats, setStats] = useState<MonsterStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeMonsterName, setActiveMonsterName] = useState<string | null>(null);
  const [family, setFamily] = useState<DungeonFamily | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [dungeonMaps, setDungeonMaps] = useState<DofensiveDungeonInfo | null | undefined>(undefined);
  const [tab, setTab] = useState<OverlayTab>("info");
  const [activeSpellId, setActiveSpellId] = useState<number | undefined>(undefined);
  const [activeGradeIndex, setActiveGradeIndex] = useState<number>(0);
  const [isHeroCollapsed, setIsHeroCollapsed] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Empêche le deep-link initial de re-sélectionner le boss après un retour manuel.
  const deepLinkedRef = useRef(false);

  // 1. Charger le catalogue unifié
  useEffect(() => {
    getBestiaireCatalog()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setCatalog(res.data);
        }
      })
      .finally(() => setLoadingList(false));
  }, []);

  // 2. Deep-link initial par nom de monstre/donjon (auto-sélectionne UNE SEULE FOIS).
  useEffect(() => {
    if (!catalog.length || deepLinkedRef.current) return;
    deepLinkedRef.current = true;
    if (!initialMonsterName && !initialDungeonName) return;
    const match = catalog.find(
      (d) =>
        (initialMonsterName &&
          (d.bossName.toLowerCase().includes(initialMonsterName.toLowerCase()) ||
            d.name.toLowerCase().includes(initialMonsterName.toLowerCase()))) ||
        (initialDungeonName &&
          d.name.toLowerCase().includes(initialDungeonName.toLowerCase()))
    );
    if (match) {
      setSelected(match);
      setSearch(match.bossName);
    }
  }, [catalog, initialMonsterName, initialDungeonName]);

  // 3. Charger les stats de l'entité sélectionnée
  useEffect(() => {
    if (!selected) {
      setStats(null);
      return;
    }
    const target = activeMonsterName ?? selected.bossName;
    setLoadingStats(true);
    setStats(null);
    setDungeonMaps(undefined);

    getMonsterStats(target, selected.name)
      .then(async (res) => {
        if (res.success && res.data) {
          let data = res.data as MonsterStats;
          const dRes = await getBossDofensiveSpells(target, selected.name);
          if (dRes.success && dRes.data) {
            data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
          }
          setStats(data);
        }
      })
      .finally(() => setLoadingStats(false));

    getDungeonMonsters(selected.bossName, selected.name).then((res) => {
      if (res.success && res.data) setFamily(res.data as DungeonFamily);
    });

    getDofensiveDungeonForBoss(target, selected.name, {
      dofensiveMonsterName: selected.dofensiveMonsterName,
      dofensiveDungeonName: selected.dofensiveDungeonName,
    })
      .then((res) => {
        setDungeonMaps(res.success && res.data ? res.data : null);
      })
      .catch(() => setDungeonMaps(null));
  }, [selected, activeMonsterName]);

  // 4. Filtrage dynamique selon le filtre sélectionné (Boss / Monstres / Ocre) + recherche
  const filtered = useMemo(() => {
    let pool = catalog;
    if (catalogFilter === "boss") {
      pool = pool.filter((e) => e.type === "boss");
    } else if (catalogFilter === "monstre") {
      pool = pool.filter((e) => e.type === "monstre");
    } else if (catalogFilter === "titan") {
      pool = pool.filter((e) => e.type === "titan");
    }

    const q = search.trim().toLowerCase();
    if (!q) return pool.slice(0, 40);
    return pool.filter(
      (d) =>
        d.bossName.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [catalog, catalogFilter, search]);

  const currentGrade = stats?.grades?.[activeGradeIndex] ?? stats?.grades?.[0] ?? null;
  const resists = currentGrade?.resists;

  const handleSelectEntry = useCallback((d: BestiaireEntry) => {
    setSelected(d);
    setActiveMonsterName(null);
    setActiveGradeIndex(0);
    setTab("info");
    setActiveSpellId(undefined);
    setFamily(null);
    setShowFamilyModal(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelected(null);
    setStats(null);
    setFamily(null);
    setShowFamilyModal(false);
    setTab("info");
    setActiveSpellId(undefined);
    setSearch(""); // revient au filtre complet (sans recherche résiduelle du boss)
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const tabs = [
    { id: "info" as OverlayTab, label: "Stats", Icon: Shield },
    { id: "sorts" as OverlayTab, label: "Sorts", Icon: Zap },
    { id: "sim" as OverlayTab, label: "Simulation", Icon: Brain },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        colorScheme: "dark",
      }}
      className="relative flex flex-col w-full h-full max-h-screen bg-[#0d0d12] text-white overflow-hidden select-none"
    >
      {/* ── Header fixe ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/[0.06] shrink-0 bg-[#0d0d12] z-10">
        {selected && (
          <button
            onClick={handleBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
            aria-label="Retour"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Swords className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-[13px] font-bold text-white/90 truncate">
            {selected ? (activeMonsterName ?? selected.bossName) : "Bestiaire"}
          </span>
          {selected && (
            <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 shrink-0">
              LVL {selected.level}
            </span>
          )}
          {selected?.isOcreQuest && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0" title="Quête de l'Éternelle Moisson (Ocre)">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Ocre
            </span>
          )}
        </div>

      </div>

      {/* Navigateur sans Document PiP (ex. Opera GX) : la fenêtre n'est pas épinglée */}
      {!pinned && <OverlayPinNotice />}

      {/* ── Recherche + Filtres fonctionnels (1ère page) ── */}
      {!selected && (
        <div className="px-3 pt-2 pb-2 shrink-0 bg-[#0d0d12] space-y-2 border-b border-white/[0.06]">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher boss, donjon, monstre…"
              autoFocus
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.08] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 3 Filtres fonctionnels */}
          <div className="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
            <button
              onClick={() => setCatalogFilter("boss")}
              className={cn(
                "py-1 text-[10px] font-bold rounded-md transition-all text-center truncate",
                catalogFilter === "boss"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              👑 Boss Donjons
            </button>
            <button
              onClick={() => setCatalogFilter("monstre")}
              className={cn(
                "py-1 text-[10px] font-bold rounded-md transition-all text-center truncate",
                catalogFilter === "monstre"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              👹 Monstres
            </button>
            <button
              onClick={() => setCatalogFilter("titan")}
              className={cn(
                "py-1 text-[10px] font-bold rounded-md transition-all text-center truncate",
                catalogFilter === "titan"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              👑 Titans
            </button>
          </div>
        </div>
      )}

      {/* ── Hero fixe + Tabs fixes (fiche sélectionnée) ── */}
      {selected && (
        <div className="shrink-0 bg-[#0d0d12]">
          {/* Hero replié ou déplié */}
          {!isHeroCollapsed ? (
            <div className="relative flex items-center gap-3 px-3 pt-2.5 pb-2.5 border-b border-white/[0.06]">
              <div className="w-14 h-14 rounded-xl bg-black/50 border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                ) : (
                  <MonsterImage
                    src={stats?.imageUrl ?? selected.imageUrl}
                    alt={selected.bossName}
                    monsterId={stats?.id ?? selected.dofusdbId ?? undefined}
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-[11px] text-white/40 flex items-center gap-1 mb-0.5 truncate">
                  <Compass className="w-3 h-3 text-amber-400/70 shrink-0" />
                  <span className="truncate">{selected.name}</span>
                </p>

                {/* Boutons de grades / butins : Butin 4 5 6 7 8 */}
                {stats?.grades && stats.grades.length > 1 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {stats.grades.map((g, idx) => {
                      const label = stats.grades!.length === 5 ? `Butin ${4 + idx}` : `Grade ${1 + idx}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveGradeIndex(idx)}
                          className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition-colors",
                            idx === activeGradeIndex
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-xs"
                              : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"
                          )}
                          title={`Grade ${idx + 1} · Niveau ${g.level}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Liens externes : Fiche SigilOS (avec favicon) + Dofensive */}
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <a
                    href={guildId && guildId !== "public" ? `/dashboard/${guildId}/succes?view=boss&dungeon=${selected.id}` : `/boss/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors"
                    title="Ouvrir la fiche complète sur SigilOS"
                  >
                    <img src="/assets/ui/logo-v2.png" alt="SigilOS" className="w-3 h-3 object-contain" />
                    <span>Fiche SigilOS</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>

                  {selected.dofensiveUrl && (
                    <a
                      href={selected.dofensiveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                    >
                      <span>Dofensive</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Bouton pour réduire le hero */}
              <button
                type="button"
                onClick={() => setIsHeroCollapsed(true)}
                className="absolute top-2 right-2 p-1 text-white/30 hover:text-white/80 hover:bg-white/[0.06] rounded-md transition-colors"
                title="Réduire l'en-tête pour agrandir l'espace"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Mode Hero Réduit (très compact ~30px) */
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] text-xs bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  <MonsterImage
                    src={stats?.imageUrl ?? selected.imageUrl}
                    alt={selected.bossName}
                    monsterId={stats?.id ?? selected.dofusdbId ?? undefined}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="font-bold text-white/90 truncate text-[11px]">{selected.bossName}</span>
                <span className="text-[10px] text-white/40 truncate">· {selected.name}</span>
                {stats?.grades && stats.grades.length > 1 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/25 shrink-0">
                    {stats.grades.length === 5 ? `B${4 + activeGradeIndex}` : `G${1 + activeGradeIndex}`}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsHeroCollapsed(false)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Déplier l'en-tête complet"
              >
                <span>Déplier</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Onglets */}
          <div className="flex border-b border-white/[0.06]">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors border-b-2",
                  tab === id
                    ? "border-amber-500 text-amber-400 bg-white/[0.02]"
                    : "border-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.01]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone de contenu SCROLLABLE ── */}
      <div
        className={cn(
          "flex-1 min-h-0",
          tab === "sim"
            ? "flex flex-col overflow-hidden"
            : "overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
        )}
      >
        {/* Liste du catalogue (1ère page) */}
        {!selected && (
          <>
            {loadingList ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[11px]">Chargement…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/25">
                <Swords className="w-6 h-6" />
                <span className="text-[11px]">Aucun résultat</span>
              </div>
            ) : (
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {filtered.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectEntry(d)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-amber-500/30 transition-all text-center group relative"
                  >
                    {d.isOcreQuest && (
                      <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 h-4 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[8px] font-bold" title="Boss de la Quête Ocre">
                        <img src="/module-dofus/Dofus_Ocre.png" alt="Ocre" className="w-3 h-3 object-contain" />
                        Ocre
                      </span>
                    )}
                    <div className="w-14 h-14 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden">
                      <MonsterImage
                        src={d.imageUrl}
                        alt={d.bossName}
                        monsterId={d.dofusdbId ?? undefined}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-[11px] font-bold text-white/80 group-hover:text-amber-300 truncate transition-colors leading-tight">
                        {d.bossName}
                      </p>
                      <p className={cn(
                        "text-[9px] truncate",
                        d.type === "monstre" ? "text-sky-400/70" : "text-white/30"
                      )}>
                        {d.name}
                      </p>
                    </div>
                    {d.level > 0 && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">
                        LVL {d.level}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Onglet Stats */}
        {selected && tab === "info" && (
          <div className="p-3 space-y-3">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">Chargement…</span>
              </div>
            ) : currentGrade ? (
              <>
                {/* Bouton pour ouvrir la modale Famille (décharge l'UI principale) */}
                {family && family.monsters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFamilyModal(true)}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-amber-500/30 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-medium text-white/80 group-hover:text-amber-300 transition-colors">
                        Famille du donjon ({family.monsters.length} monstres)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Voir ↗
                    </span>
                  </button>
                )}

                {/* Caractéristiques principales avec icônes officielles Dofus */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    {
                      label: "PV",
                      value: currentGrade.lifePoints,
                      iconSrc: "/assets/dofus/stats/pv.png",
                      textColor: "text-rose-400",
                    },
                    {
                      label: "PA",
                      value: currentGrade.actionPoints,
                      iconSrc: "/assets/dofus/stats/pa.png",
                      textColor: "text-amber-400",
                    },
                    {
                      label: "PM",
                      value: currentGrade.movementPoints,
                      iconSrc: "/assets/dofus/stats/pm.png",
                      textColor: "text-sky-400",
                    },
                  ].map(({ label, value, iconSrc, textColor }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                    >
                      <img src={iconSrc} alt={label} className="w-4 h-4 object-contain" />
                      <span className={cn("text-[13px] font-bold tabular-nums", textColor)}>
                        {value.toLocaleString("fr-FR")}
                      </span>
                      <span className="text-[9px] font-semibold text-white/40">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Résistances avec icônes officielles Dofus */}
                {resists && (
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Shield className="w-3 h-3 text-amber-400/70" /> Résistances
                    </p>
                    <ResistBar
                      label="Neutre"
                      value={resists.neutral ?? 0}
                      iconSrc="/assets/dofus/stats/resNeutre.png"
                      colorClass="text-zinc-300"
                      barColor="bg-zinc-400"
                    />
                    <ResistBar
                      label="Terre"
                      value={resists.earth ?? 0}
                      iconSrc="/assets/dofus/stats/resTerre.png"
                      colorClass="text-amber-500"
                      barColor="bg-amber-600"
                    />
                    <ResistBar
                      label="Feu"
                      value={resists.fire ?? 0}
                      iconSrc="/assets/dofus/stats/resFeu.png"
                      colorClass="text-red-400"
                      barColor="bg-red-500"
                    />
                    <ResistBar
                      label="Eau"
                      value={resists.water ?? 0}
                      iconSrc="/assets/dofus/stats/resEau.png"
                      colorClass="text-sky-400"
                      barColor="bg-sky-500"
                    />
                    <ResistBar
                      label="Air"
                      value={resists.air ?? 0}
                      iconSrc="/assets/dofus/stats/resAir.png"
                      colorClass="text-emerald-400"
                      barColor="bg-emerald-500"
                    />
                  </div>
                )}

                {/* Butins par grade actif (dynamique selon Butin 4 5 6 7 8 sélectionné) */}
                {stats?.drops && stats.drops.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Butins</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-300 font-semibold lowercase">
                          {stats.grades && stats.grades.length === 5
                            ? `butin ${4 + activeGradeIndex}`
                            : `grade ${1 + activeGradeIndex}`}{" "}
                          {currentGrade ? `(nv. ${currentGrade.level})` : ""}
                        </span>
                      </p>
                      <span className="text-[9px] text-white/40">{stats.drops.length} objet{stats.drops.length > 1 ? "s" : ""}</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
                      {stats.drops.map((drop) => {
                        const rawDropPercent =
                          drop.percentByGrade && drop.percentByGrade[activeGradeIndex] !== undefined
                            ? drop.percentByGrade[activeGradeIndex]
                            : drop.percent;
                        const dropPercent =
                          rawDropPercent > 0 && rawDropPercent < 0.01
                            ? parseFloat(rawDropPercent.toFixed(3))
                            : parseFloat(Number(rawDropPercent || 0).toFixed(2));
                        return (
                          <div
                            key={drop.objectId}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.05] transition-colors"
                          >
                            <div className="w-7 h-7 rounded-md bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                              <img
                                src={`/api/assets-dofus/items/${drop.objectId}?url=${encodeURIComponent(drop.imageUrl)}`}
                                alt={drop.name}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-white/80 flex-1 truncate">{drop.name}</span>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] font-bold text-amber-400 tabular-nums">{dropPercent}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Swords className="w-6 h-6" />
                <span className="text-[11px]">Aucune donnée</span>
              </div>
            )}
          </div>
        )}

        {/* Onglet Sorts */}
        {selected && tab === "sorts" && (
          <div className="p-3">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">Chargement…</span>
              </div>
            ) : stats?.spells && stats.spells.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">
                  Sorts ({stats.spells.length})
                </p>
                {stats.spells.map((spell) => (
                  <SpellCard
                    key={spell.id}
                    spell={spell}
                    isOpen={activeSpellId === spell.id}
                    onToggle={() => setActiveSpellId(spell.id === activeSpellId ? undefined : spell.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Zap className="w-6 h-6" />
                <span className="text-[11px]">Aucun sort disponible</span>
              </div>
            )}
          </div>
        )}

        {/* Onglet Simulation */}
        {selected && tab === "sim" && (
          <div className="flex-1 h-full flex flex-col min-h-0 p-1.5 overflow-hidden">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">Chargement…</span>
              </div>
            ) : stats?.spells && stats.spells.length > 0 ? (
              <SpellRangeGrid
                spells={stats.spells}
                activeSpellId={activeSpellId}
                onSelectSpell={(s) => setActiveSpellId(s.id)}
                bossName={activeMonsterName ?? selected.bossName}
                bossImageUrl={stats?.imageUrl ?? selected.imageUrl ?? undefined}
                dungeonMaps={dungeonMaps?.maps ?? undefined}
                dungeonName={selected.name}
                grades={stats?.grades}
                activeGradeIndex={activeGradeIndex}
                onGradeChange={setActiveGradeIndex}
                monsters={family?.monsters.map((m) => ({
                  id: m.id,
                  name: m.name,
                  isBoss: m.isBoss,
                  imageUrl: m.imageUrl,
                }))}
                entityScale={selected.type === "titan" ? 4 : 1}
                compact={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Brain className="w-6 h-6" />
                <span className="text-[11px]">Aucun sort à simuler</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modale Famille du Donjon (en popin dans l'overlay) ── */}
      {showFamilyModal && family && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-xs flex flex-col animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-[#121218]">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-[12px] font-bold text-white">Famille ({family.monsters.length})</span>
            </div>
            <button
              onClick={() => setShowFamilyModal(false)}
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
            {family.monsters.map((m) => {
              const isCurrent = (activeMonsterName === m.name) || (!activeMonsterName && m.name === selected?.bossName);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.isBoss || m.name === selected?.bossName) {
                      setActiveMonsterName(null);
                    } else {
                      setActiveMonsterName(m.name);
                    }
                    setShowFamilyModal(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all",
                    isCurrent
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                      : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/15 text-white/80"
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    <MonsterImage
                      src={m.imageUrl}
                      alt={m.name}
                      monsterId={m.id}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{m.name}</p>
                    <p className="text-[9px] text-white/40">{m.isBoss ? "Gardien du donjon" : "Monstre de salle"}</p>
                  </div>
                  {m.isBoss && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Boss
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer fixe ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06] shrink-0 bg-[#0d0d12] z-10">
        <span className="text-[9px] text-white/20 font-medium">SigilOS · Bestiaire</span>
        {selected && (
          <span className="text-[9px] text-white/30 font-medium truncate ml-2">
            {activeMonsterName ?? selected.bossName}
          </span>
        )}
      </div>
    </div>
  );
}
