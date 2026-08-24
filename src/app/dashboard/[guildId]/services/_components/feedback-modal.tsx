"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquareHeart, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitServiceFeedback } from "@/server/actions/service-feedback-actions";
import { ServiceCategory } from "@prisma/client";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    guildId: string;
    providerProfileId: string;
    providerName: string;
    serviceTitle: string;
    serviceCategory: ServiceCategory;
    serviceListingId?: string;
    serviceRequestId?: string;
    onSuccess?: () => void;
}

export function FeedbackModal({
    isOpen,
    onClose,
    guildId,
    providerProfileId,
    providerName,
    serviceTitle,
    serviceCategory,
    serviceListingId,
    serviceRequestId,
    onSuccess,
}: FeedbackModalProps) {
    const [rating, setRating] = useState<number>(5);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [comment, setComment] = useState<string>("");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        if (rating < 1 || rating > 5) {
            toast.error("Veuillez attribuer une note entre 1 et 5 étoiles.");
            return;
        }

        startTransition(async () => {
            const res = await submitServiceFeedback(guildId, {
                providerProfileId,
                serviceListingId,
                serviceRequestId,
                serviceTitle,
                category: serviceCategory,
                rating,
                comment: comment.trim() || undefined,
            });

            if (res.success) {
                toast.success("⭐ Merci pour votre avis !", {
                    description: `Votre retour sur la prestation de ${providerName} a bien été enregistré.`,
                });
                setComment("");
                setRating(5);
                onSuccess?.();
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement de l'avis");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-background border border-border text-foreground">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning shrink-0">
                            <MessageSquareHeart className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-black">
                                Laisser un avis sur le service
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Évaluez la prestation de <strong className="text-foreground">{providerName}</strong> ({serviceTitle})
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    {/* Étoiles de notation */}
                    <div className="bg-surface/50 border border-border rounded-xl p-4 flex flex-col items-center gap-2">
                        <span className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                            Note de satisfaction
                        </span>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const active = (hoverRating || rating) >= star;
                                return (
                                    <button
                                        key={star}
                                        type="button"
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                        className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                                    >
                                        <Star
                                            className={cn(
                                                "w-8 h-8 transition-colors",
                                                active
                                                    ? "text-warning fill-warning drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                                    : "text-muted-foreground/30"
                                            )}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <span className="text-sm font-bold text-foreground">
                            {rating === 5 && "⭐ Parfait, rien à redire !"}
                            {rating === 4 && "👍 Très bien, prestation rapide"}
                            {rating === 3 && "👌 Correct"}
                            {rating === 2 && "⚠️ Mitigé"}
                            {rating === 1 && "👎 Décevant"}
                        </span>
                    </div>

                    {/* Message court */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                                Message d'appréciation (optionnel)
                            </label>
                            <span className="text-caption text-muted-foreground tabular-nums">
                                {comment.length}/280
                            </span>
                        </div>
                        <Textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value.slice(0, 280))}
                            placeholder="Ex : Super rapide et sympa, donjon passé du premier coup ! Merci beaucoup 🙏"
                            rows={3}
                            className="bg-surface/60 border-border resize-none text-sm focus:ring-1 focus:ring-warning"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2.5 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                            className="flex-1 border-border bg-surface text-muted-foreground hover:text-foreground"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground font-black shadow-lg shadow-warning/20"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Envoi...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Envoyer mon avis
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
