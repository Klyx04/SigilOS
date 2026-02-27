"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Loader2, MessageSquare, Trophy, Swords, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDreamRun } from "@/server/actions/songes/dream-run-actions";
import { DIFFICULTIES, OBJECTIVES, EPREUVES_SONGE, type DifficultyKey, type ObjectiveKey, type EpreuveCode } from "@/lib/songes/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Couleur selon difficulté
function getDifficultyBadgeColor(diffKey: DifficultyKey) {
    if (diffKey.startsWith("CAUCHEMAR")) return "text-red-400 bg-red-900/20 border-red-500/30";
    if (diffKey.startsWith("PARADOXE")) return "text-amber-400 bg-amber-900/20 border-amber-500/30";
    return "text-emerald-400 bg-emerald-900/20 border-emerald-500/30";
}


// Component
// ─────────────────────────────────────────────────────────
export function CreateRunButton({ guildId, isDiscordConfigured }: { guildId: string; isDiscordConfigured?: boolean }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"standard" | "epreuve">("standard");

    // Standard mode
    const [difficulty, setDifficulty] = useState<DifficultyKey>("REVE_III");
    const [objectives, setObjectives] = useState<ObjectiveKey[]>([]);

    // Épreuve mode
    const [selectedEpreuve, setSelectedEpreuve] = useState<EpreuveCode | null>(null);

    // Shared
    const [publishToDiscord, setPublishToDiscord] = useState(!!isDiscordConfigured);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitReset, setRateLimitReset] = useState<number | null>(null); // timestamp ms
    const [countdown, setCountdown] = useState<string | null>(null);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Countdown timer tick
    useEffect(() => {
        if (!rateLimitReset) { setCountdown(null); return; }
        const tick = () => {
            const remaining = rateLimitReset - Date.now();
            if (remaining <= 0) { setRateLimitReset(null); setCountdown(null); setError(null); return; }
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            setCountdown(m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [rateLimitReset]);

    const handleCreate = () => {
        if (mode === "standard") {
            if (objectives.length === 0) {
                setError("Veuillez sélectionner au moins un objectif.");
                return;
            }
            setError(null);
            startTransition(async () => {
                const result = await createDreamRun(guildId, { difficulty, objectives, publishToDiscord });
                if (result.success) {
                    toast.success("Run créée avec succès !");
                    setOpen(false);
                    setObjectives([]);
                    router.refresh();
                } else if (result.resetAt) {
                    setRateLimitReset(result.resetAt);
                    toast.error("Limite atteinte", { description: "Tu as créé trop de runs récemment. Patiente un peu." });
                } else {
                    setError(result.error || "Erreur inconnue");
                }
            });
        } else {
            // Épreuve mode
            if (!selectedEpreuve) {
                setError("Veuillez sélectionner une épreuve.");
                return;
            }
            const epreuve = EPREUVES_SONGE.find(e => e.code === selectedEpreuve)!;
            setError(null);
            startTransition(async () => {
                const result = await createDreamRun(guildId, {
                    difficulty: epreuve.difficulty,
                    objectives: ["SUCCES_NO_ACHAT"],
                    publishToDiscord,
                    epreuveCode: epreuve.code,
                });
                if (result.success) {
                    toast.success(`Épreuve ${epreuve.code} lancée !`);
                    setOpen(false);
                    setSelectedEpreuve(null);
                    router.refresh();
                } else if (result.resetAt) {
                    setRateLimitReset(result.resetAt);
                    toast.error("Limite atteinte", { description: "Tu as créé trop de runs récemment. Patiente un peu." });
                } else {
                    setError(result.error || "Erreur inconnue");
                }
            });
        }
    };

    const toggleObjective = (obj: ObjectiveKey) => {
        setObjectives(prev =>
            prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
        );
    };

    const isParadoxeOrMore = difficulty.startsWith("PARADOXE") || difficulty.startsWith("CAUCHEMAR");

    const availableObjectives = Object.entries(OBJECTIVES).filter(([key]) => {
        if (key === "FUN") return false;
        if (key === "DROP_LEGENDE" || key === "SUCCES_NO_ACHAT") return isParadoxeOrMore;
        return true;
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-500 text-white gap-2">
                    <Plus className="w-4 h-4" />
                    Créer une Run
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-[#0c0514] border-white/10 text-white max-w-lg shadow-2xl shadow-black/60">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2 text-white">
                        🌙 Nouvelle Run Songes
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={mode} onValueChange={(v) => { setMode(v as "standard" | "epreuve"); setError(null); }} className="pt-2">
                    <TabsList className="w-full bg-white/5 border border-white/8 p-1 rounded-lg mb-4">
                        <TabsTrigger
                            value="standard"
                            className="flex-1 gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(147,51,234,0.4)] text-white/50 font-bold uppercase tracking-wide text-xs transition-all rounded"
                        >
                            <Swords className="w-3.5 h-3.5" />
                            Run Standard
                        </TabsTrigger>
                        <TabsTrigger
                            value="epreuve"
                            className="flex-1 gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(217,119,6,0.4)] text-white/50 font-bold uppercase tracking-wide text-xs transition-all rounded"
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            Épreuve de Songe
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── MODE STANDARD ─── */}
                    <TabsContent value="standard" className="space-y-4 mt-0">
                        {/* Difficulty */}
                        <div className="space-y-2">
                            <Label className="text-white/60 text-xs uppercase tracking-widest font-bold">Difficulté</Label>
                            <Select value={difficulty} onValueChange={(v) => {
                                setDifficulty(v as DifficultyKey);
                                const isNewParadoxe = v.startsWith("PARADOXE") || v.startsWith("CAUCHEMAR");
                                if (!isNewParadoxe) {
                                    setObjectives(prev => prev.filter(o => o !== "DROP_LEGENDE" && o !== "SUCCES_NO_ACHAT"));
                                }
                            }}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white hover:bg-white/8 transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0c0514] border-white/10">
                                    {Object.entries(DIFFICULTIES).map(([key, value]) => (
                                        <SelectItem key={key} value={key} className="text-white focus:bg-white/10">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: value.couleur }} />
                                                {value.label}
                                                <span className="text-white/40 text-xs">({value.xpBonus}% XP/Butin)</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Objectives */}
                        <div className="space-y-2">
                            <Label className="text-white/60 text-xs uppercase tracking-widest font-bold">Objectifs (Choix multiple)</Label>
                            <div className="grid grid-cols-1 gap-1.5">
                                {availableObjectives.map(([key, value]) => {
                                    const isSelected = objectives.includes(key as ObjectiveKey);
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => toggleObjective(key as ObjectiveKey)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                isSelected
                                                    ? "bg-purple-600/25 border-purple-500/60 text-purple-100"
                                                    : "bg-white/3 border-white/8 text-white/50 hover:bg-white/6 hover:text-white/70"
                                            )}
                                        >
                                            <div className="text-lg">{value.icon}</div>
                                            <div className="text-sm font-medium">{value.label}</div>
                                            {isSelected && (
                                                <div className="ml-auto w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ─── MODE ÉPREUVE ─── */}
                    <TabsContent value="epreuve" className="mt-0">
                        <p className="text-xs text-white/30 mb-3 leading-relaxed">
                            Parcours prédéfinis liés à des succès en jeu. La difficulté et le mode sont imposés par l'épreuve choisie.
                        </p>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {EPREUVES_SONGE.map((epreuve) => {
                                const isSelected = selectedEpreuve === epreuve.code;
                                const badgeColor = getDifficultyBadgeColor(epreuve.difficulty);
                                return (
                                    <div
                                        key={epreuve.code}
                                        onClick={() => setSelectedEpreuve(isSelected ? null : epreuve.code)}
                                        className={cn(
                                            "relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 group",
                                            isSelected
                                                ? "border-amber-500/50 bg-amber-900/15 shadow-[0_0_20px_rgba(217,119,6,0.1)]"
                                                : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                                        )}
                                    >
                                        {/* Barre colorée latérale */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-opacity"
                                            style={{
                                                backgroundColor: epreuve.color,
                                                opacity: isSelected ? 1 : 0.3,
                                            }}
                                        />

                                        {/* Icône */}
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all",
                                            isSelected ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 border border-white/8"
                                        )}>
                                            {epreuve.icon}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn("text-sm font-bold", isSelected ? "text-amber-200" : "text-white/80")}>
                                                    {epreuve.label}
                                                </span>
                                                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", badgeColor)}>
                                                    {epreuve.difficultyLabel}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-white/35 leading-relaxed mt-0.5 line-clamp-2">
                                                {epreuve.description}
                                            </p>
                                            {/* Succès associé */}
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <Trophy className="w-3 h-3 text-amber-500/60" />
                                                <span className="text-[10px] text-amber-500/50 font-semibold">
                                                    Succès : Épreuve {epreuve.code}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] shrink-0 mt-1" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* ─── DISCORD TOGGLE (commun aux 2 modes) ─── */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-white/8 bg-white/3">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-[#5865F2]" />
                            <div>
                                <p className="text-sm font-medium text-white/80">Publier sur Discord</p>
                                <p className="text-xs text-white/35">Embed avec boutons rejoindre/quitter</p>
                            </div>
                        </div>
                        <Switch
                            checked={publishToDiscord}
                            onCheckedChange={setPublishToDiscord}
                            disabled={!isDiscordConfigured}
                            className="data-[state=checked]:bg-[#5865F2]"
                        />
                    </div>
                    {!isDiscordConfigured && (
                        <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight italic px-2">
                            ⚠️ Salon Discord non configuré par l'admin. Publication impossible.
                        </p>
                    )}
                </div>

                {/* Note épreuve */}
                {mode === "epreuve" && selectedEpreuve && (
                    <p className="text-[10px] text-white/25 flex items-center gap-1.5">
                        <Trophy className="w-3 h-3 text-amber-500/40" />
                        Pas de butin ni d&apos;expérience pour les Épreuves.
                    </p>
                )}

                {/* Error / Rate Limit countdown */}
                {countdown && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-950/30 text-sm">
                        <Timer className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                        <div className="flex-1">
                            <p className="text-amber-300 font-bold text-sm">Limite de création atteinte</p>
                            <p className="text-amber-500/70 text-xs mt-0.5">Disponible dans <span className="font-mono font-black text-amber-300">{countdown}</span></p>
                        </div>
                    </div>
                )}
                {!countdown && error && (
                    <div className="text-red-400 text-sm bg-red-900/15 p-3 rounded-lg border border-red-500/25">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <Button
                    onClick={handleCreate}
                    disabled={isPending}
                    className={cn(
                        "w-full font-bold",
                        mode === "epreuve"
                            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                            : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                    )}
                >
                    {isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />Création...</>
                    ) : mode === "epreuve" ? (
                        <><Trophy className="w-4 h-4 mr-2" />Lancer l&apos;Épreuve</>
                    ) : (
                        "Créer la Run"
                    )}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
