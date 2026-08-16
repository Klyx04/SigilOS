'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X, Search, RefreshCcw, Coins, Clock, User as UserIcon, ExternalLink, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { reviewKamaDonation } from "@/server/actions/kama-actions";
import { SubmissionCountdown } from "@/components/missions/submission-countdown";
import { KAMA_TRANCHE } from "@/lib/kama-constants";
import { cn } from "@/lib/utils";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";

type KamaDonationItem = {
    id: string;
    amount: number;
    note: string | null;
    proofUrl: string | null;
    status: string;
    createdAt: Date;
    weekNumber: number | null;
    yearNumber: number | null;
    profile: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        discordRoleColor: number | null;
        user: { name: string | null; image: string | null };
    };
};

interface KamaValidationQueueProps {
    donations: KamaDonationItem[];
    guildId: string;
}

export function KamaValidationQueue({ donations: initialDonations, guildId }: KamaValidationQueueProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [donations, setDonations] = useState(initialDonations);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<{ id: string; reason: string } | null>(null);

    const handleDecision = (id: string, action: "VALIDATE" | "REJECT", reason?: string) => {
        setProcessingId(id);
        startTransition(async () => {
            const result = await reviewKamaDonation({
                guildId,
                donationId: id,
                action,
                rejectedReason: reason || null,
            });
            setProcessingId(null);

            if (result.success) {
                toast.success(action === "VALIDATE" ? "✅ Don validé !" : "❌ Don refusé");
                setDonations(prev => prev.filter(d => d.id !== id));
                setRejectReason(null);
                router.refresh();
            } else {
                toast.error(result.error || "Erreur");
            }
        });
    };

    const filtered = donations.filter(d => {
        const q = searchTerm.toLowerCase();
        return (
            (d.profile.pseudoDofus || "").toLowerCase().includes(q) ||
            (d.profile.discordNickname || "").toLowerCase().includes(q) ||
            (d.profile.user.name || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-surface/50 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground border-r border-border pr-4">
                        <span className="text-foreground font-medium">{donations.length}</span> en attente
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startTransition(() => router.refresh())}
                        disabled={isPending}
                        title="Actualiser"
                    >
                        <RefreshCcw className={cn("w-4 h-4", isPending && "animate-spin")} />
                    </Button>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Chercher un membre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-black/20 border-border"
                    />
                </div>
            </div>

            {/* Card grid */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground border border-dashed border-border rounded-xl bg-surface/20">
                    <Check className="w-12 h-12 mb-4 opacity-20" />
                    <p>Aucun don en attente de validation.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(don => {
                        const tranches = Math.round(don.amount / KAMA_TRANCHE);
                        const name = getGameDisplayName(don.profile) || "Membre";
                        const isProcessing = processingId === don.id;

                        return (
                            <div
                                key={don.id}
                                className="flex flex-col bg-[#121417] border border-border rounded-2xl overflow-hidden shadow-xl hover:border-warning/20 transition-all duration-300"
                            >
                                {/* Header amber */}
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-warning/80 to-zinc-900/80 border-b border-warning/15">
                                    <div className="p-1.5 bg-warning/15 rounded-lg border border-warning/20">
                                        <Coins className="w-3.5 h-3.5 text-warning" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-foreground uppercase tracking-wide">
                                            Don de Kamas
                                        </p>
                                        <p className="text-caption text-warning font-bold font-mono">
                                            {don.amount.toLocaleString("fr-FR")} kamas · {tranches} tranche{tranches > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <SubmissionCountdown createdAt={don.createdAt} />
                                </div>

                                {/* User bar */}
                                <div className="flex items-center gap-3 px-4 py-2 bg-background/50 border-b border-border/50">
                                    <div className="w-7 h-7 rounded-full bg-elevated overflow-hidden border border-border shrink-0 flex items-center justify-center">
                                        {don.profile.user.image
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={don.profile.user.image} alt="" className="w-full h-full object-cover" />
                                            : <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                                        <p className="text-caption text-muted-foreground">
                                            S{don.weekNumber} · {new Date(don.createdAt).toLocaleDateString("fr-FR")}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-caption h-5 px-1.5 bg-warning/10 text-warning border-warning/20">
                                        {tranches}T
                                    </Badge>
                                </div>

                                {/* Proof image */}
                                {don.proofUrl ? (
                                    <div
                                        className="relative aspect-video bg-black overflow-hidden cursor-zoom-in group"
                                        onClick={() => setSelectedImage(don.proofUrl)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={don.proofUrl}
                                            alt="Preuve"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-foreground text-xs">
                                            <ZoomIn className="w-4 h-4" />
                                            Agrandir
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-video bg-surface/50 flex items-center justify-center text-muted-foreground text-xs">
                                        Aucune preuve jointe
                                    </div>
                                )}

                                {/* Note */}
                                {don.note && (
                                    <div className="px-4 py-2 bg-surface/30 border-t border-border/50">
                                        <p className="text-caption text-muted-foreground italic">&ldquo;{don.note}&rdquo;</p>
                                    </div>
                                )}

                                {/* Reject reason input (shown on demand) */}
                                {rejectReason?.id === don.id && (
                                    <div className="px-4 py-3 bg-danger/20 border-t border-danger/20 space-y-2">
                                        <Input
                                            placeholder="Raison du refus (optionnel)..."
                                            value={rejectReason.reason}
                                            onChange={e => setRejectReason({ id: don.id, reason: e.target.value })}
                                            className="h-8 text-xs bg-black/30 border-danger/20"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 h-7 text-xs border-border"
                                                onClick={() => setRejectReason(null)}
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 h-7 text-xs bg-danger hover:bg-danger text-danger-foreground"
                                                onClick={() => handleDecision(don.id, "REJECT", rejectReason.reason)}
                                                disabled={isProcessing}
                                            >
                                                <X className="w-3 h-3 mr-1" /> Confirmer refus
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                {rejectReason?.id !== don.id && (
                                    <div className="grid grid-cols-2 gap-2 p-3 bg-background/30 border-t border-border/50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-danger/30 hover:bg-danger/50 hover:text-danger text-danger text-xs"
                                            onClick={() => setRejectReason({ id: don.id, reason: "" })}
                                            disabled={isProcessing}
                                        >
                                            <X className="w-3.5 h-3.5 mr-1.5" />
                                            Refuser
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-success hover:bg-success text-success-foreground text-xs"
                                            onClick={() => handleDecision(don.id, "VALIDATE")}
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
                        className="absolute top-4 right-4 text-foreground hover:bg-surface"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                    <a
                        href={selectedImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-4 right-16 text-foreground hover:bg-surface p-2 rounded-md"
                        onClick={e => e.stopPropagation()}
                    >
                        <ExternalLink className="w-5 h-5" />
                    </a>
                </div>
            )}
        </div>
    );
}
