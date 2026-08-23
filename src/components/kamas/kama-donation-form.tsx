"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Coins, X, ImageIcon, Loader2, CheckCircle2, Plus, Minus, Star, Swords, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitKamaDonation } from "@/server/actions/kama-actions";
import {
    KAMA_TRANCHE, KAMA_MAX_TRANCHES, REWARDS_PER_TRANCHE
} from "@/lib/kama-constants";

interface KamaDonationFormProps {
    guildId: string;
    onSuccess?: () => void;
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

export function KamaDonationForm({ guildId, onSuccess }: KamaDonationFormProps) {
    const [tranches, setTranches] = useState(1);
    const [note, setNote] = useState("");
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const previewSrc = safePreviewSrc(preview);

    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

    const handleFile = async (f: File) => {
        if (!ALLOWED.includes(f.type)) { toast.error("Format invalide. JPEG, PNG ou WebP uniquement."); return; }
        if (f.size > 5 * 1024 * 1024) { toast.error("Fichier trop lourd (max 5 MB)."); return; }
        
        // 🛡️ NSFW Safety Check
        const { analyzeImageSafety } = await import("@/lib/safety-client");
        const safety = await analyzeImageSafety(f);
        if (!safety.isSafe) {
            toast.error(safety.reason || "Contenu inapproprié détecté. L'image a été bloquée.", {
                description: "Cette action a été signalée aux administrateurs."
            });
            return;
        }

        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const handleSubmit = async () => {
        if (!file) { toast.error("Un screenshot de preuve est requis."); return; }

        setSubmitting(true);
        const fd = new FormData();
        fd.append("file", file);

        const res = await submitKamaDonation({ guildId, tranches, note: note || null }, fd);

        if (res.success) {
            setDone(true);
            toast.success(`✅ Don de ${(tranches * KAMA_TRANCHE).toLocaleString("fr-FR")} kamas soumis ! En attente de validation.`);
            setTranches(1); setNote(""); setFile(null); setPreview(null);
            setTimeout(() => setDone(false), 4000);
            onSuccess?.();
        } else {
            toast.error(res.error || "Erreur lors de la soumission.");
        }
        setSubmitting(false);
    };

    const totalKamas = tranches * KAMA_TRANCHE;
    const totalRewards = {
        xp: tranches * REWARDS_PER_TRANCHE.xp,
        guildatons: tranches * REWARDS_PER_TRANCHE.guildatons,
    };

    return (
        <div className="rounded-2xl border border-white/8 bg-surface/60 backdrop-blur-sm overflow-hidden space-y-0">

            {/* ── Raid access banner ── */}
            <div className="relative overflow-hidden bg-gradient-to-r from-danger/60 via-surface/80 to-surface/60 border-b border-danger/15 px-5 py-3">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(239,68,68,0.07),transparent_60%)] pointer-events-none" />
                <div className="relative flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-danger/10 border border-danger/20 shrink-0">
                        <Swords className="w-3.5 h-3.5 text-danger" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-caption font-black text-danger uppercase tracking-wider">Accès Raids Officiels</p>
                        <p className="text-caption text-muted-foreground leading-tight">
                            <span className="text-warning font-bold">30 000 kamas validés</span> requis pour s&apos;inscrire aux raids de la semaine.
                        </p>
                    </div>
                    {totalKamas >= 30000 ? (
                        <span className="flex items-center gap-1 text-caption font-black bg-danger/15 border border-danger/25 text-danger px-2 py-1 rounded-full uppercase tracking-wide shrink-0">
                            <Swords className="w-2.5 h-2.5" /> Accès débloqué
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-caption font-black bg-elevated/60 border border-border/40 text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wide shrink-0">
                            <Lock className="w-2.5 h-2.5" /> {(30000 - Math.min(30000, totalKamas)).toLocaleString("fr-FR")}k manquant
                        </span>
                    )}
                </div>
            </div>

            <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                    <Coins className="w-5 h-5 text-warning" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-foreground">Déclarer un don de kamas</h3>
                    <p className="text-caption text-muted-foreground">Max {KAMA_MAX_TRANCHES} tranches · {(KAMA_MAX_TRANCHES * KAMA_TRANCHE).toLocaleString("fr-FR")} kamas/semaine</p>
                </div>
            </div>

            {/* Tranche selector */}
            <div className="space-y-1.5">
                <label className="text-caption font-bold text-muted-foreground uppercase tracking-widest">Nombre de tranches</label>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setTranches(t => Math.max(1, t - 1))}
                        disabled={tranches <= 1}
                        className="w-9 h-9 rounded-xl bg-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 bg-elevated/60 rounded-xl border border-white/8 p-3 text-center">
                        <div className="text-2xl font-black text-warning font-mono">{tranches}</div>
                        <div className="text-caption text-muted-foreground">= {totalKamas.toLocaleString("fr-FR")} kamas</div>
                    </div>
                    <button
                        onClick={() => setTranches(t => Math.min(KAMA_MAX_TRANCHES, t + 1))}
                        disabled={tranches >= KAMA_MAX_TRANCHES}
                        className="w-9 h-9 rounded-xl bg-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setTranches(KAMA_MAX_TRANCHES)}
                        className="px-3 py-2 rounded-xl bg-elevated border border-border text-caption font-bold text-muted-foreground hover:text-foreground hover:border-border-strong transition-all"
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
                </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
                <label className="text-caption font-bold text-muted-foreground uppercase tracking-widest">Note (optionnel)</label>
                <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={300}
                    placeholder="Précisions sur le don..."
                    className="w-full px-3 py-2 bg-elevated/80 border border-border rounded-lg text-sm text-foreground placeholder-zinc-600 outline-none focus:border-border-strong transition-colors"
                />
            </div>

