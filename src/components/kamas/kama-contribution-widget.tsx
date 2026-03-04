"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
    Coins, Plus, Minus, Upload, X, Loader2,
    CheckCircle2, Clock, ChevronDown, ChevronUp,
    Info, Star, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    submitKamaDonation,
    getMyWeeklyKamaStatus,
    type KamaWeeklyStatus,
} from "@/server/actions/kama-actions";
import {
    KAMA_TRANCHE, KAMA_MAX_TRANCHES, KAMA_MAX_PER_WEEK,
    REWARDS_PER_TRANCHE,
} from "@/lib/kama-constants";

interface KamaContributionWidgetProps {
    guildId: string;
    initialStatus: KamaWeeklyStatus | null;
}

export function KamaContributionWidget({ guildId, initialStatus }: KamaContributionWidgetProps) {
    const [status, setStatus] = useState<KamaWeeklyStatus | null>(initialStatus);
    const [expanded, setExpanded] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [tranches, setTranches] = useState(1);
    const [note, setNote] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<"form" | "proof">("form");
    const fileRef = useRef<HTMLInputElement>(null);

    const tranchesLeft = status?.tranchesLeft ?? KAMA_MAX_TRANCHES;
    const canContribute = (status?.canContribute ?? true) && tranchesLeft > 0;

    const refreshStatus = useCallback(async () => {
        const res = await getMyWeeklyKamaStatus(guildId);
        if (res.success && res.data) setStatus(res.data);
    }, [guildId]);

    const handleFile = (f: File) => {
        const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
        if (!ALLOWED.includes(f.type)) { toast.error("JPEG, PNG ou WebP uniquement."); return; }
        if (f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB."); return; }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleSubmit = async () => {
        if (!file) { toast.error("Ajoutez un screenshot de preuve."); return; }
        setSubmitting(true);
        const fd = new FormData();
        fd.append("file", file);
        const res = await submitKamaDonation({ guildId, tranches, note: note || null }, fd);
        if (res.success) {
            toast.success(`✅ Don de ${(tranches * KAMA_TRANCHE).toLocaleString("fr-FR")} kamas soumis !`);
            setTranches(1); setNote(""); setFile(null); setPreview(null); setStep("form");
            setExpanded(false);
            await refreshStatus();
        } else {
            toast.error(res.error || "Erreur lors de la soumission.");
        }
        setSubmitting(false);
    };

    const totalKamas = tranches * KAMA_TRANCHE;
    const totalRewards = {
        xp: tranches * REWARDS_PER_TRANCHE.xp,
        guildatons: tranches * REWARDS_PER_TRANCHE.guildatons,
        guild_kamas: tranches * REWARDS_PER_TRANCHE.guild_kamas,
    };

    const pendingCount = status?.weekDonations.filter(d => d.status === "PENDING").length ?? 0;
    const validatedKamas = status?.validatedThisWeek ?? 0;
    const submittedKamas = status?.submittedThisWeek ?? 0;
    const progressPct = Math.min(100, (submittedKamas / KAMA_MAX_PER_WEEK) * 100);

    return (
        <>
            {/* ── Widget principal ── */}
            <div className="rounded-xl border border-amber-500/15 bg-zinc-950/80 overflow-hidden transition-all duration-300">

                {/* Header — always visible */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(e => !e)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(prev => !prev); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                    </div>

                    <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-white">Contribution kamas</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-0.5">
                                {Array.from({ length: KAMA_MAX_TRANCHES }).map((_, i) => {
                                    const tranchesDone = Math.floor(submittedKamas / KAMA_TRANCHE);
                                    const isValidated = i < Math.floor(validatedKamas / KAMA_TRANCHE);
                                    const isPending = !isValidated && i < tranchesDone;
                                    return (
                                        <div
                                            key={i}
                                            className={`w-2 h-2 rounded-full transition-all duration-300 ${isValidated ? "bg-emerald-400" : isPending ? "bg-amber-400 animate-pulse" : "bg-zinc-700"}`}
                                        />
                                    );
                                })}
                            </div>
                            <span className="text-[10px] text-zinc-500">
                                {KAMA_MAX_TRANCHES - tranchesLeft}/{KAMA_MAX_TRANCHES} tranches
                            </span>
                            {pendingCount > 0 && (
                                <span className="text-[9px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                    {pendingCount} en attente
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                        {!canContribute && (
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                MAX ✓
                            </span>
                        )}
                        <button
                            onClick={e => { e.stopPropagation(); setShowHelp(true); }}
                            className="p-1 rounded-md hover:bg-white/5 text-zinc-600 hover:text-zinc-400 transition-colors"
                            title="Comment ça marche ?"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        {expanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                            : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                        }
                    </div>
                </div>

                {/* Expanded content */}
                {expanded && (
                    <div className="border-t border-white/5 p-3 space-y-3">
                        {/* Info block */}
                        <div className="flex items-start gap-2 bg-zinc-900/60 rounded-lg p-2.5 border border-white/5">
                            <Info className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                            <div className="text-[10px] text-zinc-500 space-y-0.5">
                                <p>Max <span className="text-white font-bold">{KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} kamas</span> par semaine</p>
                                <p>Chaque tranche de <span className="text-amber-400 font-bold">10 000k</span> → {REWARDS_PER_TRANCHE.xp} XP · {REWARDS_PER_TRANCHE.guildatons} guildatons</p>
                            </div>
                        </div>

                        {/* Weekly progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Progression hebdo</span>
                                <span className="text-zinc-400 font-mono">
                                    {submittedKamas.toLocaleString("fr-FR")} / {KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} k
                                </span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {canContribute ? (
                            step === "form" ? (
                                <>
                                    {/* Tranche selector */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                            Nombre de tranches
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setTranches(t => Math.max(1, t - 1))}
                                                disabled={tranches <= 1}
                                                className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="flex-1 text-center">
                                                <div className="text-lg font-black text-amber-400 font-mono">{tranches}</div>
                                                <div className="text-[10px] text-zinc-500">= {totalKamas.toLocaleString("fr-FR")} kamas</div>
                                            </div>
                                            <button
                                                onClick={() => setTranches(t => Math.min(tranchesLeft, t + 1))}
                                                disabled={tranches >= tranchesLeft}
                                                className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setTranches(tranchesLeft)}
                                                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-[10px] font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>

                                    {/* Rewards preview */}
                                    <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-2 border border-white/5">
                                        <Star className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span className="text-[10px] text-zinc-400">Récompenses :</span>
                                        <div className="flex items-center gap-3 ml-auto">
                                            <span className="text-[10px] font-bold text-blue-300">+{totalRewards.xp} XP</span>
                                            <span className="text-[10px] font-bold text-amber-300">+{totalRewards.guildatons} guildatons</span>
                                            <span className="text-[10px] font-bold text-emerald-300">+{totalRewards.guild_kamas} k.g.</span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => setStep("proof")}
                                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 h-9 text-sm"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Ajouter la preuve screenshot
                                    </Button>
                                </>
                            ) : (
                                // Step 2: screenshot upload
                                <>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setStep("form")}
                                            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                        >
                                            ← Retour
                                        </button>
                                        <span className="text-[10px] text-zinc-600">
                                            {totalKamas.toLocaleString("fr-FR")} kamas ({tranches} tranche{tranches > 1 ? "s" : ""})
                                        </span>
                                    </div>

                                    {preview ? (
                                        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-zinc-800/50">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={preview} alt="Preuve" className="w-full max-h-48 object-contain" />
                                            <button
                                                onClick={() => { setPreview(null); setFile(null); }}
                                                className="absolute top-2 right-2 p-1 rounded-full bg-zinc-900/80 border border-white/10 text-zinc-300 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className="border-2 border-dashed border-white/10 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all group"
                                            onClick={() => fileRef.current?.click()}
                                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                                            onDragOver={e => e.preventDefault()}
                                        >
                                            <Upload className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                                            <p className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors text-center">
                                                Screenshot du comptoir d&apos;inventaire<br />
                                                <span className="text-[10px] text-zinc-600">JPEG · PNG · WebP · max 5MB</span>
                                            </p>
                                        </div>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                    />

                                    <Button
                                        onClick={handleSubmit}
                                        disabled={submitting || !file}
                                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold gap-2 h-9 text-sm"
                                    >
                                        {submitting
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
                                            : <><CheckCircle2 className="w-4 h-4" /> Confirmer le don</>
                                        }
                                    </Button>
                                </>
                            )
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-2">
                                <div className="p-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                </div>
                                <p className="text-xs font-bold text-emerald-300 text-center">Maximum hebdomadaire atteint !</p>
                                <p className="text-[10px] text-zinc-500 text-center">
                                    {submittedKamas.toLocaleString("fr-FR")} kamas contribués cette semaine.<br />
                                    Reset au prochain cycle de missions.
                                </p>
                            </div>
                        )}

                        {pendingCount > 0 && (
                            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-2">
                                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                <p className="text-[10px] text-amber-300">
                                    {pendingCount} don{pendingCount > 1 ? "s" : ""} en cours de validation.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modale d'aide ── */}
            {showHelp && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setShowHelp(false)}
                >
                    <div
                        className="bg-zinc-900 border border-amber-500/20 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-amber-500/5">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Coins className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-white">Comment déclarer un don ?</p>
                                <p className="text-[10px] text-zinc-500">Mécanique officielle Dofus</p>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="relative bg-zinc-950/80 border-b border-white/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/missions/don-kamas-guilde.png"
                                alt="Interface don de kamas Dofus"
                                className="w-full object-contain max-h-52"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-3">
                                <p className="text-[10px] text-amber-300 font-bold">
                                    📍 Interface du comptoir d&apos;inventaire en jeu
                                </p>
                            </div>
                        </div>

                        <div className="p-5 space-y-3">
                            {[
                                { step: "1", text: "En jeu, ouvre le coffre de guilde et fais un don de kamas (multiples de 10 000)." },
                                { step: "2", text: "Prends un screenshot du comptoir d'inventaire avec le montant visible." },
                                { step: "3", text: "Reviens ici, sélectionne le nombre de tranches et uploade le screenshot." },
                                { step: "4", text: "Un admin valide. Dès validation : XP et guildatons comptabilisés automatiquement." },
                            ].map(({ step, text }) => (
                                <div key={step} className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {step}
                                    </div>
                                    <p className="text-xs text-zinc-400 leading-relaxed">{text}</p>
                                </div>
                            ))}

                            <div className="mt-3 p-3 bg-zinc-800/50 rounded-xl border border-white/5">
                                <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-2">Limites hebdomadaires</p>
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-zinc-500">
                                    <span>Max par semaine :</span>
                                    <span className="text-amber-400 font-bold">{KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} kamas</span>
                                    <span>Max tranches :</span>
                                    <span className="text-amber-400 font-bold">{KAMA_MAX_TRANCHES} tranches</span>
                                    <span>Par tranche :</span>
                                    <span className="text-blue-400 font-bold">+{REWARDS_PER_TRANCHE.xp} XP · +{REWARDS_PER_TRANCHE.guildatons} guildatons</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
