'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X, Search, RefreshCcw, Trophy, User as UserIcon, ExternalLink, ZoomIn, Target } from "lucide-react";
import { toast } from "sonner";
import { reviewAchievementSubmission, type AchievementSubmissionEntry } from "@/server/actions/profile-actions";
import { SubmissionCountdown } from "@/components/missions/submission-countdown";
import { cn } from "@/lib/utils";

interface AchievementValidationQueueProps {
    submissions: AchievementSubmissionEntry[];
    guildId: string;
}

export function AchievementValidationQueue({ submissions: initialSubmissions, guildId }: AchievementValidationQueueProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<{ id: string; reason: string } | null>(null);

    const handleDecision = (id: string, action: "VALIDATE" | "REJECT", reason?: string) => {
        setProcessingId(id);
        startTransition(async () => {
            const result = await reviewAchievementSubmission({
                guildId,
                submissionId: id,
                action,
                rejectedReason: reason || null,
            });
            setProcessingId(null);

            if (result.success) {
                toast.success(action === "VALIDATE" ? "✅ Succès validé !" : "❌ Succès refusé");
                setSubmissions(prev => prev.filter(s => s.id !== id));
                setRejectReason(null);
                router.refresh();
            } else {
                toast.error(result.error || "Erreur");
            }
        });
    };

    const filtered = submissions.filter(s => {
        const q = searchTerm.toLowerCase();
        return (
            (s.profile.pseudoDofus || "").toLowerCase().includes(q) ||
            (s.profile.discordNickname || "").toLowerCase().includes(q) ||
            (s.profile.user.name || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400 border-r border-white/10 pr-4">
                        <span className="text-white font-medium">{submissions.length}</span> en attente
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={() => startTransition(() => router.refresh())}
                        disabled={isPending}
                        title="Actualiser"
                    >
                        <RefreshCcw className={cn("w-4 h-4", isPending && "animate-spin")} />
                    </Button>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Chercher un membre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-black/20 border-white/10"
                    />
                </div>
            </div>

            {/* Card grid */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[40vh] text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <Trophy className="w-12 h-12 mb-4 opacity-20 text-amber-500" />
                    <p>Aucune preuve de succès en attente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(sub => {
                        const name = sub.profile.pseudoDofus || sub.profile.discordNickname || sub.profile.user.name || "Membre";
                        const isProcessing = processingId === sub.id;

                        return (
                            <div
                                key={sub.id}
                                className="flex flex-col bg-[#121417] border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:border-amber-500/20 transition-all duration-300"
                            >
                                {/* Header sky (achievements usually use sky/amber) */}
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-sky-950/80 to-zinc-900/80 border-b border-sky-500/15">
                                    <div className="p-1.5 bg-sky-500/15 rounded-lg border border-sky-500/20">
                                        <Trophy className="w-3.5 h-3.5 text-sky-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-white uppercase tracking-wide">
                                            Points de Succès
                                        </p>
                                        <p className="text-[10px] text-sky-300 font-bold font-mono uppercase tracking-tighter">
                                            Vérification Manuelle · {sub.points.toLocaleString()} pts
                                        </p>
                                    </div>
                                    <SubmissionCountdown createdAt={sub.createdAt} />
                                </div>

                                {/* User bar */}
                                <div className="flex items-center gap-3 px-4 py-2 bg-zinc-950/50 border-b border-zinc-800/50">
                                    <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden border border-white/10 shrink-0 flex items-center justify-center">
                                        {sub.profile.user.image
                                            ? <img src={sub.profile.user.image} alt="" className="w-full h-full object-cover" />
                                            : <UserIcon className="w-3.5 h-3.5 text-zinc-600" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white truncate">{name}</p>
                                        <p className="text-[10px] text-zinc-500">
                                            Le {new Date(sub.createdAt).toLocaleDateString("fr-FR")}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-sky-500/10 text-sky-400 border-sky-500/20">
                                            {sub.points} pts
                                        </Badge>
                                        {sub.ocrScore && (
                                            <span className={cn(
                                                "text-[8px] font-bold uppercase",
                                                sub.ocrScore > 0.8 ? "text-emerald-500" : sub.ocrScore > 0.5 ? "text-amber-500" : "text-red-500"
                                            )}>
                                                OCR: {Math.round(sub.ocrScore * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Proof image */}
                                {sub.proofUrl ? (
                                    <div
                                        className="relative aspect-video bg-black overflow-hidden cursor-zoom-in group"
                                        onClick={() => setSelectedImage(sub.proofUrl)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={sub.proofUrl}
                                            alt="Preuve"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs">
                                            <ZoomIn className="w-4 h-4" />
                                            Agrandir
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-video bg-zinc-900/50 flex items-center justify-center text-zinc-600 text-xs">
                                        Aucune preuve jointe
                                    </div>
                                )}

                                {/* OCR Debug text if score is low */}
                                {sub.ocrRawText && (sub.ocrScore || 0) < 0.9 && (
                                    <div className="px-4 py-2 bg-black/40 border-t border-zinc-800/50 max-h-16 overflow-y-auto no-scrollbar">
                                        <div className="flex items-center gap-1 mb-1">
                                            <Target className="w-3 h-3 text-zinc-600" />
                                            <span className="text-[8px] font-bold uppercase text-zinc-600 tracking-widest">Texte détecté</span>
                                        </div>
                                        <p className="text-[9px] text-zinc-500 font-mono leading-tight whitespace-pre-wrap break-all line-clamp-3">
                                            {sub.ocrRawText}
                                        </p>
                                    </div>
                                )}

                                {/* Reject reason input (shown on demand) */}
                                {rejectReason?.id === sub.id && (
                                    <div className="px-4 py-3 bg-red-950/20 border-t border-red-500/20 space-y-2">
                                        <Input
                                            placeholder="Raison du refus (optionnel)..."
                                            value={rejectReason.reason}
                                            onChange={e => setRejectReason({ id: sub.id, reason: e.target.value })}
                                            className="h-8 text-xs bg-black/30 border-red-500/20"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-7 text-xs border-zinc-700"
                                                onClick={() => setRejectReason(null)}
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 h-7 text-xs bg-red-700 hover:bg-red-600 text-white"
                                                onClick={() => handleDecision(sub.id, "REJECT", rejectReason.reason)}
                                                disabled={isProcessing}
                                            >
                                                <X className="w-3 h-3 mr-1" /> Confirmer refus
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                {rejectReason?.id !== sub.id && (
                                    <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-950/30 border-t border-zinc-800/50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-900/30 hover:bg-red-950/50 hover:text-red-400 text-red-500 text-xs"
                                            onClick={() => setRejectReason({ id: sub.id, reason: "" })}
                                            disabled={isProcessing}
                                        >
                                            <X className="w-3.5 h-3.5 mr-1.5" />
                                            Refuser
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-sky-600 hover:bg-sky-500 text-white text-xs shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                                            onClick={() => handleDecision(sub.id, "VALIDATE")}
                                            disabled={isProcessing}
                                        >
                                            <Check className="w-3.5 h-3.5 mr-1.5" />
                                            Valider
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setSelectedImage(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedImage} className="max-w-full max-h-full object-contain shadow-2xl" alt="Zoom" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                    <a
                        href={selectedImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-4 right-16 text-white hover:bg-white/10 p-2 rounded-md"
                        onClick={e => e.stopPropagation()}
                    >
                        <ExternalLink className="w-5 h-5" />
                    </a>
                </div>
            )}
        </div>
    );
}
