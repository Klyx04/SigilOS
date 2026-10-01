"use client";

/**
 * Registration Modal - Class Selection & Signup
 * Uses existing ClassIcon from shared components
 */

import { useEffect, useMemo, useState } from "react";
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
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { ClassIcon, getClassColor } from "@/components/shared/class-icon";

interface RegistrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventTitle: string;
    isFull: boolean;
    onSubmit: (data: { classe?: string; comment?: string }) => Promise<void>;
    /** Personnages Dofus du membre : raccourci « Mes personnages » (classe + secondaires). */
    myCharacters?: { main: string | null; secondaries: string[] };
}

export function RegistrationModal({
    open,
    onOpenChange,
    eventTitle,
    isFull,
    onSubmit,
    myCharacters,
}: RegistrationModalProps) {
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // « Mes personnages » : mes classes connues (principale d'abord), en référentiel unique.
    // Un profil vide ⇒ aucune rangée : l'écran reste exactement celui d'avant.
    const myRoster = useMemo(() => {
        const values = [myCharacters?.main, ...(myCharacters?.secondaries ?? [])];
        const found = values
            .map((c) => getClass((c ?? "").trim()))
            .filter((c): c is NonNullable<ReturnType<typeof getClass>> => Boolean(c));
        return Array.from(new Map(found.map((c) => [c.id, c])).values());
    }, [myCharacters?.main, myCharacters?.secondaries]);

    // Personnage principal pré-sélectionné à l'ouverture : un clic suffit à confirmer.
    useEffect(() => {
        if (!open) return;
        const main = getClass((myCharacters?.main ?? "").trim());
        if (main) setSelectedClass(main.id);
    }, [open, myCharacters?.main]);

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

                        {/* « Mes personnages » — une rangée fine, uniquement si le profil en
                            connaît : un clic au lieu de chercher parmi les 19 icônes. */}
                        {myRoster.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Mes personnages
                                </span>
                                {myRoster.map((classe) => {
                                    const isPicked = selectedClass === classe.id;
                                    return (
                                        <button
                                            key={classe.id}
                                            type="button"
                                            onClick={() => setSelectedClass(isPicked ? null : classe.id)}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption font-bold transition-colors",
                                                isPicked
                                                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                                                    : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <ClassIcon classId={classe.id} size={14} />
                                            {classe.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

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
