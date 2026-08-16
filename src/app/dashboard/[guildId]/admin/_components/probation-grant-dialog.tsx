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
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                        <Sparkles className="w-6 h-6 text-amber-400" />
                    </div>
                    <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                        Attribuer un badge spécial
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500 italic">
                        Le membre recevra le badge "{roleName}" sur son profil pendant la durée choisie.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-caption font-black uppercase tracking-widest text-zinc-500">Membre ciblé</p>
                            <p className="text-sm font-bold text-white">{memberName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-caption font-black uppercase tracking-widest text-zinc-500">Badge</p>
                            <p className="text-sm font-bold text-amber-400">{roleName}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-amber-400 flex items-center gap-2">
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
                                    className={`flex-1 font-bold h-9 transition-all ${days === d ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    {d}j
                                </Button>
                            ))}
                        </div>
                        <Input
                            type="number"
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                            className="bg-zinc-900 border-white/10 text-center font-bold text-lg"
                        />
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-caption text-zinc-500 leading-relaxed italic">
                            Ce badge est purement visuel sur SigilOS et n'affecte pas les permissions Discord. Il sera automatiquement retiré à l'expiration.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-bold text-zinc-500 hover:text-white"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleGrant}
                        disabled={loading || days <= 0}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-black px-8 gap-2"
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
