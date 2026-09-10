"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Sparkles, ChevronDown, ArrowRight } from "lucide-react";
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
          className={`absolute z-50 mt-2 min-w-full w-max max-w-[260px] rounded-xl border border-white/10 bg-popover shadow-2xl p-1 ${align === "right" ? "right-0" : "left-0"}`}
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
      if (b.type !== "boss" && b.type !== "titan") return false;
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
    <div className="space-y-6">
      {/* ── SEARCH & FILTERS BAR : 1 champ + 2 dropdowns compacts ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-2xl bg-surface/60 border border-white/[0.08] backdrop-blur-xl shadow-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un boss, un donjon..."
            aria-label="Rechercher un boss ou un donjon"
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-background/60 border border-white/10 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Type dropdown (Tous / Boss / Titan) */}
        <FilterDropdown
          value={selectedType}
          onChange={(v) => setSelectedType(v as TypeFilter)}
          options={TYPE_FILTERS.map((t) => ({ value: t.value, label: t.label }))}
          ariaLabel="Filtrer par type"
        />

        {/* Level dropdown */}
        <FilterDropdown
          value={String(selectedRange)}
          onChange={(v) => setSelectedRange(Number(v))}
          options={LEVEL_RANGES.map((r, i) => ({ value: String(i), label: r.label }))}
          ariaLabel="Filtrer par niveau"
          align="right"
        />
      </div>

      {/* ── COUNT & RESULT SUMMARY ── */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground font-semibold">
        <span>{filteredBosses.length} boss et donjons répertoriés</span>
        <span>Simulations de sorts & grille 3D disponibles</span>
      </div>

      {/* ── BOSS CARDS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBosses.map((boss) => {
          const bossName = boss.bossName || boss.name;
          const dungeonName = boss.name;

          return (
            <div
              key={boss.id}
              className="group relative rounded-2xl border border-white/[0.08] bg-surface/50 hover:bg-surface/80 hover:border-amber-500/30 p-5 transition-all duration-200 flex flex-col justify-between shadow-lg overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-background/80 border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
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
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              // Fallback local garanti (l'ancien monster-fallback.png n'existe pas en public/)
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = "/assets/dofus/icons/boss.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/[0.04] text-warning/40">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-warning transition-colors truncate">
                        {bossName}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{dungeonName}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-warning/10 border border-warning/20 text-warning font-mono font-bold text-[11px]">
                      Niv. {boss.level}
                    </span>
                    {boss.type === "titan" && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 font-black text-[10px] uppercase tracking-wider">
                        Titan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
                <Link
                  href={`/boss/${boss.id}`}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-warning/15 hover:bg-warning/25 text-warning text-xs font-bold border border-warning/30 transition-colors"
                >
                  <span>Fiche complète</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
