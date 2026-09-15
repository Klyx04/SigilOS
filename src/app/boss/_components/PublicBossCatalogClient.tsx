"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Swords, ChevronDown, ArrowRight } from "lucide-react";
import type { BestiaireEntry } from "@/server/actions/game-data-actions";

interface PublicBossCatalogClientProps {
  bosses: BestiaireEntry[];
}

const LEVEL_RANGES = [
  { label: "Tous les niveaux", min: 1, max: 200 },
  { label: "Niveau 1 — 50", min: 1, max: 50 },
  { label: "Niveau 51 — 100", min: 51, max: 100 },
  { label: "Niveau 101 — 150", min: 101, max: 150 },
  { label: "Niveau 151 — 190", min: 151, max: 190 },
  { label: "Niveau 191 — 200", min: 191, max: 200 },
];

const TYPE_FILTERS = [
  { label: "Tous", value: "all" },
  { label: "Boss de donjon", value: "boss" },
  { label: "Fiches Anomalies", value: "anomalie" },
  { label: "Titans", value: "titan" },
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"];

/** Petit dropdown sobre (bouton + menu absolu, sans verrou scroll) : remplace le select natif. */
function FilterDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full sm:w-auto h-10 inline-flex items-center justify-between gap-2.5 pl-3.5 pr-3 rounded-xl bg-background/60 border border-white/10 text-xs font-bold text-foreground hover:border-white/25 focus:outline-none focus:border-amber-500/50 transition-colors cursor-pointer"
      >
        <span className="whitespace-nowrap">{current?.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-50 mt-2 min-w-full w-max max-w-[260px] rounded-lg border border-border-strong bg-elevated shadow-2xl p-1 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                o.value === value
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublicBossCatalogClient({ bosses }: PublicBossCatalogClientProps) {
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState(0);
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");

  const filteredBosses = useMemo(() => {
    const range = LEVEL_RANGES[selectedRange];
    const q = search.trim().toLowerCase();

    return bosses.filter((b) => {
      if (b.type !== "boss" && b.type !== "titan" && b.type !== "anomalie") return false;
      if (selectedType !== "all" && b.type !== selectedType) return false;
      const lvl = b.level ?? 0;
      if (lvl < range.min || lvl > range.max) return false;
      if (!q) return true;
      return (
        b.name?.toLowerCase().includes(q) ||
        b.bossName?.toLowerCase().includes(q)
      );
    });
  }, [bosses, search, selectedRange, selectedType]);

  return (
    <div className="space-y-5">
      {/* ── BARRE DE FILTRES ────────────────────────────────────────────────
          `relative z-30` : indispensable — la barre contient les menus déroulants
          (enfants `z-50`) et la grille de cartes SUIT dans le DOM. Sans contexte
          d'empilement positif ici, les cartes (positionnées) passaient devant les
          listes ouvertes (« le drop-down est sous le reste »). On retire aussi le
          `backdrop-blur` qui créait un contexte d'empilement à `z-auto`. */}
      <div className="relative z-30 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl bg-surface/60 border border-border">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un boss, un donjon..."
            aria-label="Rechercher un boss ou un donjon"
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-background/60 border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-warning/50 transition-colors"
          />
        </div>

        {/* Type (Tous / Boss / Anomalie / Titan) */}
        <FilterDropdown
          value={selectedType}
          onChange={(v) => setSelectedType(v as TypeFilter)}
          options={TYPE_FILTERS.map((t) => ({ value: t.value, label: t.label }))}
          ariaLabel="Filtrer par type"
        />

        {/* Niveau */}
        <FilterDropdown
          value={String(selectedRange)}
          onChange={(v) => setSelectedRange(Number(v))}
          options={LEVEL_RANGES.map((r, i) => ({ value: String(i), label: r.label }))}
          ariaLabel="Filtrer par niveau"
          align="right"
        />
      </div>

      {/* ── COMPTEUR ── */}
      <div className="px-1 text-xs text-muted-foreground">
        <span className="font-mono">{filteredBosses.length}</span> entrée{filteredBosses.length > 1 ? "s" : ""} — boss de donjon, titans et monstres jouables
      </div>

      {/* ── CARTES ──────────────────────────────────────────────────────────
          Sobriété volontaire : bordures franches, aucune ombre portée ni glow,
          un seul accent (or) réservé au survol. Aucune animation de zoom : on
          lit des données, on ne « vend » pas une app. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredBosses.map((boss) => {
          const bossName = boss.bossName || boss.name;
          const dungeonName = boss.name;

          return (
            <Link
              key={boss.id}
              href={`/boss/${boss.id}`}
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
                              // Fallback local garanti (l'ancien monster-fallback.png n'existe pas en public/)
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
                      <span className="font-mono font-semibold text-foreground/90">{boss.level}</span>
                      {boss.type === "titan" && (
                        <span className="uppercase tracking-wide text-[10px] text-warning/90">Titan</span>
                      )}
                      {boss.type === "anomalie" && (
                        <span className="uppercase tracking-wide text-[10px] text-info/90">Anomalie</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground group-hover:text-warning transition-colors">
                      Fiche
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
