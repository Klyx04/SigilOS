"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, ShieldAlert, Archive, Clock, History } from "lucide-react";
import { toast } from "sonner";
import { updateMemberProfileStatus } from "@/server/actions/user-actions";

interface ArchiveDurationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memberId: string;
    memberName: string;
    onSuccess: () => void;
}

const DURATIONS = [
    { label: "30 Jours", value: 1, description: "Action standard pour un départ temporaire.", icon: Clock },
    { label: "3 Mois", value: 3, description: "Idéal pour une pause prolongée.", icon: Calendar },
    { label: "6 Mois", value: 6, description: "Archive longue durée pour absence indéfinie.", icon: History },
    { label: "12 Mois", value: 12, description: "Conservation maximale avant suppression.", icon: Archive },
];

export function ArchiveDurationDialog({
    open,
    onOpenChange,
    memberId,
    memberName,
    onSuccess,
}: ArchiveDurationDialogProps) {
    const [selectedDuration, setSelectedDuration] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const res = await updateMemberProfileStatus(memberId, "ARCHIVED", "MANUAL_ADMIN_ACTION", selectedDuration);
            if (res) {
                toast.success(`Membre ${memberName} archivé pour ${selectedDuration} mois.`);
                onSuccess();
                onOpenChange(false);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'archivage");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-white/5 p-0 overflow-hidden rounded-3xl">
                <div className="bg-amber-500/10 p-8 flex flex-col items-center gap-4 text-center border-b border-amber-500/10">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/10">
                        <Archive className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-black tracking-tight text-white uppercase">Archivage</DialogTitle>
                        <DialogDescription className="text-amber-500/60 font-medium">
                            Définissez la durée de conservation pour <span className="text-amber-400 font-bold">{memberName}</span>
                        </DialogDescription>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                        {DURATIONS.map((duration) => {
                            const Icon = duration.icon;
                            const isSelected = selectedDuration === duration.value;
                            return (
                                <button
                                    key={duration.value}
                                    onClick={() => setSelectedDuration(duration.value)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                                        isSelected 
                                            ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" 
                                            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                        isSelected ? "bg-amber-500/20 text-amber-500" : "bg-white/5 text-zinc-500 group-hover:text-zinc-400"
                                    }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-sm ${isSelected ? "text-amber-400" : "text-zinc-300"}`}>
                                            {duration.label}
                                        </p>
                                        <p className="text-caption text-zinc-500 font-medium leading-tight">
                                            {duration.description}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-amber-500 " />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-caption text-zinc-500 italic leading-snug">
                            Attention : À l'issue de cette période, toutes les données du membre (missions, succès, progression) seront **définitivement supprimées** du système pour respecter le RGPD.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-white/[0.02] border-t border-white/5 gap-2 sm:gap-0">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="text-zinc-500 hover:text-white font-bold uppercase tracking-widest text-caption"
                    >
                        Annuler
                    </Button>
                    <Button 
                        disabled={isSubmitting}
                        onClick={handleConfirm}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-caption px-8 rounded-xl shadow-lg shadow-amber-600/20"
                    >
                        {isSubmitting ? "Archivage..." : "Confirmer l'archivage"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