            {/* Proof upload */}
            <div className="space-y-1.5">
                <label className="text-caption font-bold text-muted-foreground uppercase tracking-widest">Screenshot de preuve *</label>

                {previewSrc ? (
                    <div className="relative rounded-xl overflow-hidden border border-border bg-elevated/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewSrc} alt="Preuve" className="w-full max-h-64 object-contain" />
                        <button
                            onClick={() => { setPreview(null); setFile(null); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-surface/80 border border-border text-foreground hover:text-danger hover:border-danger/30 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-surface/80 to-transparent p-2">
                            <p className="text-caption text-muted-foreground truncate">{file?.name}</p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-warning/30 hover:bg-warning/[0.02] transition-all duration-300 group"
                        onClick={() => fileRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                    >
                        <div className="p-3 rounded-xl bg-elevated/80 group-hover:bg-warning/10 transition-colors">
                            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-warning transition-colors" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                                Glissez votre screenshot ici
                            </p>
                            <p className="text-caption text-muted-foreground mt-0.5">ou cliquez pour parcourir · JPEG, PNG, WebP · max 5MB</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                            <ImageIcon className="w-3 h-3" />
                            <span>Capture du comptoir d&apos;inventaire recommandée</span>
                        </div>
                    </div>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
            </div>

            <Button
                onClick={handleSubmit}
                disabled={submitting || done || !file}
                className="w-full relative overflow-hidden bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning text-foreground font-black shadow-xl shadow-amber-600/25 hover:shadow-amber-600/40 gap-2 h-12 transition-all duration-300 hover:scale-[1.01] border-t border-border text-sm uppercase tracking-wide rounded-xl"
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                ) : done ? (
                    <><CheckCircle2 className="w-4 h-4" /> Soumis avec succès !</>
                ) : (
                    <><Coins className="w-4 h-4" /> Soumettre mon don</>
                )}
            </Button>
            <p className="text-caption text-muted-foreground text-center">
                Un administrateur validera votre donation. Validée = comptabilisée dans le classement et accès raids débloqué.
            </p>
            </div>
        </div>
    );
}
