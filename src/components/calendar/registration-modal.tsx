"use client";

/**
 * Registration Modal - Class Selection & Signup
 * Uses existing ClassIcon from shared components
 */

import { useState } from "react";
import { Check, Loader2, User, MessageSquare } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { ClassIcon, getClassColor } from "@/components/shared/class-icon";

interface RegistrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventTitle: string;
    isFull: boolean;
    onSubmit: (data: { classe?: string; comment?: string }) => Promise<void>;
}

export function RegistrationModal({
    open,
    onOpenChange,
    eventTitle,
    isFull,
    onSubmit,
}: RegistrationModalProps) {
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit({
                classe: selectedClass || undefined,
                comment: comment || undefined,
            });
            onOpenChange(false);
            setSelectedClass(null);
            setComment("");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent draggable className="max-w-lg bg-zinc-900/95 backdrop-blur-xl border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-zinc-100">
                        {isFull ? "Rejoindre la file d'attente" : "S'inscrire à l'événement"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {eventTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {/* Class Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Classe Dofus (optionnel)
                        </Label>

                        <div className="grid grid-cols-5 gap-2">
                            {DOFUS_CLASSES.map((classe) => {
                                const isSelected = selectedClass === classe.id;
                                const borderColor = isSelected ? classe.color : undefined;

                                return (
                                    <button
                                        key={classe.id}
                                        type="button"
                                        onClick={() => setSelectedClass(isSelected ? null : classe.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:bg-zinc-800/50",
                                            isSelected
                                                ? "ring-2 ring-offset-2 ring-offset-zinc-900"
                                                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                                        )}
                                        style={{
                                            borderColor: isSelected ? classe.color : undefined,
                                            boxShadow: isSelected ? `0 0 12px ${classe.color}40` : undefined,
                                            backgroundColor: isSelected ? `${classe.color}10` : undefined,
                                        }}
                                    >
                                        <ClassIcon classId={classe.id} size={28} />
                                        <span className={cn(
                                            "text-[10px] font-medium leading-tight",
                                            isSelected ? "text-white" : "text-zinc-500"
                                        )}>
                                            {classe.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedClass && (
                            <p className="text-xs text-zinc-500">
                                Sélection :{" "}
                                <span style={{ color: getClassColor(selectedClass) }}>
                                    {DOFUS_CLASSES.find(c => c.id === selectedClass)?.name}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Note (optionnel)
                        </Label>
                        <Input
                            placeholder="Ex: Perso principal, Multi possible..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="bg-zinc-900/50 border-zinc-800 text-zinc-100"
                            maxLength={100}
                        />
                    </div>

                    {/* Warning if full */}
                    {isFull && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <p className="text-sm text-amber-400">
                                ⚠️ L'événement est complet. Vous serez ajouté à la file d'attente et promu automatiquement en cas de désistement.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                        className="text-zinc-400"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn(
                            "font-bold",
                            isFull
                                ? "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                                : "bg-green-600 hover:bg-green-500 text-white"
                        )}
                    >
                        {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Check className="h-4 w-4 mr-2" />
                        )}
                        {isFull ? "Rejoindre la file" : "Confirmer l'inscription"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
