"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getISOWeek, getYear } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { dismissAvailabilityReminder } from "@/server/actions/profile-actions";

/**
 * Rappel hebdomadaire « remplis ta semaine de disponibilités ».
 * - Ne s'affiche JAMAIS si le module n'est pas activé côté admin (props `enabled` calculée serveur).
 * - Ne s'affiche JAMAIS pendant l'onboarding de la guilde (server-side).
 * - Persistance hybride : localStorage + Base de Données (aucun re-spam sur mobile/autres devices).
 */
const STORAGE_KEY = "sigil-availability-reminder-week";

function currentWeekKey(): string {
    const now = new Date();
    return `${getYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

export function AvailabilityReminderPopup({ guildId, enabled }: { guildId: string; enabled: boolean }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        try {
            const week = currentWeekKey();
            const seen = localStorage.getItem(STORAGE_KEY);
            if (seen === week) return;
            localStorage.setItem(STORAGE_KEY, week);
            setOpen(true);
        } catch {
            // localStorage indisponible → silencieux
        }
    }, [enabled]);

    const handleDismiss = () => {
        setOpen(false);
        try {
            localStorage.setItem(STORAGE_KEY, currentWeekKey());
        } catch {}
        dismissAvailabilityReminder(guildId).catch(() => {});
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); else setOpen(v); }}>
            <DialogContent className="max-w-md border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <span className="w-8 h-8 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center shrink-0">
                            <CalendarClock className="w-4 h-4 text-success" />
                        </span>
                        Votre semaine de disponibilités
                    </DialogTitle>
                    <DialogDescription className="leading-relaxed">
                        Votre planning hebdomadaire n&apos;est pas encore renseigné. En 30 secondes,
                        indiquez vos créneaux de jeu — ça aide les officiers à planifier les raids
                        et événements de la guilde.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        asChild
                        className="flex-1 bg-success hover:bg-success text-success-foreground font-semibold"
                        onClick={handleDismiss}
                    >
                        <Link href={`/dashboard/${guildId}/profile?tab=planning`}>
                            Remplir ma semaine
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={handleDismiss} className="flex-1">
                        Plus tard (ne plus me rappeler cette semaine)
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
