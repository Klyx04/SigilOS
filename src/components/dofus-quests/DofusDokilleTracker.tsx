"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Footprints, 
    CheckCircle2, 
    Circle, 
    Sparkles, 
    Info, 
    Search, 
    ExternalLink, 
    ShieldAlert, 
    Gem,
    Trophy,
    Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Dokille Tracker — Le Safari des Krokilles (Vulkania)
// 20 Archimonstres répartis sur 4 zones/forêts avec pierres d'âmes conseillées
// ─────────────────────────────────────────────────────────────────────────────

export interface KrokilleZone {
    id: string;
    name: string;
    zoneName: string;
    levelRange: string;
    stoneAdvice: string;
    monsters: string[];
}

export const KROKILLE_ZONES: KrokilleZone[] = [
    {
        id: "moniaques",
        name: "Étape 1 — Krokilles Juvéniles",
        zoneName: "Forêt d'Etraktopel",
        levelRange: "Niveau 1 à 50 (Touriste)",
        stoneAdvice: "Petite pierre d'âme parfaite (50)",
        monsters: [
            "Krokette la Croustillante",
            "Krokillage la Marine",
            "Krokcinelle la Tachetée",
            "Krokikrisp la Céréalière",
            "Krokis l'Esquissée",
        ],
    },
    {
        id: "hygdales",
        name: "Étape 2 — Krokilles Novices",
        zoneName: "Forêt d'Espartiate",
        levelRange: "Niveau 51 à 100 (Amateur)",
        stoneAdvice: "Petite ou Moyenne pierre d'âme parfaite (50-100)",
        monsters: [
            "Krokenjambe la Tombeuse",
            "Kroktail la Désaltérante",
            "Krokotte la Minutée",
            "Krokée l'Entamée",
            "Krokblanche l'Immaculée",
        ],
    },
    {
        id: "andalires",
        name: "Étape 3 — Krokilles Matures",
        zoneName: "Forêt des Strates Igraphies",
        levelRange: "Niveau 101 à 150 (Spécialiste)",
        stoneAdvice: "Moyenne ou Grande pierre d'âme parfaite (100-150)",
        monsters: [
            "Krokrodaille la Mordante",
            "Kroknemboure la Mousseuse",
            "Krokine l'Allumeuse",
            "Krokue la Trompée",
            "Krokpit la Pilotée",
        ],
    },
    {
        id: "nesiques",
        name: "Étape 4 — Krokilles Vénérables",
        zoneName: "Forêt de Ponefarr",
        levelRange: "Niveau 151 à 200 (Expert)",
        stoneAdvice: "Grande ou Gigantesque pierre d'âme parfaite (150-200)",
        monsters: [
            "Krokage la Vorace",
            "Krokillagée la Sage",
            "Krokuite la Calcinée",
            "Krokobure la Maudite",
            "Krokrane la Distordue",
        ],
    },
];

export const ALL_KROKILLE_MONSTERS = KROKILLE_ZONES.flatMap(z => z.monsters);
export const ALL_MONSTERS = ALL_KROKILLE_MONSTERS;
export const TOTAL_MONSTERS = ALL_KROKILLE_MONSTERS.length; // 20

interface DofusDokilleTrackerProps {
    guildId: string;
    dofusId: string;
    dofusColor?: string;
    initialCaptured?: string[];
    isObtained?: boolean;
    onSave?: (monsters: string[]) => Promise<{ success: boolean; error?: string }>;
}

