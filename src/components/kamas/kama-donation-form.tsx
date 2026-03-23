"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Coins, X, ImageIcon, Loader2, CheckCircle2, Plus, Minus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitKamaDonation } from "@/server/actions/kama-actions";
import {
    KAMA_TRANCHE, KAMA_MAX_TRANCHES, REWARDS_PER_TRANCHE
} from "@/lib/kama-constants";

interface KamaDonationFormProps {
    guildId: string;
    onSuccess?: () => void;
}

export function KamaDonationForm({ guildId, onSuccess }: KamaDonationFormProps) {
    const [tranches, setTranches] = useState(1);
    const [note, setNote] = useState("");
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

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
        <div className="rounded-2xl border border-white/8 bg-zinc-900/60 backdrop-blur-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Coins className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-white">Déclarer un don de kamas</h3>
                    <p className="text-[10px] text-zinc-500">Max {KAMA_MAX_TRANCHES} tranches · {(KAMA_MAX_TRANCHES * KAMA_TRANCHE).toLocaleString("fr-FR")} kamas/semaine</p>
                </div>
            </div>

            {/* Tranche selector */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nombre de tranches</label>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setTranches(t => Math.max(1, t - 1))}
                        disabled={tranches <= 1}
                        className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 bg-zinc-800/60 rounded-xl border border-white/8 p-3 text-center">
                        <div className="text-2xl font-black text-amber-400 font-mono">{tranches}</div>
                        <div className="text-[10px] text-zinc-500">= {totalKamas.toLocaleString("fr-FR")} kamas</div>
                    </div>
                    <button
                        onClick={() => setTranches(t => Math.min(KAMA_MAX_TRANCHES, t + 1))}
                        disabled={tranches >= KAMA_MAX_TRANCHES}
                        className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setTranches(KAMA_MAX_TRANCHES)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 border border-white/10 text-[10px] font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                    >
                        MAX
                    </button>
                </div>
            </div>

            {/* Rewards preview */}
            <div className="flex items-center gap-2 bg-zinc-900/60 rounded-lg px-3 py-2 border border-white/5">
                <Star className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[10px] text-zinc-500">Récompenses :</span>
                <div className="flex items-center gap-3 ml-auto">
                    <span className="text-[10px] font-bold text-blue-300">+{totalRewards.xp} XP</span>
                    <span className="text-[10px] font-bold text-amber-300">+{totalRewards.guildatons} guildatons</span>
                </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Note (optionnel)</label>
                <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={300}
                    placeholder="Précisions sur le don..."
                    className="w-full px-3 py-2 bg-zinc-800/80 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
                />
            </div>

            {/* Proof upload */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Screenshot de preuve *</label>

                {preview ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-zinc-800/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Preuve" className="w-full max-h-64 object-contain" />
                        <button
                            onClick={() => { setPreview(null); setFile(null); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-zinc-900/80 border border-white/10 text-zinc-300 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-zinc-900/80 to-transparent p-2">
                            <p className="text-[10px] text-zinc-400 truncate">{file?.name}</p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all duration-300 group"
                        onClick={() => fileRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                    >
                        <div className="p-3 rounded-xl bg-zinc-800/80 group-hover:bg-amber-500/10 transition-colors">
                            <Upload className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                Glissez votre screenshot ici
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">ou cliquez pour parcourir · JPEG, PNG, WebP · max 5MB</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
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
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg gap-2 h-11 transition-all"
            >
                {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                ) : done ? (
                    <><CheckCircle2 className="w-4 h-4" /> Soumis !</>
                ) : (
                    <><Coins className="w-4 h-4" /> Soumettre le don</>
                )}
            </Button>
            <p className="text-[10px] text-zinc-600 text-center">
                Un administrateur validera votre donation. Validée = comptabilisée dans le classement.
            </p>
        </div>
    );
}
