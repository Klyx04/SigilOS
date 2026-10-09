"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  ExternalLink,
  Gem,
  Loader2,
  Move,
  Search,
  Shield,
  ShieldAlert,
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
import { getBountyFiche } from "@/server/actions/bounty-actions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { SpellData, SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { OverlayPinNotice } from "@/components/overlay-pin-notice";
import { BossMechanicsView, type BossPassiveData } from "@/components/boss/BossMechanicsView";
import { formatDofusEffectLine } from "@/lib/dofus-effects-formatter";
import { encycloProperties } from "@/lib/dofus-encyclo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonsterStats {
  id?: number;
  name?: string;
  imageUrl?: string;
  passive?: BossPassiveData;
  unity?: any;
  encyclo?: any;
  grades?: {
    level: number;
    lifePoints: number;
    actionPoints: number;
    movementPoints: number;
    rangePoints?: number;
    tackleEvade?: number;
    tackleBlock?: number;
    initiative?: number;
    tackle?: number;
    evade?: number;
    apRemoval?: number;
    mpRemoval?: number;
    apDodge?: number;
    mpDodge?: number;
    power?: number;
    damage?: number;
    healBonus?: number;
    criticalHit?: number;
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

type CatalogFilter = "boss" | "anomalie" | "raid" | "monstre" | "titan" | "bounty";
type OverlayTab = "info" | "sorts" | "sim" | "loot";

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

// ─── ResistBar — lecture « table de données » (label → barre → valeur) ────────
//
// Refonte confort joueur (15/09) : la valeur n'est plus un gros nombre coloré mais
// une **mesure** en fin de ligne (mono, blanc), la barre passe à 3 px et le libellé
// vient **en premier** — on balaie les 5 lignes verticalement sans chercher où lire.
// Seules les couleurs **sémantiques** du jeu restent (élément + malus en rose).

function ResistBar({
  label,
  value,
  iconSrc,
  barColor,
}: {
  label: string;
  value: number;
  iconSrc: string;
  barColor: string;
}) {
  const isNeg = value < 0;
  const pct = Math.max(0, Math.min(100, Math.abs(value)));
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <img src={iconSrc} alt={label} className="w-4 h-4 object-contain opacity-90 shrink-0" />
      <span className="w-14 shrink-0 text-white/55">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={cn("h-full rounded-full", isNeg ? "bg-rose-500/80" : barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-12 shrink-0 text-right text-[13px] tabular-nums", isNeg ? "text-rose-400" : "text-white/75")}>
        {value}%
      </span>
    </div>
  );
}

// ─── SpellCard accordéon avec boîte d'effets scrollable ────────────────────────

function SpellCard({
  spell,
  isOpen,
  onToggle,
  locale = "fr",
}: {
  spell: SpellData;
  isOpen: boolean;
  onToggle: () => void;
  locale?: "fr" | "en";
}) {
  const isEn = locale === "en";
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors overflow-hidden",
        isOpen
          ? "border-white/[0.12] bg-white/[0.045]"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.13] hover:bg-white/[0.04]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-2.5 flex items-center gap-2.5 text-left transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          {spell.unityIconId && spell.unityIconId > 0 ? (
            <img
              src={`/uploads/assets-dofus/spells/sort_${spell.unityIconId}.webp`}
              alt={spell.name}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                if (spell.imageUrl) {
                  (e.target as HTMLImageElement).src = `/api/assets-dofus/spells/${spell.id}?url=${encodeURIComponent(spell.imageUrl)}`;
                } else {
                  (e.target as HTMLImageElement).style.display = "none";
                }
              }}
            />
          ) : spell.imageUrl ? (
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
            <Zap className="w-4 h-4 text-white/25" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-medium text-white/90 truncate">{spell.name}</span>
            {/* PA / PO : texte mono compact (icônes du jeu), plus de pastilles colorées */}
            {spell.apCost !== undefined && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-white/55 shrink-0">
                <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain opacity-90" />
                {spell.apCost}
              </span>
            )}
            {spell.range !== undefined && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-white/55 shrink-0">
                <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain opacity-90" />
                {spell.minRange && spell.minRange !== spell.range ? `${spell.minRange}-${spell.range}` : spell.range}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
            {spell.castInLine && <span>{isEn ? "Line" : "Ligne"}</span>}
            {spell.castInDiagonal && <span>{isEn ? "Diagonal" : "Diagonale"}</span>}
            {spell.castTestLos === false && <span className="text-emerald-400/80">{isEn ? "No LoS" : "Sans LdV"}</span>}
            {spell.criticalChance !== undefined && spell.criticalChance > 0 && (
              <span>{spell.criticalChance}% CC</span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/[0.08] text-[11px]">
          <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-[10px]">
            <div>
              <span className="text-white/40">{isEn ? "Range: " : "Portée : "}</span>
              <strong className="text-white font-semibold">
                {spell.minRange && spell.minRange !== spell.range
                  ? (isEn ? `${spell.minRange} to ${spell.range} Range` : `${spell.minRange} à ${spell.range} PO`)
                  : `${spell.range ?? 0} ${isEn ? "Range" : "PO"}`}
              </strong>
            </div>
            <div>
              <span className="text-white/40">{isEn ? "Line of Sight: " : "Ligne de vue : "}</span>
              <strong className={spell.castTestLos ? "text-white" : "text-emerald-400"}>
                {spell.castTestLos ? (isEn ? "Yes" : "Oui") : (isEn ? "No" : "Non")}
              </strong>
            </div>
            {spell.maxCastPerTurn !== undefined && (
              <div>
                <span className="text-white/40">{isEn ? "Casts/turn: " : "Lancers/tour : "}</span>
                <strong className="text-white font-semibold">{spell.maxCastPerTurn}</strong>
              </div>
            )}
            {spell.minCastInterval !== undefined && spell.minCastInterval > 0 && (
              <div>
                <span className="text-white/40">{isEn ? "Cooldown: " : "Relance : "}</span>
                <strong className="text-white/90 font-medium">
                  {spell.minCastInterval} {isEn ? `turn${spell.minCastInterval > 1 ? "s" : ""}` : `tour${spell.minCastInterval > 1 ? "s" : ""}`}
                </strong>
              </div>
            )}
            {spell.zone && spell.zone.shape !== "Inconnue" && (
              <div className="col-span-2">
                <span className="text-white/40">{isEn ? "Area: " : "Zone : "}</span>
                <strong className="text-white/90 font-medium">
                  {spell.zone.shape} ({spell.zone.size} {isEn ? `cell${spell.zone.size > 1 ? "s" : ""}` : `case${spell.zone.size > 1 ? "s" : ""}`})
                </strong>
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
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block">
                {isEn ? "Effects" : "Effets"}
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-black/40 border border-white/[0.07] overlay-scroll">
                {spell.effects.map((eff, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] leading-relaxed text-zinc-200">
                    <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                    <span className="flex-1">{formatDofusEffectLine(eff)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-white/30 italic">
              {isEn ? "No descriptive effect provided" : "Aucun effet descriptif renseigné"}
            </p>
          )}

          {spell.criticalEffects && spell.criticalEffects.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-amber-500/90 uppercase tracking-wide block">
                {isEn ? "Critical effects" : "Effets critiques"}
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-black/40 border border-white/[0.07] overlay-scroll">
                {spell.criticalEffects.map((eff, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] leading-relaxed text-zinc-200">
                    <span className="w-1 h-1 rounded-full bg-amber-500/50 shrink-0" />
                    <span className="flex-1">{formatDofusEffectLine(eff)}</span>
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
  const { t, locale } = useI18n();
  const isEn = locale === "en";
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
  /**
   * 🕹️ Bascule « Boss libre » de l'overlay (sections §C) : état LOCAL à la fenêtre,
   * purement de prévisualisation. ON (**défaut**) ⇒ un clic sur une case marchable déplace
   * le boss pour tester les portées ; OFF ⇒ boss épinglé sur son placement réel.
   * Aucune donnée n'est écrite, l'état retombe à ON à la fermeture de la fenêtre.
   */
  const [freeBossMove, setFreeBossMove] = useState<boolean>(true);
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

    // 🎯 Avis de recherche : fiche + carte **déjà siphonnées** ⇒ lecture locale uniquement
    // (`getBountyFiche`), aucune source live appelée (catalogue, sorts, butin, simulation).
    if (selected.type === "bounty") {
      setFamily(null);
      getBountyFiche(selected.id)
        .then((res) => {
          if (res.success && res.data) {
            setStats((res.data.monsterStats ?? null) as MonsterStats | null);
            setDungeonMaps(res.data.dungeonMaps);
          } else {
            setStats(null);
            setDungeonMaps(null);
          }
        })
        .catch(() => {
          setStats(null);
          setDungeonMaps(null);
        })
        .finally(() => setLoadingStats(false));
      return;
    }

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

  // 4. Filtrage dynamique selon le filtre sélectionné (Boss / Anomalies / Monstres / Titans) + recherche
  const filtered = useMemo(() => {
    let pool = catalog;
    if (catalogFilter === "boss") {
      pool = pool.filter((e) => e.type === "boss");
    } else if (catalogFilter === "anomalie") {
      pool = pool.filter((e) => e.type === "anomalie");
    } else if (catalogFilter === "raid") {
      pool = pool.filter((e) => e.type === "raid");
    } else if (catalogFilter === "monstre") {
      pool = pool.filter((e) => e.type === "monstre");
    } else if (catalogFilter === "titan") {
      pool = pool.filter((e) => e.type === "titan");
    } else if (catalogFilter === "bounty") {
      /* 🎯 Avis de recherche — contenu siphonné (DofusDB + Dofensive), catégorie dédiée. */
      pool = pool.filter((e) => e.type === "bounty");
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
    { id: "info" as OverlayTab, label: isEn ? "Stats" : "Stats", asset: "/assets/dofus/modules/character.png" },
    { id: "sorts" as OverlayTab, label: isEn ? "Spells" : "Sorts", asset: "/assets/dofus/modules/spells.png" },
    { id: "sim" as OverlayTab, label: isEn ? "Simulation" : "Simulation", asset: "/assets/dofus/modules/map.png" },
    { id: "loot" as OverlayTab, label: isEn ? "Loot" : "Butin", asset: "/assets/dofus/modules/chest.png" },
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
            aria-label={isEn ? "Back" : "Retour"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/dofus/icons/crossedSwords.png"
            alt=""
            className="w-4 h-4 object-contain opacity-75 shrink-0"
          />
          <span className="text-[13px] font-semibold text-white/90 truncate">
            {selected ? (activeMonsterName ?? selected.bossName) : (isEn ? "Bestiary" : "Bestiaire")}
          </span>
          {/* Niveau : donnée, pas décoration — mono discret, aucun badge coloré. */}
          {selected && (
            <span className="ml-1 font-mono text-[10px] text-white/40 shrink-0">
              {t.bossPage.levelShort} {selected.level}
            </span>
          )}
          {/* Seul or conservé : la Quête Ocre (or = sémantique Dofus, pas accent d'UI). */}
          {selected?.isOcreQuest && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-amber-300/80 shrink-0"
              title={isEn ? "Eternal Harvest (Ochre) Quest Boss" : "Boss de la Quête de l'Éternelle Moisson (Ocre)"}
            >
              <Sparkles className="w-2.5 h-2.5" /> {isEn ? "Ochre" : "Ocre"}
            </span>
          )}
          {/* Boss de raid */}
          {selected?.type === "raid" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-purple-300/90 shrink-0 font-medium"
            >
              <ShieldAlert className="w-2.5 h-2.5 text-purple-400" /> {isEn ? "Raid" : "Raid"}
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
              placeholder={t.bossPage.overlaySearchPlaceholder}
              autoFocus
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 focus:bg-white/[0.08] transition-colors"
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

          {/* Filtres du catalogue : contrôle segmenté unique, état actif neutre */}
          <div className="grid grid-cols-6 gap-0.5 rounded-lg bg-white/[0.05] p-0.5">
            {([
              { id: "boss" as CatalogFilter, label: isEn ? "Bosses" : "Boss" },
              { id: "anomalie" as CatalogFilter, label: isEn ? "Anomalies" : "Anomalies" },
              { id: "raid" as CatalogFilter, label: isEn ? "Raids" : "Raids" },
              { id: "bounty" as CatalogFilter, label: isEn ? "Bounties" : "Avis" },
              { id: "monstre" as CatalogFilter, label: isEn ? "Monsters" : "Monstres" },
              { id: "titan" as CatalogFilter, label: isEn ? "Titans" : "Titans" },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setCatalogFilter(id)}
                className={cn(
                  "py-1 text-[10px] rounded-[5px] transition-colors text-center truncate",
                  catalogFilter === id ? "bg-white/[0.12] text-white" : "text-white/45 hover:text-white/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero fixe + Tabs fixes (fiche sélectionnée) ── */}
      {selected && (
        <div className="shrink-0 bg-[#0d0d12]">
          {/* Hero replié ou déplié */}
          {!isHeroCollapsed ? (
            <div className="relative flex items-start gap-3 px-3 pt-2.5 pb-2.5 border-b border-white/[0.06]">
              <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center overflow-hidden shrink-0">
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
                <p className="flex items-center gap-1 text-[11px] text-white/45 truncate">
                  <Compass className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="truncate">{selected.name}</span>
                </p>

                {/* Sélecteur de « Rang » façon client Dofus Unity (RANG : 1 2 3 4 5) */}
                {stats?.grades && stats.grades.length > 1 && (
                  stats.grades.length > 5 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 mt-1.5 text-[10px]">
                      <span className="text-white/45">{isEn ? "Rank:" : "Rang :"}</span>
                      <select
                        value={activeGradeIndex}
                        onChange={(e) => setActiveGradeIndex(Number(e.target.value))}
                        className="bg-transparent text-white font-mono text-[10px] focus:outline-none cursor-pointer"
                      >
                        {stats.grades.map((g, idx) => (
                          <option key={idx} value={idx} className="bg-[#121218] text-white">
                            {isEn ? "Rank" : "Rang"} {idx + 1} · {t.bossPage.levelShort} {g.level}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] p-0.5 mt-1.5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-1">
                        {isEn ? "Rank:" : "Rang :"}
                      </span>
                      {stats.grades.map((g, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveGradeIndex(idx)}
                          className={cn(
                            "min-w-[22px] h-5 text-[10px] px-1.5 rounded-[4px] font-mono transition-colors cursor-pointer",
                            idx === activeGradeIndex
                              ? "bg-white/[0.16] text-white font-bold"
                              : "text-white/45 hover:text-white/75"
                          )}
                          title={`${isEn ? "Rank" : "Rang"} ${idx + 1} · ${t.bossPage.levelShort} ${g.level}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                  )
                )}

                {/* Liens externes : liens texte discrets (plus de boutons bordés). */}
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  {/* Segment d'URL : slug public (nom du boss) ; en interne, le
                      deep-link accepte le slug comme l'identifiant. */}
                  <a
                    href={guildId && guildId !== "public" ? `/dashboard/${guildId}/succes?view=boss&dungeon=${selected.slug ?? selected.id}` : `/boss/${selected.slug ?? selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-white/45 hover:text-white/85 transition-colors"
                    title={isEn ? "Open full guide on SigilOS" : "Ouvrir la fiche complète sur SigilOS"}
                  >
                    <img src="/assets/ui/logo-v2.png" alt="" className="w-3 h-3 object-contain opacity-80" />
                    <span>{isEn ? "SigilOS Sheet" : "Fiche SigilOS"}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Bouton pour réduire le hero */}
              <button
                type="button"
                onClick={() => setIsHeroCollapsed(true)}
                className="absolute top-2 right-2 p-1 text-white/30 hover:text-white/80 hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                title={isEn ? "Collapse header to expand space" : "Réduire l'en-tête pour agrandir l'espace"}
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
                <span className="font-semibold text-white/90 truncate text-[11px]">{selected.bossName}</span>
                <span className="text-[10px] text-white/40 truncate">· {selected.name}</span>
                {stats?.grades && stats.grades.length > 1 && (
                  <span className="font-mono text-[10px] text-white/40 shrink-0">
                    {isEn ? "rank" : "rang"} {1 + activeGradeIndex}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsHeroCollapsed(false)}
                className="inline-flex items-center gap-1 text-[10px] text-white/45 hover:text-white/85 transition-colors shrink-0 cursor-pointer"
                title={isEn ? "Expand full header" : "Déplier l'en-tête complet"}
              >
                <span>{isEn ? "Expand" : "Déplier"}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Onglets — avec assets officiels du jeu */}
          <div className="flex border-b border-white/[0.06]">
            {tabs.map(({ id, label, asset }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] transition-colors border-b-2 -mb-px cursor-pointer",
                  tab === id
                    ? "border-white/70 text-white font-semibold"
                    : "border-transparent text-white/40 hover:text-white/70"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset}
                  alt=""
                  className={cn("w-3.5 h-3.5 object-contain", tab !== id && "opacity-45")}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone de contenu SCROLLABLE ──
          `.overlay-scroll` (globals.css) : gouttière large et hit-testable, `pointer-events`
          garanti, `overscroll-behavior: contain`. Corrige le §B (barre de défilement non
          « attrapable » à la souris alors que la molette fonctionnait : la gouttière était
          trop étroite / non stylée dans le document PiP). */}
      <div
        className={cn(
          "flex-1 min-h-0",
          tab === "sim" ? "flex flex-col overflow-hidden" : "overlay-scroll"
        )}
      >
        {/* Liste du catalogue (1ère page) */}
        {!selected && (
          <>
            {loadingList ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/30">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[11px]">{isEn ? "Loading…" : "Chargement…"}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-white/25">
                <Swords className="w-6 h-6" />
                <span className="text-[11px]">{isEn ? "No results" : "Aucun résultat"}</span>
              </div>
            ) : (
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {filtered.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectEntry(d)}
                    className="group flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] transition-colors text-center relative"
                  >
                    {d.isOcreQuest && (
                      <span className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] text-amber-300/80" title={isEn ? "Eternal Harvest (Ochre) Quest Boss" : "Boss de la Quête Ocre"}>
                        <img src="/module-dofus/Dofus_Ocre.png" alt="" className="w-3 h-3 object-contain" />
                        {isEn ? "Ochre" : "Ocre"}
                      </span>
                    )}
                    <div className="w-14 h-14 flex items-center justify-center overflow-hidden">
                      <MonsterImage
                        src={d.imageUrl}
                        alt={d.bossName}
                        monsterId={d.dofusdbId ?? undefined}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-[11px] font-medium text-white/85 truncate leading-tight">
                        {d.bossName}
                      </p>
                      <p className={cn(
                        "text-[9px] truncate",
                        d.type === "monstre" ? "text-sky-400/60" : d.type === "bounty" ? "text-rose-400/70" : "text-white/35"
                      )}>
                        {d.name}
                      </p>
                    </div>
                    {d.level > 0 && (
                      <span className="font-mono text-[9px] text-white/35">{t.bossPage.levelShort} {d.level}</span>
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
                <span className="text-[11px]">{isEn ? "Loading…" : "Chargement…"}</span>
              </div>
            ) : currentGrade ? (
              <>
                {/* Famille du donjon : ligne cliquable discrète (plus de cadre + badge) */}
                {family && family.monsters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFamilyModal(true)}
                    className="group flex w-full items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <Users className="w-3.5 h-3.5 text-white/40" />
                    <span className="flex-1 text-[11px] text-white/70 group-hover:text-white/90 transition-colors">
                      {isEn ? "Dungeon Family" : "Famille du donjon"}
                      <span className="ml-1.5 font-mono text-white/40">{family.monsters.length}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
                  </button>
                )}

                {/* Mécanique de combat officielle / Passif */}
                {stats?.passive?.description && (
                  <BossMechanicsView passive={stats.passive} isCompact />
                )}

                {/* Caractéristiques : une ligne de lecture (icône + valeur + libellé),
                    séparée par des filets — remplace les 3 cartes à gros nombres colorés. */}
                <div className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-lg bg-white/[0.03]">
                  {[
                    { label: t.bossPage.stats.hp, shortLabel: isEn ? "HP" : "PV", value: currentGrade.lifePoints, iconSrc: "/assets/dofus/stats/pv.png" },
                    { label: t.bossPage.stats.ap, shortLabel: isEn ? "AP" : "PA", value: currentGrade.actionPoints, iconSrc: "/assets/dofus/stats/pa.png" },
                    { label: t.bossPage.stats.mp, shortLabel: isEn ? "MP" : "PM", value: currentGrade.movementPoints, iconSrc: "/assets/dofus/stats/pm.png" },
                  ].map(({ label, shortLabel, value, iconSrc }) => (
                    <div key={label} className="flex items-center justify-center gap-2 py-2.5">
                      <img src={iconSrc} alt={label} className="w-5 h-5 object-contain opacity-90" />
                      <span className="font-mono text-[15px] text-white/90 tabular-nums">
                        {value.toLocaleString(locale === "en" ? "en-US" : "fr-FR")}
                      </span>
                      <span className="text-[11px] text-white/40">{shortLabel}</span>
                    </div>
                  ))}
                </div>

                {/* Caractéristiques avancées officielles (Tacle, Fuite, Esquives, Retraits, Puissance, Soin, Initiative) */}
                {(currentGrade.tackle !== undefined || currentGrade.tackleBlock !== undefined || currentGrade.apDodge !== undefined || currentGrade.power !== undefined) && (
                  <div className="space-y-1.5 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-[10px] font-mono">
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="flex flex-col items-center">
                        <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                          <img src="/assets/dofus/stats/tacle.png" alt="" className="w-3 h-3 object-contain" />
                          {isEn ? "Lock" : "Tacle"}
                        </span>
                        <span className="text-white font-semibold tabular-nums mt-0.5">
                          {currentGrade.tackle ?? currentGrade.tackleBlock ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                          <img src="/assets/dofus/stats/fuite.png" alt="" className="w-3 h-3 object-contain" />
                          {isEn ? "Dodge" : "Fuite"}
                        </span>
                        <span className="text-white font-semibold tabular-nums mt-0.5">
                          {currentGrade.evade ?? currentGrade.tackleEvade ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                          <img src="/assets/dofus/stats/esquivePA.png" alt="" className="w-3 h-3 object-contain" />
                          {isEn ? "AP Dodge" : "Esq PA"}
                        </span>
                        <span className="text-white font-semibold tabular-nums mt-0.5">
                          {currentGrade.apDodge ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                          <img src="/assets/dofus/stats/esquivePM.png" alt="" className="w-3 h-3 object-contain" />
                          {isEn ? "MP Dodge" : "Esq PM"}
                        </span>
                        <span className="text-white font-semibold tabular-nums mt-0.5">
                          {currentGrade.mpDodge ?? "—"}
                        </span>
                      </div>
                    </div>

                    {/* Ligne secondaire : Retraits, Puissance, Soins (si présents) */}
                    {(currentGrade.apRemoval !== undefined || currentGrade.mpRemoval !== undefined || (currentGrade.power !== undefined && currentGrade.power > 0) || (currentGrade.healBonus !== undefined && currentGrade.healBonus > 0)) && (
                      <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-white/[0.05]">
                        {currentGrade.apRemoval !== undefined && (
                          <div className="flex flex-col items-center">
                            <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                              <img src="/assets/dofus/stats/retraitPA.png" alt="" className="w-3 h-3 object-contain" />
                              {isEn ? "AP Red" : "Ret PA"}
                            </span>
                            <span className="text-white font-semibold tabular-nums mt-0.5">{currentGrade.apRemoval}</span>
                          </div>
                        )}
                        {currentGrade.mpRemoval !== undefined && (
                          <div className="flex flex-col items-center">
                            <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                              <img src="/assets/dofus/stats/retraitPM.png" alt="" className="w-3 h-3 object-contain" />
                              {isEn ? "MP Red" : "Ret PM"}
                            </span>
                            <span className="text-white font-semibold tabular-nums mt-0.5">{currentGrade.mpRemoval}</span>
                          </div>
                        )}
                        {currentGrade.power !== undefined && currentGrade.power > 0 && (
                          <div className="flex flex-col items-center">
                            <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                              <img src="/assets/dofus/stats/puissance.png" alt="" className="w-3 h-3 object-contain" />
                              {isEn ? "Power" : "Puissance"}
                            </span>
                            <span className="text-white font-semibold tabular-nums mt-0.5">{currentGrade.power}</span>
                          </div>
                        )}
                        {currentGrade.healBonus !== undefined && currentGrade.healBonus > 0 && (
                          <div className="flex flex-col items-center">
                            <span className="flex items-center gap-1 text-white/40 text-[9px] uppercase">
                              <img src="/assets/dofus/stats/soin.png" alt="" className="w-3 h-3 object-contain" />
                              {isEn ? "Heal" : "Soin"}
                            </span>
                            <span className="text-white font-semibold tabular-nums mt-0.5">{currentGrade.healBonus}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {currentGrade.initiative !== undefined && currentGrade.initiative > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] px-1 text-[10px]">
                        <span className="flex items-center gap-1 text-white/40">
                          <img src="/assets/dofus/stats/initiative.png" alt="" className="w-3 h-3 object-contain" />
                          {isEn ? "Initiative" : "Initiative"}
                        </span>
                        <span className="text-amber-300/90 font-semibold tabular-nums">
                          {currentGrade.initiative.toLocaleString(locale === "en" ? "en-US" : "fr-FR")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Immunités et restrictions de combat (Dofensive / DofusDB) */}
                {stats?.encyclo && (() => {
                  const props = encycloProperties(stats.encyclo, currentGrade?.level ?? null);
                  if (props.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {props.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/10 text-red-300 border border-red-500/20"
                        >
                          <ShieldAlert className="w-2.5 h-2.5 text-red-400 shrink-0" />
                          {p}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {/* Résistances — 5 lignes, une couleur par élément (donnée de jeu) */}
                {resists && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Shield className="w-3 h-3" /> {isEn ? "Resistances" : "Résistances"}
                    </p>
                    <ResistBar
                      label={t.bossPage.stats.neutral}
                      value={resists.neutral ?? 0}
                      iconSrc="/assets/dofus/stats/resNeutre.png"
                      barColor="bg-zinc-400"
                    />
                    <ResistBar
                      label={t.bossPage.stats.earth}
                      value={resists.earth ?? 0}
                      iconSrc="/assets/dofus/stats/resTerre.png"
                      barColor="bg-amber-600"
                    />
                    <ResistBar
                      label={t.bossPage.stats.fire}
                      value={resists.fire ?? 0}
                      iconSrc="/assets/dofus/stats/resFeu.png"
                      barColor="bg-red-500"
                    />
                    <ResistBar
                      label={t.bossPage.stats.water}
                      value={resists.water ?? 0}
                      iconSrc="/assets/dofus/stats/resEau.png"
                      barColor="bg-sky-500"
                    />
                    <ResistBar
                      label={t.bossPage.stats.air}
                      value={resists.air ?? 0}
                      iconSrc="/assets/dofus/stats/resAir.png"
                      barColor="bg-emerald-500"
                    />
                  </div>
                )}

              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Swords className="w-6 h-6" />
                <span className="text-[11px]">{isEn ? "No data" : "Aucune donnée"}</span>
              </div>
            )}
          </div>
        )}

        {/* Onglet Sorts */}
        {selected && tab === "sorts" && (
          <div className="p-3 space-y-3">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">{isEn ? "Loading…" : "Chargement…"}</span>
              </div>
            ) : (
              <>
                {/* Mécanique de combat officielle / Passif de début de combat (repliable) */}
                {stats?.passive?.description && (
                  <BossMechanicsView
                    passive={stats.passive}
                    isCompact
                    collapsible
                    defaultCollapsed={false}
                  />
                )}

                {stats?.spells && stats.spells.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">
                      {isEn ? "Action Spells" : "Sorts d'action"} ({stats.spells.length})
                    </p>
                    {stats.spells.map((spell) => (
                      <SpellCard
                        key={spell.id}
                        spell={spell}
                        locale={locale}
                        isOpen={activeSpellId === spell.id}
                        onToggle={() => setActiveSpellId(spell.id === activeSpellId ? undefined : spell.id)}
                      />
                    ))}
                  </div>
                ) : !stats?.passive?.description ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                    <Zap className="w-6 h-6" />
                    <span className="text-[11px]">{isEn ? "No spells available" : "Aucun sort disponible"}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Onglet Simulation */}
        {selected && tab === "sim" && (
          <div className="flex-1 h-full flex flex-col min-h-0 p-1.5 overflow-hidden">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">{isEn ? "Loading…" : "Chargement…"}</span>
              </div>
            ) : stats?.spells && stats.spells.length > 0 ? (
              <div className="flex-1 min-h-0 flex flex-col">
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
                    allowFreeCasterMove
                    freeCasterMove={freeBossMove}
                    onFreeCasterMoveChange={setFreeBossMove}
                  />
                </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Brain className="w-6 h-6" />
                <span className="text-[11px]">{isEn ? "No spell to simulate" : "Aucun sort à simuler"}</span>
              </div>
            )}
          </div>
        )}

        {/* Onglet Butin — sorti de l'onglet Stats pour aérer */}
        {selected && tab === "loot" && (
          <div className="p-3">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10 text-white/25 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">{isEn ? "Loading…" : "Chargement…"}</span>
              </div>
            ) : stats?.drops && stats.drops.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                    {isEn ? "Drops & Loot" : "Butins"}
                  </p>
                  <span className="font-mono text-[10px] text-white/40">
                    {isEn ? "Rank" : "Rang"} {1 + activeGradeIndex}
                    {currentGrade ? ` · ${t.bossPage.levelShort} ${currentGrade.level}` : ""}
                  </span>
                </div>

                <div className="divide-y divide-white/[0.05] pr-0.5">
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
                      <div key={drop.objectId} className="flex items-center gap-2 py-1.5">
                        <div className="w-6 h-6 flex items-center justify-center overflow-hidden shrink-0">
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
                        <span className="flex-1 truncate text-[11px] text-white/80">{drop.name}</span>
                        <div className="h-[3px] w-12 shrink-0 rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-white/40"
                            style={{ width: `${Math.min(100, dropPercent)}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right font-mono text-[11px] text-white/70 tabular-nums">
                          {dropPercent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/25">
                <Gem className="w-6 h-6" />
                <span className="text-[11px]">{isEn ? "No loot" : "Aucun butin"}</span>
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
              <Users className="w-4 h-4 text-white/50" />
              <span className="text-[12px] font-bold text-white">
                {isEn ? "Family" : "Famille"} ({family.monsters.length})
              </span>
            </div>
            <button
              onClick={() => setShowFamilyModal(false)}
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10"
              aria-label={t.bossPage.closeModal}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1 overlay-scroll">
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
                    "w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors",
                    isCurrent ? "bg-white/[0.10] text-white" : "hover:bg-white/[0.05] text-white/75"
                  )}
                >
                  <div className="w-9 h-9 flex items-center justify-center overflow-hidden shrink-0">
                    <MonsterImage
                      src={m.imageUrl}
                      alt={m.name}
                      monsterId={m.id}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{m.name}</p>
                    <p className="text-[9px] text-white/40">
                      {m.isBoss ? (isEn ? "Dungeon Keeper" : "Gardien du donjon") : (isEn ? "Room Monster" : "Monstre de salle")}
                    </p>
                  </div>
                  {m.isBoss && <span className="text-[9px] text-amber-300/80 shrink-0">Boss</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer fixe ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06] shrink-0 bg-[#0d0d12] z-10">
        <span className="text-[9px] text-white/25">SigilOS · {isEn ? "Bestiary" : "Bestiaire"}</span>
        {selected && (
          <span className="text-[9px] text-white/30 truncate ml-2">
            {activeMonsterName ?? selected.bossName}
          </span>
        )}
      </div>
    </div>
  );
}