export function DofusDokilleTracker({
    guildId,
    dofusId,
    dofusColor = "#f59e0b",
    initialCaptured = [],
    isObtained = false,
    onSave,
}: DofusDokilleTrackerProps) {
    const [captured, setCaptured] = useState<Set<string>>(() => {
        if (isObtained) return new Set(ALL_KROKILLE_MONSTERS);
        return new Set(initialCaptured);
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, startSave] = useTransition();

    useEffect(() => {
        if (isObtained) {
            setCaptured(new Set(ALL_KROKILLE_MONSTERS));
        } else {
            setCaptured(new Set(initialCaptured));
        }
    }, [initialCaptured, isObtained]);

    const capturedCount = captured.size;
    const progressPercent = Math.round((capturedCount / TOTAL_MONSTERS) * 100);
    const isCompleted = capturedCount >= TOTAL_MONSTERS;

    const filteredZones = useMemo(() => {
        if (!searchQuery.trim()) return KROKILLE_ZONES;
        const q = searchQuery.toLowerCase().trim();
        return KROKILLE_ZONES.map(zone => {
            const matchesZone = zone.name.toLowerCase().includes(q) || zone.zoneName.toLowerCase().includes(q);
            const filteredMonsters = zone.monsters.filter(m => m.toLowerCase().includes(q));
            if (matchesZone) return zone;
            return {
                ...zone,
                monsters: filteredMonsters,
            };
        }).filter(zone => zone.monsters.length > 0);
    }, [searchQuery]);

    function toggleMonster(monsterName: string) {
        const next = new Set(captured);
        if (next.has(monsterName)) {
            next.delete(monsterName);
        } else {
            next.add(monsterName);
        }
        setCaptured(next);

        const list = Array.from(next);
        if (onSave) {
            startSave(async () => {
                const res = await onSave(list);
                if (!res.success) {
                    toast.error(res.error || "Erreur de sauvegarde de capture");
                }
            });
        }
    }

    function toggleAllInZone(zone: KrokilleZone) {
        const allZoneDone = zone.monsters.every(m => captured.has(m));
        const next = new Set(captured);
        if (allZoneDone) {
            zone.monsters.forEach(m => next.delete(m));
        } else {
            zone.monsters.forEach(m => next.add(m));
        }
        setCaptured(next);

        const list = Array.from(next);
        if (onSave) {
            startSave(async () => {
                const res = await onSave(list);
                if (res.success) {
                    toast.success(allZoneDone ? `Zone ${zone.name} décochée` : `Zone ${zone.name} complétée !`);
                } else {
                    toast.error(res.error || "Erreur lors de la mise à jour");
                }
            });
        }
    }

    return (
        <div className="space-y-6">
            {/* Header / Guide banner */}
            <div
                className="rounded-3xl p-6 border relative overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${dofusColor}12 0%, var(--foreground)/[0.03] 100%)`,
                    border: `1px solid ${dofusColor}30`,
                }}
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-xl bg-warning/10 text-warning">
                                <Footprints className="w-5 h-5" />
                            </span>
                            <h2 className="text-lg font-black tracking-tight text-foreground uppercase">
                                Le Safari des Krokilles — Trackeur d&apos;Archimonstres
                            </h2>
                            {isCompleted && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black tracking-wider uppercase text-[10px]">
                                    <Trophy className="w-3 h-3 mr-1 inline" /> 20/20 Capturés
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                            Rapportez les 20 âmes d&apos;archimonstres Krokilles à <strong className="text-foreground">Nevark le Chasseur</strong> en <span className="font-mono font-bold text-warning">[-47,42]</span> (Village de Vulkania). 
                            Le repop est rapide (~30 min à 1h). Vous pouvez capturer ou combattre en groupe pour obtenir les éclats.
                        </p>
                    </div>

                    {/* Progress pill */}
                    <div className="flex flex-col items-end justify-center min-w-[140px] p-4 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06]">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-wider">
                            Progression Safari
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-2xl font-black tabular-nums" style={{ color: dofusColor }}>
                                {capturedCount}
                            </span>
                            <span className="text-sm font-bold text-muted-foreground">/ {TOTAL_MONSTERS}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-foreground/10 overflow-hidden mt-2">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${progressPercent}%`,
                                    background: isCompleted
                                        ? "linear-gradient(90deg, #10b981, #34d399)"
                                        : `linear-gradient(90deg, ${dofusColor}, #fbbf24)`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Quick search input */}
                <div className="mt-5 pt-4 border-t border-foreground/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                            placeholder="Rechercher une Krokille ou une zone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background/50 border-foreground/10 h-9 text-xs rounded-xl focus-visible:ring-warning/30"
                        />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
                        <a
                            href="https://www.dofuspourlesnoobs.com/le-safari-des-acircmes.html"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-warning hover:underline font-semibold"
                        >
                            Guide DPLN Safari <ExternalLink className="w-3 h-3" />
                        </a>
                        <span>•</span>
                        <span>Prérequis : Quête <em className="text-foreground/80 font-medium">Premier contact</em> + <em className="text-foreground/80 font-medium">Chasse aux Krokilles</em></span>
                    </div>
                </div>
            </div>

            {/* 4 Stages Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredZones.map(zone => {
                    const zoneDoneCount = zone.monsters.filter(m => captured.has(m)).length;
                    const isZoneComplete = zoneDoneCount === zone.monsters.length && zone.monsters.length > 0;

                    return (
                        <div
                            key={zone.id}
                            className="rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between"
                            style={{
                                background: isZoneComplete
                                    ? "linear-gradient(145deg, rgba(16,185,129,0.06) 0%, var(--foreground)/[0.02] 100%)"
                                    : "linear-gradient(145deg, var(--foreground)/[0.03] 0%, var(--foreground)/[0.01] 100%)",
                                borderColor: isZoneComplete ? "rgba(16,185,129,0.3)" : "var(--foreground)/[0.08]",
                            }}
                        >
                            <div>
                                {/* Stage header */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-foreground uppercase tracking-wide">
                                                {zone.name}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-bold px-1.5 py-0 ${
                                                    isZoneComplete
                                                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                                        : "border-foreground/15 text-muted-foreground"
                                                }`}
                                            >
                                                {zoneDoneCount}/{zone.monsters.length}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                            <span className="font-semibold text-warning">{zone.zoneName}</span>
                                            <span>•</span>
                                            <span>{zone.levelRange}</span>
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleAllInZone(zone)}
                                        className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground font-semibold rounded-lg hover:bg-foreground/5"
                                    >
                                        {isZoneComplete ? "Tout décocher" : "Tout cocher"}
                                    </Button>
                                </div>

                                {/* Stone hint */}
                                <div className="text-[11px] bg-foreground/[0.03] px-2.5 py-1.5 rounded-lg border border-foreground/[0.05] text-muted-foreground/80 mb-3.5 flex items-center gap-1.5">
                                    <Gem className="w-3 h-3 text-warning shrink-0" />
                                    <span>Pierre d&apos;âme : <strong className="text-foreground/90">{zone.stoneAdvice}</strong></span>
                                </div>

                                {/* Monsters list */}
                                <div className="space-y-1.5">
                                    {zone.monsters.map(monster => {
                                        const isCaptured = captured.has(monster);
                                        return (
                                            <button
                                                key={monster}
                                                type="button"
                                                onClick={() => toggleMonster(monster)}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all duration-150 group ${
                                                    isCaptured
                                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                                                        : "bg-foreground/[0.02] border-foreground/[0.06] text-foreground/80 hover:bg-foreground/[0.05] hover:border-foreground/[0.12]"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 truncate">
                                                    {isCaptured ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    ) : (
                                                        <Circle className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0" />
                                                    )}
                                                    <span className={`truncate ${isCaptured ? "line-through opacity-80" : ""}`}>
                                                        {monster}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider shrink-0 ${
                                                        isCaptured
                                                            ? "bg-emerald-500/25 text-emerald-300"
                                                            : "bg-foreground/5 text-muted-foreground group-hover:bg-warning/15 group-hover:text-warning"
                                                    }`}
                                                >
                                                    {isCaptured ? "Capturé" : "À capturer"}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
