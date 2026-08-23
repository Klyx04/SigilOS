"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { cn } from "@/lib/utils";

interface KamaContributionWidgetProps {
    guildId: string;
    initialStatus: KamaWeeklyStatus | null;
}

/**
 * Sécurité (CodeQL js/xss-through-dom) : seules les URLs blob: (aperçu fichier local)
 * ou data:image/* sont acceptées en src d'image — jamais de javascript:/autre protocole.
 */
function safePreviewSrc(url: string | null): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        return u.protocol === "blob:" || (u.protocol === "data:" && u.pathname.startsWith("image/")) ? u.toString() : null;
    } catch {
        return null;
    }
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
    const [shouldPulse, setShouldPulse] = useState(false);

    const previewSrc = safePreviewSrc(preview);
    
    const fileRef = useRef<HTMLInputElement>(null);
    const widgetRef = useRef<HTMLDivElement>(null);

    const tranchesLeft = status?.tranchesLeft ?? KAMA_MAX_TRANCHES;
    const canContribute = (status?.canContribute ?? true) && tranchesLeft > 0;

    const refreshStatus = useCallback(async () => {
        const res = await getMyWeeklyKamaStatus(guildId);
        if (res.success && res.data) setStatus(res.data);
    }, [guildId]);

    const validateAndSetFile = async (f: File) => {
        const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
        if (!ALLOWED.includes(f.type)) { toast.error("JPEG, PNG ou WebP uniquement."); return; }
        if (f.size > 10 * 1024 * 1024) { toast.error("Max 10 MB."); return; }

        setFile(f);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(f));
    };

    useEffect(() => {
        if (step !== "proof" || !expanded) return;

        const handlePaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const f = e.clipboardData.files[0];
                if (f.type.startsWith("image/")) {
                    e.preventDefault();
                    validateAndSetFile(f);
                    toast.info("Image collée ! 📋");
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [step, expanded, guildId, preview]);

    // Handle hash routing to auto-expand and focus the widget
    useEffect(() => {
        const checkHash = () => {
            if (window.location.hash === "#don-kamas") {
                setExpanded(true);
                setShouldPulse(true);
                setTimeout(() => {
                    widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
                
                // Stop pulsing after 3 seconds
                const timer = setTimeout(() => setShouldPulse(false), 3000);
                return () => clearTimeout(timer);
            }
        };

        checkHash();
        window.addEventListener("hashchange", checkHash);
        return () => window.removeEventListener("hashchange", checkHash);
    }, []);

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
            <div 
                ref={widgetRef}
                className={cn(
                    "rounded-xl border overflow-hidden transition-all duration-300 shadow-lg",
                    shouldPulse 
                        ? "border-warning  scale-[1.01] ring-1 ring-warning/50" 
                        : "border-warning/30 bg-gradient-to-b from-warning/[0.04] to-background/80 shadow-[0_4px_20px_rgba(245,158,11,0.05)] hover:border-warning/50"
                )}
            >

                {/* Header — always visible */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(e => !e)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(prev => !prev); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors cursor-pointer"
                >
                    <div className="p-1.5 rounded-lg bg-warning/10 border border-warning/20 shrink-0">
                        <Coins className="w-3.5 h-3.5 text-warning" />
                    </div>

                    <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-foreground">Contribution kamas</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-0.5">
                                {Array.from({ length: KAMA_MAX_TRANCHES }).map((_, i) => {
                                    const tranchesDone = Math.floor(submittedKamas / KAMA_TRANCHE);
                                    const isValidated = i < Math.floor(validatedKamas / KAMA_TRANCHE);
                                    const isPending = !isValidated && i < tranchesDone;
                                    return (
                                        <div
                                            key={i}
                                            className={`w-2 h-2 rounded-full transition-all duration-300 ${isValidated ? "bg-success" : isPending ? "bg-warning animate-pulse" : "bg-muted"}`}
                                        />
                                    );
                                })}
                            </div>
                            <span className="text-caption text-muted-foreground">
                                {KAMA_MAX_TRANCHES - tranchesLeft}/{KAMA_MAX_TRANCHES} tranches
                            </span>
                            {pendingCount > 0 && (
                                <span className="text-caption bg-warning/15 border border-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold">
                                    {pendingCount} en attente
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                        {!canContribute && (
                            <span className="text-caption bg-success/10 border border-success/20 text-success px-2 py-0.5 rounded-full font-bold">
                                MAX ✓
                            </span>
                        )}
                        <button
                            onClick={e => { e.stopPropagation(); setShowHelp(true); }}
                            className="p-1 rounded-md hover:bg-surface text-muted-foreground hover:text-muted-foreground transition-colors"
                            title="Comment ça marche ?"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        {expanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Expanded content */}
                {expanded && (
                    <div className="border-t border-border p-3 space-y-3">
                        {/* Info block */}
                        <div className="flex flex-col gap-2 bg-warning/[0.03] rounded-lg p-3 border border-warning/20">
                            <div className="flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                                <div className="text-caption text-muted-foreground space-y-0.5">
                                    <p>Max <span className="text-foreground font-bold">{KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} kamas</span> par semaine</p>
                                    <p>Chaque tranche de <span className="text-warning font-bold">10 000k</span> → {REWARDS_PER_TRANCHE.xp} XP · {REWARDS_PER_TRANCHE.guildatons} guildatons</p>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-warning/10 text-caption text-warning/80 leading-relaxed">
                                ⚠️ **Important :** Les dons en Kamas servent directement à financer les **Raids de guilde**. Votre participation aux dons est indispensable pour maintenir l&apos;accès à ces raids.
                            </div>
                        </div>

                        {/* Weekly progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-caption">
                                <span className="text-muted-foreground">Progression hebdo</span>
                                <span className="text-muted-foreground font-mono">
                                    {submittedKamas.toLocaleString("fr-FR")} / {KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} k
                                </span>
                            </div>
                            <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-warning to-warning rounded-full transition-all duration-300"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {canContribute ? (
                            step === "form" ? (
                                <>
                                    {/* Tranche selector */}
                                    <div className="space-y-1.5">
                                        <label className="text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                            Nombre de tranches
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setTranches(t => Math.max(1, t - 1))}
                                                disabled={tranches <= 1}
                                                className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="flex-1 text-center">
                                                <div className="text-lg font-black text-warning font-mono">{tranches}</div>
                                                <div className="text-caption text-muted-foreground">= {totalKamas.toLocaleString("fr-FR")} kamas</div>
                                            </div>
                                            <button
                                                onClick={() => setTranches(t => Math.min(tranchesLeft, t + 1))}
                                                disabled={tranches >= tranchesLeft}
                                                className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setTranches(tranchesLeft)}
                                                className="px-2.5 py-1.5 rounded-lg bg-elevated border border-border text-caption font-bold text-muted-foreground hover:text-foreground hover:border-border-strong transition-all"
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>

                                    {/* Rewards preview */}
                                    <div className="flex items-center gap-2 bg-surface/60 rounded-lg px-3 py-2 border border-border">
                                        <Star className="w-3 h-3 text-warning shrink-0" />
                                        <span className="text-caption text-muted-foreground">Récompenses :</span>
                                        <div className="flex items-center gap-3 ml-auto">
                                            <span className="text-caption font-bold text-info">+{totalRewards.xp} XP</span>
                                            <span className="text-caption font-bold text-warning">+{totalRewards.guildatons} guildatons</span>
                                            <span className="text-caption font-bold text-success">+{totalRewards.guild_kamas} k.g.</span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => setStep("proof")}
                                        className="w-full bg-warning hover:bg-warning text-warning-foreground font-bold gap-2 h-9 text-sm"
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
                                            className="text-caption text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            ← Retour
                                        </button>
                                        <span className="text-caption text-muted-foreground">
                                            {totalKamas.toLocaleString("fr-FR")} kamas ({tranches} tranche{tranches > 1 ? "s" : ""})
                                        </span>
                                    </div>

                                    {previewSrc ? (
                                        <div className="relative rounded-xl overflow-hidden border border-border bg-elevated/50">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={previewSrc} alt="Preuve" className="w-full max-h-48 object-contain" />
                                            <button
                                                onClick={() => { setPreview(null); setFile(null); }}
                                                className="absolute top-2 right-2 p-1 rounded-full bg-surface/80 border border-border text-foreground hover:text-danger transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className="border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center gap-2 transition-all group"
                                            onDrop={e => {
                                                e.preventDefault();
                                                const f = e.dataTransfer.files[0];
                                                if (f) validateAndSetFile(f);
                                            }}
                                            onDragOver={e => e.preventDefault()}
                                        >
                                            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-warning transition-colors" />
                                            <div className="text-xs text-muted-foreground text-center">
                                                <p className="group-hover:text-foreground transition-colors">
                                                    Glissez, collez (Ctrl+V) ou{" "}
                                                    <button
                                                        type="button"
                                                        onClick={() => fileRef.current?.click()}
                                                        className="text-warning hover:text-warning font-medium hover:underline focus:outline-none"
                                                    >
                                                        cliquez ici
                                                    </button>
                                                </p>
                                                <p className="text-caption text-muted-foreground mt-1">JPEG · PNG · WebP · max 10MB</p>
                                            </div>
                                        </div>
                                    )}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
                                    />

                                    <Button
                                        onClick={handleSubmit}
                                        disabled={submitting || !file}
                                        className="w-full bg-warning hover:bg-warning disabled:opacity-50 text-warning-foreground font-bold gap-2 h-9 text-sm"
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
                                <div className="p-2 rounded-full bg-success/10 border border-success/20">
                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                </div>
                                <p className="text-xs font-bold text-success text-center">Maximum hebdomadaire atteint !</p>
                                <p className="text-caption text-muted-foreground text-center">
                                    {submittedKamas.toLocaleString("fr-FR")} kamas contribués cette semaine.<br />
                                    Reset au prochain cycle de missions.
                                </p>
                            </div>
                        )}

                        {pendingCount > 0 && (
                            <div className="flex items-center gap-2 bg-warning/5 border border-warning/15 rounded-lg px-2.5 py-2">
                                <Clock className="w-3 h-3 text-warning shrink-0" />
                                <p className="text-caption text-warning">
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
                        className="bg-surface border border-warning/20 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-warning/5">
                            <div className="p-2 rounded-xl bg-warning/10 border border-warning/20">
                                <Coins className="w-4 h-4 text-warning" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-foreground">Comment déclarer un don ?</p>
                                <p className="text-caption text-muted-foreground">Mécanique officielle Dofus</p>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="relative bg-background/80 border-b border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/missions/don-kamas-guilde.png"
                                alt="Interface don de kamas Dofus"
                                className="w-full object-contain max-h-52"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent p-3">
                                <p className="text-caption text-warning font-bold">
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
                                    <div className="w-5 h-5 rounded-full bg-warning/20 border border-warning/30 text-warning text-caption font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {step}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                                </div>
                            ))}

                            <div className="mt-3 p-3 bg-elevated/50 rounded-xl border border-border">
                                <p className="text-caption font-bold text-foreground uppercase tracking-widest mb-2">Limites hebdomadaires</p>
                                <div className="grid grid-cols-2 gap-1.5 text-caption text-muted-foreground">
                                    <span>Max par semaine :</span>
                                    <span className="text-warning font-bold">{KAMA_MAX_PER_WEEK.toLocaleString("fr-FR")} kamas</span>
                                    <span>Max tranches :</span>
                                    <span className="text-warning font-bold">{KAMA_MAX_TRANCHES} tranches</span>
                                    <span>Par tranche :</span>
                                    <span className="text-info font-bold">+{REWARDS_PER_TRANCHE.xp} XP · +{REWARDS_PER_TRANCHE.guildatons} guildatons</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
