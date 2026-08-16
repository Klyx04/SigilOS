"use client";

import { useState } from "react";
import {
    Sparkles,
    Calendar,
    ShieldCheck,
    Loader2,
    Info
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { grantWelcomeBadge } from "@/server/actions/onboarding-admin-actions";

interface WelcomeBadgeDialogProps {
    guildId: string;
    profileId: string;
    memberName: string;
    roleName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function WelcomeBadgeDialog({
    guildId,
    profileId,
    memberName,
    roleName,
    open,
    onOpenChange,
    onSuccess
}: WelcomeBadgeDialogProps) {
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(false);

    const handleGrant = async () => {
        setLoading(true);
        try {
            const res = await grantWelcomeBadge({
                guildId,
                profileId,
                days
            });
            if (res.success) {
                toast.success(`Le badge "${roleName}" a été attribué à ${memberName} pour ${days} jours.`);
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(res.error || "Erreur");
            }
        } catch (e) {
            toast.error("Erreur de communication");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center mb-4">
                        <Sparkles className="w-6 h-6 text-warning" />
                    </div>
                    <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                        Attribuer un badge spécial
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground italic">
                        Le membre recevra le badge "{roleName}" sur son profil pendant la durée choisie.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Membre ciblé</p>
                            <p className="text-sm font-bold text-foreground">{memberName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Badge</p>
                            <p className="text-sm font-bold text-warning">{roleName}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-warning flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Durée (en jours)
                        </label>
                        <div className="flex gap-2">
                            {[7, 14, 30, 60].map((d) => (
                                <Button
                                    key={d}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDays(d)}
                                    className={`flex-1 font-bold h-9 transition-all ${days === d ? "bg-warning/20 border-warning text-warning" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
                                >
                                    {d}j
                                </Button>
                            ))}
                        </div>
                        <Input
                            type="number"
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                            className="bg-surface border-border text-center font-bold text-lg"
                        />
                    </div>

                    <div className="p-3 rounded-xl bg-info/5 border border-info/10 flex items-start gap-3">
                        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                        <p className="text-caption text-muted-foreground leading-relaxed italic">
                            Ce badge est purement visuel sur SigilOS et n'affecte pas les permissions Discord. Il sera automatiquement retiré à l'expiration.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-bold text-muted-foreground hover:text-foreground"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleGrant}
                        disabled={loading || days <= 0}
                        className="bg-warning hover:bg-warning text-warning-foreground font-black px-8 gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Appliquer le badge
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export { WelcomeBadgeDialog as ProbationGrantDialog };
