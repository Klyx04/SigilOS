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
            <DialogContent draggable className="max-w-lg bg-surface/95 backdrop-blur-xl border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-foreground">
                        {isFull ? "Rejoindre la file d'attente" : "S'inscrire à l'événement"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {eventTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    {/* Class Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Classe Dofus (optionnel)
                        </Label>

                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {DOFUS_CLASSES.map((classe) => {
                                const isSelected = selectedClass === classe.id;
                                const borderColor = isSelected ? classe.color : undefined;

                                return (
                                    <button
                                        key={classe.id}
                                        type="button"
                                        onClick={() => setSelectedClass(isSelected ? null : classe.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:bg-elevated/50",
                                            isSelected
                                                ? "ring-2 ring-offset-2 ring-offset-zinc-900"
                                                : "bg-surface/50 border-border hover:border-border"
                                        )}
                                        style={{
                                            borderColor: isSelected ? classe.color : undefined,
                                            boxShadow: isSelected ? `0 0 12px ${classe.color}40` : undefined,
                                            backgroundColor: isSelected ? `${classe.color}10` : undefined,
                                        }}
                                    >
                                        <ClassIcon classId={classe.id} size={28} />
                                        <span className={cn(
                                            "text-caption font-medium leading-tight",
                                            isSelected ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {classe.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedClass && (
                            <p className="text-xs text-muted-foreground">
                                Sélection :{" "}
                                <span style={{ color: getClassColor(selectedClass) }}>
                                    {DOFUS_CLASSES.find(c => c.id === selectedClass)?.name}
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Note (optionnel)
                        </Label>
                        <Input
                            placeholder="Ex: Perso principal, Multi possible..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="bg-surface/50 border-border text-foreground"
                            maxLength={100}
                        />
                    </div>

                    {/* Warning if full */}
                    {isFull && (
                        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                            <p className="text-sm text-warning">
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
                        className="text-muted-foreground"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn(
                            "font-bold",
                            isFull
                                ? "bg-warning hover:bg-warning text-warning-foreground"
                                : "bg-green-600 hover:bg-green-500 text-foreground"
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
