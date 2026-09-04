"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Swords,
  Shield,
  Zap,
  Package,
  Layers,
  Users,
  ExternalLink,
  ArrowRight,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { useBossOverlay } from "@/hooks/use-boss-overlay";

interface PublicBossDetailClientProps {
  dungeon: {
    id: string;
    name: string;
    bossName?: string | null;
    level?: number | null;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
  };
  monsterStats?: any;
  spellsData?: any;
}

export function PublicBossDetailClient({
  dungeon,
  monsterStats,
  spellsData,
}: PublicBossDetailClientProps) {
  const bossName = dungeon.bossName || dungeon.name;
  const { openBossOverlay } = useBossOverlay("public");

  const [activeTab, setActiveTab] = useState<"sorts" | "sim" | "grades" | "drops">("sorts");
  const [activeSpellId, setActiveSpellId] = useState<number | undefined>(
    monsterStats?.spells?.[0]?.id
  );
  const [activeGradeIndex, setActiveGradeIndex] = useState<number>(0);

  const grades = monsterStats?.grades || [];
  const activeGrade = grades[activeGradeIndex ?? 0] || grades[0];
  const spells = monsterStats?.spells || [];
  const drops = monsterStats?.drops || [];

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION / HERO CARD ── */}
      <div className="rounded-3xl border border-white/10 bg-surface/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-background/80 border border-white/15 flex items-center justify-center p-2 shrink-0 shadow-inner">
            {(() => {
              let monsterId: string | null = null;
              if (dungeon.imageUrl) {
                const m = dungeon.imageUrl.match(/\/(\d+)\.(png|webp|jpg)/i);
                if (m) monsterId = m[1];
              }
              const src = monsterId
                ? `/api/assets-dofus/monsters/${monsterId}?url=${encodeURIComponent(dungeon.imageUrl!)}`
                : dungeon.imageUrl || "/assets/ui/monster-fallback.png";

              return (
                <img
                  src={src}
                  alt={bossName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = "/assets/ui/monster-fallback.png";
                  }}
                />
              );
            })()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Boss de Donjon</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px]">
                Niveau {dungeon.level ?? 200}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-foreground font-heading tracking-tight mt-1">
              {bossName}
            </h1>
            <p className="text-sm text-muted-foreground">{dungeon.name}</p>
          </div>
        </div>

        {/* Action Button: In-Game Overlay */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => openBossOverlay({ monsterName: bossName, dungeonName: dungeon.name })}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20"
            title="Affiche une mini-fenêtre par-dessus votre jeu Dofus"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ouvrir l'Overlay en jeu</span>
          </button>

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
            Créez une session de donjon sur Discord en 1 clic : les membres s'inscrivent avec leur classe, et leurs succès sont validés automatiquement.
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

      {/* ── TABS NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setActiveTab("sorts")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2",
            activeTab === "sorts"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          )}
        >
          <Zap className="w-4 h-4" />
          <span>Sorts ({spells.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sim")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2",
            activeTab === "sim"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          )}
        >
          <Brain className="w-4 h-4" />
          <span>Simulation Grille 3D</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("grades")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2",
            activeTab === "grades"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          )}
        >
          <Shield className="w-4 h-4" />
          <span>Caractéristiques & Résistances</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("drops")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2",
            activeTab === "drops"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          )}
        >
          <Package className="w-4 h-4" />
          <span>Butins & Drops ({drops.length})</span>
        </button>
      </div>

      {/* ── TAB CONTENT: SORTS ── */}
      {activeTab === "sorts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spells.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-zinc-500 text-sm">
              Aucun sort détaillé répertorié pour ce boss.
            </div>
          ) : (
            spells.map((spell: any) => (
              <div
                key={spell.id}
                className="p-5 rounded-2xl border border-white/10 bg-surface/50 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {spell.imageUrl && (
                      <img
                        src={spell.imageUrl}
                        alt={spell.name}
                        className="w-10 h-10 rounded-xl bg-background/80 border border-white/10 p-1 object-contain"
                      />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{spell.name}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Coût : {spell.apCost ?? "?"} PA · Portée : {spell.range ?? "1"} PO
                      </p>
                    </div>
                  </div>
                  {spell.cooldown && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400 font-mono">
                      CD: {spell.cooldown} tours
                    </span>
                  )}
                </div>

                {spell.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {spell.description}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB CONTENT: SIMULATION 3D ── */}
      {activeTab === "sim" && (
        <div className="rounded-3xl border border-white/10 bg-surface/50 p-6 overflow-hidden shadow-2xl">
          <SpellRangeGrid
            spells={spells}
            activeSpellId={activeSpellId}
            onSelectSpell={(s) => setActiveSpellId(s.id)}
            bossName={bossName}
            bossImageUrl={dungeon.imageUrl || undefined}
            dungeonName={dungeon.name}
            grades={grades}
            activeGradeIndex={activeGradeIndex}
            onGradeChange={setActiveGradeIndex}
            compact={false}
          />
        </div>
      )}

      {/* ── TAB CONTENT: GRADES & STATS ── */}
      {activeTab === "grades" && (
        <div className="space-y-6">
          {/* Grade selection */}
          {grades.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground mr-2">Grade :</span>
              {grades.map((g: any, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveGradeIndex(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                    (activeGradeIndex ?? 0) === idx
                      ? "bg-amber-500 text-zinc-950 border-amber-400"
                      : "bg-surface text-zinc-400 border-white/10 hover:bg-white/[0.06]"
                  )}
                >
                  Grade {idx + 1} (Niv. {g.level})
                </button>
              ))}
            </div>
          )}

          {activeGrade && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-white/10 bg-surface/50 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  Points de Vie
                </span>
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  {activeGrade.lifePoints?.toLocaleString("fr-FR") ?? "—"}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-surface/50 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  PA / PM
                </span>
                <span className="text-xl font-black text-amber-400 tabular-nums">
                  {activeGrade.actionPoints ?? "—"} PA / {activeGrade.movementPoints ?? "—"} PM
                </span>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-surface/50 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  Tacle / Fuite
                </span>
                <span className="text-xl font-black text-blue-400 tabular-nums">
                  {activeGrade.tackleBlock ?? "—"} / {activeGrade.tackleEvade ?? "—"}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-surface/50 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  Initiative
                </span>
                <span className="text-xl font-black text-purple-400 tabular-nums">
                  {activeGrade.initiative?.toLocaleString("fr-FR") ?? "—"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: DROPS ── */}
      {activeTab === "drops" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {drops.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-zinc-500 text-sm">
              Aucun drop répertorié.
            </div>
          ) : (
            drops.map((drop: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-surface/40"
              >
                {drop.imageUrl && (
                  <img
                    src={drop.imageUrl}
                    alt={drop.name}
                    className="w-10 h-10 rounded-lg bg-background/80 border border-white/10 p-1 object-contain shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-foreground truncate">{drop.name}</h4>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    Taux : {drop.dropPercent ?? "?"}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
