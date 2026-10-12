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
    { label: "12 Mois", value: 12, description: "Politique d'archivage par défaut (une année de conservation).", icon: Archive },
    { label: "6 Mois", value: 6, description: "Archive longue durée pour absence indéfinie.", icon: History },
    { label: "3 Mois", value: 3, description: "Idéal pour une pause prolongée.", icon: Calendar },
    { label: "1 Mois", value: 1, description: "Action standard pour un départ temporaire.", icon: Clock },
];

export function ArchiveDurationDialog({
    open,
    onOpenChange,
    memberId,
    memberName,
    onSuccess,
}: ArchiveDurationDialogProps) {
    const [selectedDuration, setSelectedDuration] = useState<number>(12);
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
            <DialogContent className="sm:max-w-md bg-background border-border p-0 overflow-hidden rounded-3xl">
                <div className="bg-warning/10 p-8 flex flex-col items-center gap-4 text-center border-b border-warning/10">
                    <div className="w-16 h-16 rounded-2xl bg-warning/20 flex items-center justify-center border border-warning/20 shadow-lg shadow-amber-500/10">
                        <Archive className="w-8 h-8 text-warning" />
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-black tracking-tight text-foreground uppercase">Archivage</DialogTitle>
                        <DialogDescription className="text-warning/60 font-medium">
                            Définissez la durée de conservation pour <span className="text-warning font-bold">{memberName}</span>
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
                                            ? "bg-warning/10 border-warning/30 ring-1 ring-warning/20" 
                                            : "bg-surface border-border hover:border-border hover:bg-surface"
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                        isSelected ? "bg-warning/20 text-warning" : "bg-surface text-muted-foreground group-hover:text-muted-foreground"
                                    }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold text-sm ${isSelected ? "text-warning" : "text-foreground"}`}>
                                            {duration.label}
                                        </p>
                                        <p className="text-caption text-muted-foreground font-medium leading-tight">
                                            {duration.description}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-warning " />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 rounded-xl bg-danger/5 border border-danger/10 flex items-start gap-3">
                        <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                        <p className="text-caption text-muted-foreground italic leading-snug">
                            L'archivage suspend l'accès Dashboard du membre. Pendant la durée choisie, il peut être réintégré à tout moment. À l'issue de cette période, ses données (missions, succès, progression) sont définitivement supprimées pour respecter le RGPD.
                        </p>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-surface border-t border-border gap-2 sm:gap-0">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-caption"
                    >
                        Annuler
                    </Button>
                    <Button 
                        disabled={isSubmitting}
                        onClick={handleConfirm}
                        className="bg-warning hover:bg-warning text-warning-foreground font-black uppercase tracking-widest text-caption px-8 rounded-xl shadow-lg shadow-amber-600/20"
                    >
                        {isSubmitting ? "Archivage..." : "Confirmer l'archivage"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
