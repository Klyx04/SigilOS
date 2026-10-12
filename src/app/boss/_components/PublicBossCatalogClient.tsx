"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, Swords, ArrowRight, Loader2 } from "lucide-react";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { searchNormalMonsters, type BestiaireEntry } from "@/server/actions/game-data-actions";
import { monsterFicheHref } from "@/lib/monster-fiche";
import { MonsterFamilyFilter } from "@/components/succes/MonsterFamilyFilter";
import { useI18n } from "@/lib/i18n/client";
import { BOSS_LEVEL_BRACKETS, matchesLevelBracket } from "@/lib/level-brackets";

interface PublicBossCatalogClientProps {
  bosses: BestiaireEntry[];
}

/**
 * Tranches de niveau : **source unique** `@/lib/level-brackets` (mêmes bornes, même ordre — la
 * tranche 0 reste « tous les niveaux »). On ne garde ici que les bornes : les valeurs d'UI
 * (`?niveau=`) restent des **index**, donc le contrat d'URL public ne bouge pas.
 */
const RAW_LEVEL_RANGES = BOSS_LEVEL_BRACKETS.map(({ min, max }) => ({ min, max }));

const RAW_TYPE_FILTERS = [
  "all",
  "boss",
  "anomalie",
  "titan",
  "bounty",
  "raid",
  /**
   * 🎯 Monstres NORMAUX (hors boss de donjon, avis de recherche, anomalies, titans et boss de
   * raid) : lus dans le **bestiaire local complet** (`searchNormalMonsters`, 5 129 monstres),
   * pas dans le catalogue passé au composant — celui-ci ne référence que les monstres des
   * familles de donjons. Chaque carte mène à `/bestiaire/<slug>`.
   */
  "monstre",
] as const;

/**
 * Nombre de monstres chargés d'un coup : le bestiaire en compte 5 129 — le champ de recherche
 * (filtré **côté serveur**, accents et familles inclus) sert à affiner, comme dans l'overlay.
 */
const MONSTER_LIST_LIMIT = 300;

type TypeFilter = (typeof RAW_TYPE_FILTERS)[number];

