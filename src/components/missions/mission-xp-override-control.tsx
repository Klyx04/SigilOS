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
    const [realXp, setRealXp] = useState<number>(0);
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
                const rXp = res.data.realXp || 0;
                setRealXp(rXp);
                setCurrentOverride(val ?? null);
                if (val !== null && val !== undefined) {
                    setInputValue(val.toString());
                    setSliderValue(val);
                } else {
                    setInputValue(rXp.toString());
                    setSliderValue(rXp);
                }
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [guildId]);

    const syncFromSlider = (vals: number[]) => {
        const v = Math.max(vals[0], realXp);
        setSliderValue(v);
        setInputValue(v.toString());
    };

    const syncFromInput = (raw: string) => {
        setInputValue(raw);
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= realXp && n <= maxXP) {
            setSliderValue(n);
        }
    };

    const handleSave = async () => {
        const n = parseInt(inputValue, 10);
        if (isNaN(n) || n < realXp || n > maxXP) {
            toast.error(`Valeur invalide. Le total ne peut être inférieur à l'XP vérifié (${realXp.toLocaleString()}).`);
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
            setInputValue(realXp.toString());
            setSliderValue(realXp);
            toast.success("🔄 Override supprimé — calcul automatique réactivé.");
        } else {
            toast.error(res.error || "Erreur");
        }
        setSaving(false);
    };

    const percentage = Math.round((sliderValue / maxXP) * 100);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement...
            </div>
        );
    }

    return (
        <div className="p-5 rounded-2xl border border-border bg-surface/50 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warning/10">
                    <SlidersHorizontal className="w-4 h-4 text-warning" />
                </div>
                <div>
                    <h4 className="text-sm font-black text-foreground">Ajustement manuel XP</h4>
                    <p className="text-caption text-muted-foreground">
                        Déplace la barre de progression manuellement. Utile si le jeu n'envoie pas les données.
                    </p>
                </div>
                {currentOverride !== null && (
                    <div className="ml-auto flex items-center gap-1.5 text-caption font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                        Override actif : {currentOverride.toLocaleString()} XP
                    </div>
                )}
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-info/5 border border-info/10">
                <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <p className="text-xs text-info/70 leading-relaxed">
                    Les membres ont actuellement vérifié <b>{realXp.toLocaleString()} XP</b>. 
                    Le curseur détermine le total de la jauge et bloque toute pénalité non intentionnelle.
                    {currentOverride === null && <span className="text-muted-foreground"> Aucun override actif — calcul automatique.</span>}
                </p>
            </div>

            {/* Slider */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-caption font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="text-success">{realXp.toLocaleString()} XP (Min)</span>
                    <span className="text-foreground">{percentage}%</span>
                    <span>{maxXP.toLocaleString()} XP (Palier {targetTier})</span>
                </div>

                <input
                    type="range"
                    min={realXp}
                    max={maxXP}
                    step={100}
                    value={sliderValue}
                    onChange={e => syncFromSlider([Number(e.target.value)])}
                    className="w-full accent-info cursor-pointer"
                    style={{ height: '4px' }}
                />

                {/* Progress preview */}
                <div className="relative h-3 w-full rounded-full bg-elevated overflow-hidden">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-info via-info to-fuchsia-500 transition-all duration-300 ease-out rounded-full "
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Input row */}
            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <Input
                        type="number"
                        min={realXp}
                        max={maxXP}
                        value={inputValue}
                        onChange={e => syncFromInput(e.target.value)}
                        placeholder="Valeur XP exacte..."
                        className="bg-elevated/80 border-border text-foreground placeholder-zinc-600 pr-14 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">XP</span>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving || !inputValue}
                    className="bg-warning hover:bg-warning text-warning-foreground shadow-lg gap-2 shrink-0"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Appliquer
                </Button>
                {currentOverride !== null && (
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        disabled={saving}
                        className="shrink-0 text-muted-foreground hover:text-danger hover:bg-danger/10 gap-2"
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
