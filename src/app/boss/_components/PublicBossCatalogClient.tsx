"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Sparkles, Swords, ExternalLink, ShieldAlert, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BestiaireEntry } from "@/server/actions/game-data-actions";
import { useBossOverlay } from "@/hooks/use-boss-overlay";

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

export function PublicBossCatalogClient({ bosses }: PublicBossCatalogClientProps) {
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState(0);
  const { openBossOverlay } = useBossOverlay("public");

  const filteredBosses = useMemo(() => {
    const range = LEVEL_RANGES[selectedRange];
    const q = search.trim().toLowerCase();

    return bosses.filter((b) => {
      if (b.type !== "boss") return false;
      const lvl = b.level ?? 0;
      if (lvl < range.min || lvl > range.max) return false;
      if (!q) return true;
      return (
        b.name?.toLowerCase().includes(q) ||
        b.bossName?.toLowerCase().includes(q)
      );
    });
  }, [bosses, search, selectedRange]);

  return (
    <div className="space-y-6">
      {/* ── SEARCH & FILTERS BAR ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-surface/60 border border-white/[0.08] backdrop-blur-xl shadow-xl">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un boss, un donjon..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/60 border border-white/10 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 [scrollbar-width:none]">
          {LEVEL_RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setSelectedRange(i)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition-colors",
                selectedRange === i
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/10 hover:bg-white/[0.06] hover:text-zinc-200"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
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
                              // Fallback élégant en cas d'absence
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = "/assets/ui/monster-fallback.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/[0.04] text-amber-400/40">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground group-hover:text-amber-300 transition-colors truncate">
                        {bossName}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{dungeonName}</p>
                    </div>
                  </div>

                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold text-[11px]">
                    Niv. {boss.level}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openBossOverlay({ monsterName: bossName, dungeonName })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white text-xs font-bold border border-white/10 transition-colors"
                  title="Ouvrir la mini-fenêtre par-dessus votre jeu Dofus"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Overlay en jeu</span>
                </button>

                <Link
                  href={`/boss/${boss.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-colors"
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
