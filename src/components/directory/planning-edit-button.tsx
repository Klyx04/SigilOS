"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { AvailabilityHeatmap } from "@/components/profile/availability-heatmap";
import { updateAvailability } from "@/server/actions/profile-actions";
import type { GlobalAvailability, AvailabilityMap } from "@/lib/dofus-assets";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";

interface PlanningEditButtonProps {
    guildId: string;
    initialAvailability?: GlobalAvailability | AvailabilityMap | null;
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
}

/**
 * #132 — « Éditer mon planning » directement depuis /planning.
 * Chaque membre édite sa propre disponibilité (synchro avec le profil perso,
 * même action serveur `updateAvailability` — targetUserId absent = soi-même).
 */
export function PlanningEditButton({ guildId, initialAvailability, vacationStart, vacationEnd }: PlanningEditButtonProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSave = (availability: GlobalAvailability) => {
        startTransition(async () => {
            const res = await updateAvailability({ guildId, availability });
            if (res.success) {
                toast.success("Disponibilités mises à jour");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                disabled={isPending}
                variant="outline"
                className="h-9 rounded-xl border-border bg-surface hover:bg-surface text-xs font-semibold text-muted-foreground hover:text-foreground gap-2 px-3 transition-colors"
            >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5 text-success" />}
                Éditer mon planning
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl bg-background border-border text-foreground max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight">Mon planning</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Vos disponibilités, semaine par semaine — synchronisées avec votre profil perso.
                        </DialogDescription>
                    </DialogHeader>

                    <AvailabilityHeatmap
                        availability={initialAvailability || {}}
                        onSave={handleSave}
                        readOnly={false}
                        vacationStart={vacationStart}
                        vacationEnd={vacationEnd}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
