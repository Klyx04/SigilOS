"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Swords, ChevronDown, ArrowRight } from "lucide-react";
import type { BestiaireEntry } from "@/server/actions/game-data-actions";
import { useI18n } from "@/lib/i18n/client";

interface PublicBossCatalogClientProps {
  bosses: BestiaireEntry[];
}

const RAW_LEVEL_RANGES = [
  { min: 1, max: 200 },
  { min: 1, max: 50 },
  { min: 51, max: 100 },
  { min: 101, max: 150 },
  { min: 151, max: 190 },
  { min: 191, max: 200 },
];

const RAW_TYPE_FILTERS = [
  "all",
  "boss",
  "anomalie",
  "titan",
  "bounty",
] as const;

type TypeFilter = (typeof RAW_TYPE_FILTERS)[number];

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
  }, [open]);

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
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState(0);
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");

  const typeOptions = [
    { value: "all", label: t.bossPage.allTypes },
    { value: "boss", label: t.bossPage.bossType },
    { value: "anomalie", label: t.bossPage.anomalieType },
    { value: "titan", label: t.bossPage.titanType },
    { value: "bounty", label: t.bossPage.bountyType },
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

    return bosses.filter((b) => {
      if (b.type !== "boss" && b.type !== "titan" && b.type !== "anomalie" && b.type !== "bounty") return false;
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

      {/* ── COMPTEUR ── */}
      <div className="px-1 text-xs text-muted-foreground">
        <span className="font-mono">{filteredBosses.length}</span>{" "}
        {locale === "en"
          ? `entry${filteredBosses.length > 1 ? "ies" : ""} — dungeon bosses, titans, and playable monsters`
          : `entrée${filteredBosses.length > 1 ? "s" : ""} — boss de donjon, titans et monstres jouables`}
      </div>

      {/* ── CARTES ── */}
      {filteredBosses.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-border bg-surface/30 text-muted-foreground text-xs">
          {t.bossPage.noResults}
        </div>
      ) : (
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
                    {t.bossPage.tacticalSheet}
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
