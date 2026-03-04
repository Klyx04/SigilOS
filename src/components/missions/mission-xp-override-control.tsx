"use client";

import { useState, useEffect } from "react";
import { setGuildMissionXpOverride, getGuildMissionXpOverride } from "@/server/actions/mission-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal, RotateCcw, Check, Info } from "lucide-react";
import { GUILD_TIERS } from "@/lib/game-data/guild-tiers";

interface MissionXpOverrideControlProps {
    guildId: string;
    targetTier?: number;
}

export function MissionXpOverrideControl({ guildId, targetTier = 3 }: MissionXpOverrideControlProps) {
    const maxXP = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS]?.xpMax || 10000;

    const [currentOverride, setCurrentOverride] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const [sliderValue, setSliderValue] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getGuildMissionXpOverride(guildId).then(res => {
            if (cancelled) return;
            if (res.success && res.data) {
                const val = res.data.xpOverride;
                setCurrentOverride(val ?? null);
                if (val !== null && val !== undefined) {
                    setInputValue(val.toString());
                    setSliderValue(val);
                }
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [guildId]);

    const syncFromSlider = (vals: number[]) => {
        const v = vals[0];
        setSliderValue(v);
        setInputValue(v.toString());
    };

    const syncFromInput = (raw: string) => {
        setInputValue(raw);
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 0 && n <= maxXP) {
            setSliderValue(n);
        }
    };

    const handleSave = async () => {
        const n = parseInt(inputValue, 10);
        if (isNaN(n) || n < 0 || n > maxXP) {
            toast.error(`Valeur invalide. L'XP doit être entre 0 et ${maxXP.toLocaleString()}.`);
            return;
        }
        setSaving(true);
        const res = await setGuildMissionXpOverride({ guildId, xpOverride: n });
        if (res.success) {
            setCurrentOverride(n);
            toast.success(`✅ Barre XP fixée à ${n.toLocaleString()} XP — la page missions reflète maintenant cette valeur.`);
        } else {
            toast.error(res.error || "Erreur");
        }
        setSaving(false);
    };

    const handleReset = async () => {
        setSaving(true);
        const res = await setGuildMissionXpOverride({ guildId, xpOverride: null });
        if (res.success) {
            setCurrentOverride(null);
            setInputValue("");
            setSliderValue(0);
            toast.success("🔄 Override supprimé — calcul automatique réactivé.");
        } else {
            toast.error(res.error || "Erreur");
        }
        setSaving(false);
    };

    const percentage = Math.round((sliderValue / maxXP) * 100);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
            </div>
        );
    }

    return (
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                    <h4 className="text-sm font-black text-white">Ajustement manuel XP</h4>
                    <p className="text-[10px] text-zinc-500">
                        Déplace la barre de progression manuellement. Utile si le jeu n'envoie pas les données.
                    </p>
                </div>
                {currentOverride !== null && (
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Override actif : {currentOverride.toLocaleString()} XP
                    </div>
                )}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200/70 leading-relaxed">
                    La barre d'activité calcule l'XP automatiquement depuis les soumissions validées.
                    Cet override <b>remplace</b> temporairement ce calcul sans modifier les soumissions.
                    {currentOverride === null && <span className="text-zinc-500"> Aucun override actif — calcul automatique.</span>}
                </p>
            </div>

            {/* Slider */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <span>0 XP</span>
                    <span className="text-white">{percentage}%</span>
                    <span>{maxXP.toLocaleString()} XP (Palier {targetTier})</span>
                </div>

                <input
                    type="range"
                    min={0}
                    max={maxXP}
                    step={100}
                    value={sliderValue}
                    onChange={e => syncFromSlider([Number(e.target.value)])}
                    className="w-full accent-purple-500 cursor-pointer"
                    style={{ height: '4px' }}
                />

                {/* Progress preview */}
                <div className="relative h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 via-purple-500 to-fuchsia-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Input row */}
            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <Input
                        type="number"
                        min={0}
                        max={maxXP}
                        value={inputValue}
                        onChange={e => syncFromInput(e.target.value)}
                        placeholder="Valeur XP exacte..."
                        className="bg-zinc-800/80 border-white/10 text-white placeholder-zinc-600 pr-14 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 pointer-events-none">XP</span>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving || !inputValue}
                    className="bg-amber-600 hover:bg-amber-500 text-white shadow-lg gap-2 shrink-0"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Appliquer
                </Button>
                {currentOverride !== null && (
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        disabled={saving}
                        className="shrink-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-2"
                        title="Supprimer l'override et revenir au calcul automatique"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Reset
                    </Button>
                )}
            </div>
        </div>
    );
}