export function PublicBossCatalogClient({ bosses }: PublicBossCatalogClientProps) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState(0);
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");

  /**
   * Bestiaire local complet (5 129 monstres) — chargé **à la demande**, uniquement quand le
   * filtre « Monstres » est actif : la page publique ne transporte pas 5 129 entrées pour rien.
   */
  const [monsterCatalog, setMonsterCatalog] = useState<BestiaireEntry[]>([]);
  const [loadingMonsters, setLoadingMonsters] = useState(false);
  /** 2ᵉ niveau de filtre : famille (`raceId`) — « Monstres de quête », « Blops »… */
  const [monsterFamilyId, setMonsterFamilyId] = useState<number | null>(null);

  useEffect(() => {
    /**
     * Bestiaire local chargé dès que l'on affiche des **monstres** : filtre
     * « Monstres » **ou** filtre « Tout » (qui doit, lui aussi, inclure les
     * monstres normaux — « tout » ne filtrait en fait que les boss : mesure
     * du 12/10/2026, contrôle user).
     */
    if (selectedType !== "monstre" && selectedType !== "all") return;
    let cancelled = false;
    setLoadingMonsters(true);
    const timer = setTimeout(() => {
      searchNormalMonsters(search, MONSTER_LIST_LIMIT, monsterFamilyId)
        .then((res) => {
          if (!cancelled && res.success && Array.isArray(res.data)) setMonsterCatalog(res.data);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingMonsters(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedType, search, monsterFamilyId]);

  const typeOptions = [
    { value: "all", label: t.bossPage.allTypes, icon: null },
    { value: "boss", label: t.bossPage.bossType, icon: "/assets/dofus/icons/boss.png" },
    { value: "anomalie", label: t.bossPage.anomalieType, icon: "/assets/missions/ano1.png" },
    { value: "titan", label: t.bossPage.titanType, icon: "/assets/dofus/icons/titan.png" },
    { value: "bounty", label: t.bossPage.bountyType, icon: "/assets/avis/avitons.png" },
    { value: "raid", label: locale === "en" ? "Raid Boss" : "Boss de raid", icon: "/assets/dofus/icons/crown.png" },
    { value: "monstre", label: t.bossPage.monsterType, icon: "/assets/dofus/icons/archimonster.png" },
  ];

  const levelOptions = RAW_LEVEL_RANGES.map((r, i) => {
    if (i === 0) return { value: "0", label: t.bossPage.allLevels };
    return {
      value: String(i),
      label: locale === "en" ? `Level ${r.min} — ${r.max}` : `Niveau ${r.min} — ${r.max}`,
    };
  });

  const filteredBosses = useMemo(() => {
    const range = RAW_LEVEL_RANGES[selectedRange];
    const q = search.trim().toLowerCase();

    // Créatures déjà publiées (`/boss/<slug>`) : boss de donjon, avis de recherche,
    // titans, anomalies et boss de raid. Passe quand « Tout » ou le type exact est choisi.
    const published = bosses.filter((b) => {
      if (b.type !== "boss" && b.type !== "titan" && b.type !== "anomalie" && b.type !== "bounty" && b.type !== "raid") return false;
      if (selectedType !== "all" && b.type !== selectedType) return false;
      const lvl = b.level ?? 0;
      if (lvl < range.min || lvl > range.max) return false;
      if (!q) return true;
      return (
        b.name?.toLowerCase().includes(q) ||
        b.bossName?.toLowerCase().includes(q)
      );
    });

    // Un filtre de type explicite autre que « monstre » ne montre QUE ces créatures.
    if (selectedType === "boss" || selectedType === "anomalie" || selectedType === "titan" || selectedType === "bounty" || selectedType === "raid") {
      return published;
    }

    // « Monstres » (monstres normaux seuls) ou « Tout » (tout) : on ajoute le bestiaire
    // local complet. La recherche est faite **côté serveur** (`searchNormalMonsters` —
    // accents, familles, 5 129 entrées) : on n'applique ici que la tranche de niveau,
    // via la règle pure `matchesLevelBracket` (re-filtrer le texte contredirait le serveur).
    const bracket = BOSS_LEVEL_BRACKETS[selectedRange] ?? BOSS_LEVEL_BRACKETS[0];
    const monsters = monsterCatalog.filter((m) => matchesLevelBracket(m.level, bracket));
    return selectedType === "all" ? [...published, ...monsters] : monsters;
  }, [bosses, monsterCatalog, search, selectedRange, selectedType]);

  return (
    <div className="space-y-5">
      {/* ── BARRE DE FILTRES ── */}
      <div className="relative z-30 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl bg-surface/60 border border-border">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.bossPage.searchPlaceholder}
            aria-label={t.bossPage.searchPlaceholder}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-background/60 border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-warning/50 transition-colors"
          />
        </div>

        {/* Type */}
        <FilterDropdown
          value={selectedType}
          onChange={(v) => setSelectedType(v as TypeFilter)}
          options={typeOptions}
          ariaLabel={t.bossPage.typeFilterLabel}
        />

        {/* Niveau */}
        <FilterDropdown
          value={String(selectedRange)}
          onChange={(v) => setSelectedRange(Number(v))}
          options={levelOptions}
          ariaLabel={t.bossPage.levelFilterLabel}
          align="right"
        />
      </div>

      {/* ── FILTRE 2ᵉ NIVEAU (monstres uniquement) : familles réelles + sprites officiels ── */}
      {selectedType === "monstre" && (
        <MonsterFamilyFilter value={monsterFamilyId} onChange={setMonsterFamilyId} locale={locale} />
      )}

      {/* ── COMPTEUR ── */}
      <div className="px-1 text-xs text-muted-foreground">
        <span className="font-mono">{filteredBosses.length}</span>{" "}
        {selectedType === "monstre"
          ? locale === "en"
            ? `monster${filteredBosses.length > 1 ? "s" : ""} — normal monsters (no dungeon boss, bounty or titan)`
            : `monstre${filteredBosses.length > 1 ? "s" : ""} — monstres normaux (hors boss de donjon, avis et titans)`
          : selectedType === "all"
            ? locale === "en"
              ? `entries — dungeon bosses, monsters, bounties, titans, anomalies and raids`
              : `entrées — boss de donjon, monstres, avis de recherche, titans, anomalies et raids`
            : locale === "en"
              ? `entry${filteredBosses.length > 1 ? "ies" : ""} — dungeon bosses, bounties, titans, anomalies and raids`
              : `entrée${filteredBosses.length > 1 ? "s" : ""} — boss de donjon, avis de recherche, titans, anomalies et raids`}
        {(selectedType === "monstre" || selectedType === "all") && !loadingMonsters && monsterCatalog.length >= MONSTER_LIST_LIMIT && (
          <span className="ml-2 opacity-80">
            {locale === "en"
              ? `(first ${MONSTER_LIST_LIMIT} shown — refine your search)`
              : `(${MONSTER_LIST_LIMIT} premiers affichés — précisez la recherche)`}
          </span>
        )}
      </div>

      {/* ── CARTES ── */}
      {(selectedType === "monstre" || selectedType === "all") && loadingMonsters && filteredBosses.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-border bg-surface/30 text-muted-foreground text-xs">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          {locale === "en" ? "Loading monsters…" : "Chargement des monstres…"}
        </div>
      ) : filteredBosses.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-border bg-surface/30 text-muted-foreground text-xs">
          {t.bossPage.noResults}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBosses.map((boss) => {
            const bossName = boss.bossName || boss.name;
            const dungeonName = boss.name;
            // Un monstre normal a SA fiche (`/bestiaire/<slug>`, source unique `monsterFicheHref`) ;
            // une créature déjà publiée y redirige (307) — jamais deux pages pour la même bête.
            const href = boss.type === "monstre"
              ? (monsterFicheHref(boss.bossName || boss.name) ?? `/bestiaire/${boss.slug ?? boss.id}`)
              : `/boss/${boss.slug ?? boss.id}`;

            return (
              <Link
                key={boss.id}
                href={href}
                className="group rounded-lg border border-border bg-surface/30 hover:bg-surface/60 hover:border-warning/40 transition-colors p-3.5 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-md bg-background/70 border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {(() => {
                      let monsterId: string | null = boss.dofusdbId ? String(boss.dofusdbId) : null;
                      if (!monsterId && boss.imageUrl) {
                        const m = boss.imageUrl.match(/\/(\d+)\.(png|webp|jpg)/i);
                        if (m) monsterId = m[1];
                      }
                      const src = monsterId
                        ? `/api/assets-dofus/monsters/${monsterId}${boss.imageUrl ? `?url=${encodeURIComponent(boss.imageUrl)}` : ""}`
                        : boss.imageUrl || null;

                      return src ? (
                        <img
                          src={src}
                          alt={bossName}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = "/assets/dofus/icons/boss.png";
                          }}
                        />
                      ) : (
                        <Swords className="w-4 h-4 text-muted-foreground" />
                      );
                    })()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-warning transition-colors">
                      {bossName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{dungeonName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground/90">
                      {t.bossPage.levelShort} {boss.level}
                    </span>
                    {boss.type === "titan" && (
                      <span className="uppercase tracking-wide text-[10px] text-warning/90">Titan</span>
                    )}
                    {boss.type === "anomalie" && (
                      <span className="uppercase tracking-wide text-[10px] text-info/90">
                        {locale === "en" ? "Anomaly" : "Anomalie"}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-warning transition-colors">
                    {boss.type === "monstre"
                      ? (locale === "en" ? "Monster sheet" : "Fiche monstre")
                      : t.bossPage.tacticalSheet}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
