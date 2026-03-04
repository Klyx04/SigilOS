"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Eye, Clock, ChevronDown, ChevronUp, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewKamaDonation, deleteKamaDonation, type KamaDonationEntry } from "@/server/actions/kama-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface KamaDonationListProps {
    guildId: string;
    donations: KamaDonationEntry[];
    canReview: boolean;
    currentProfileId?: string;
    onRefresh?: () => void;
}

export function KamaDonationList({ guildId, donations, canReview, currentProfileId, onRefresh }: KamaDonationListProps) {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleReview = async (donationId: string, action: "VALIDATE" | "REJECT") => {
        setProcessingId(donationId);
        const res = await reviewKamaDonation({ guildId, donationId, action });
        if (res.success) {
            toast.success(action === "VALIDATE" ? "✅ Don validé !" : "❌ Don refusé.");
            onRefresh?.();
        } else {
            toast.error(res.error || "Erreur");
        }
        setProcessingId(null);
    };

    const handleDelete = async (donationId: string) => {
        setProcessingId(donationId);
        const res = await deleteKamaDonation(guildId, donationId);
        if (res.success) {
            toast.success("Donation supprimée.");
            onRefresh?.();
        } else {
            toast.error(res.error || "Erreur");
        }
        setProcessingId(null);
    };

    const statusConfig = {
        PENDING: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock, label: "En attente" },
        VALIDATED: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2, label: "Validé" },
        REJECTED: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle, label: "Refusé" },
    };

    if (donations.length === 0) {
        return (
            <div className="text-center py-10 text-zinc-600">
                <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune donation pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {donations.map(d => {
                const cfg = statusConfig[d.status];
                const Icon = cfg.icon;
                const isExpanded = expandedId === d.id;
                const isProcessing = processingId === d.id;
                const isOwn = d.profileId === currentProfileId;

                return (
                    <div key={d.id} className="rounded-xl border border-white/8 bg-zinc-900/50 overflow-hidden transition-all duration-200 hover:border-white/12">
                        <div
                            className="flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                {d.profile.user.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={d.profile.user.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold text-zinc-400">
                                        {(d.profile.pseudoDofus || d.profile.discordNickname || "?")[0].toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Name + amount */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                    {d.profile.pseudoDofus || d.profile.discordNickname || "Membre"}
                                    {isOwn && <span className="ml-2 text-[9px] text-zinc-500 font-normal">(vous)</span>}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: fr })}
                                </p>
                            </div>

                            {/* Amount */}
                            <div className="text-right shrink-0">
                                <p className="text-sm font-black text-amber-400 font-mono">
                                    {d.amount.toLocaleString("fr-FR")}
                                </p>
                                <p className="text-[9px] text-zinc-600 font-bold uppercase">kamas</p>
                            </div>

                            {/* Status */}
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider shrink-0 ${cfg.bg} ${cfg.color}`}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                            </div>

                            {/* Expand */}
                            <div className="text-zinc-600 shrink-0">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                            <div className="border-t border-white/8 p-3 space-y-3 bg-zinc-900/30">
                                {d.note && (
                                    <p className="text-xs text-zinc-400 bg-zinc-800/50 rounded-lg px-3 py-2 border border-white/5">
                                        💬 {d.note}
                                    </p>
                                )}

                                {d.proofUrl && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preuve screenshot</p>
                                        <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-800/30">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={d.proofUrl} alt="Preuve don" className="w-full max-h-80 object-contain" />
                                        </div>
                                        <a
                                            href={d.proofUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Eye className="w-3 h-3" /> Voir en plein écran
                                        </a>
                                    </div>
                                )}

                                {d.status === "REJECTED" && d.rejectedReason && (
                                    <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-300">{d.rejectedReason}</p>
                                    </div>
                                )}

                                {/* Admin actions */}
                                {canReview && d.status === "PENDING" && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={e => { e.stopPropagation(); handleReview(d.id, "VALIDATE"); }}
                                            disabled={isProcessing}
                                            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white gap-1.5 text-xs"
                                        >
                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                            Valider
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={e => { e.stopPropagation(); handleReview(d.id, "REJECT"); }}
                                            disabled={isProcessing}
                                            variant="ghost"
                                            className="flex-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/20 gap-1.5 text-xs"
                                        >
                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                            Refuser
                                        </Button>
                                    </div>
                                )}

                                {/* Owner delete (pending only) */}
                                {isOwn && d.status === "PENDING" && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={e => { e.stopPropagation(); handleDelete(d.id); }}
                                        disabled={isProcessing}
                                        className="w-full text-zinc-600 hover:text-red-400 hover:bg-red-500/5 text-xs"
                                    >
                                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Annuler ma soumission"}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
