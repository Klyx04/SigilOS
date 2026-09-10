"use client";

import { useState, useEffect } from "react";
import { Bell, X, CheckCircle2, Edit3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileReminderBannerProps {
    guildId: string;
    /** Number of days between reminders. Default: 30 */
    intervalDays?: number;
    onSelectTab?: (tab: string) => void;
}

const STORAGE_KEY_PREFIX = "sigilos-profile-reminder-";
const DEFAULT_INTERVAL_DAYS = 30;

export function ProfileReminderBanner({
    guildId,
    intervalDays = DEFAULT_INTERVAL_DAYS,
    onSelectTab,
}: ProfileReminderBannerProps) {
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    const storageKey = `${STORAGE_KEY_PREFIX}${guildId}`;

    useEffect(() => {
        setMounted(true);
        try {
            const lastDismissedStr = localStorage.getItem(storageKey);
            if (!lastDismissedStr) {
                // Never dismissed: show after a short delay so it doesn't flash on first load
                const timer = setTimeout(() => setVisible(true), 1200);
                return () => clearTimeout(timer);
            }

            const lastDismissed = new Date(lastDismissedStr);
            const daysSince = (Date.now() - lastDismissed.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSince >= intervalDays) {
                const timer = setTimeout(() => setVisible(true), 1200);
                return () => clearTimeout(timer);
            }
        } catch {
            // localStorage might be unavailable (private browsing, etc.)
        }
    }, [storageKey, intervalDays]);

    const handleDismiss = () => {
        setVisible(false);
        try {
            localStorage.setItem(storageKey, new Date().toISOString());
        } catch {
            // ignore
        }
    };

    const handleConfirmUpToDate = () => {
        handleDismiss();
        toast.success("Merci ! Vos informations sont confirmées à jour pour ce mois-ci.");
    };

    const handleEditProfile = () => {
        handleDismiss();
        if (onSelectTab) {
            onSelectTab("overview");
        }
        setTimeout(() => {
            const el = document.getElementById("profile-edit-section");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 100);
        toast.info("Modifiez vos informations ci-dessous (classe, métiers, disponibilités).");
    };

    if (!mounted || !visible) return null;

    return (
        <div className="w-full rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Vérifiez votre profil</p>
                        <p className="text-xs text-muted-foreground leading-snug">
                            Pseudo Dofus, classe, métiers, disponibilités — un rappel par mois.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        onClick={handleConfirmUpToDate}
                        className="h-8 px-3.5 rounded-xl text-xs font-semibold gap-1.5"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tout est à jour
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditProfile}
                        className="h-8 px-3.5 rounded-xl text-xs font-semibold gap-1.5"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modifier
                    </Button>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDismiss}
                        className="h-8 px-2.5 rounded-xl text-xs font-medium text-muted-foreground gap-1"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Plus tard
                    </Button>

                    <button
                        onClick={handleDismiss}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                        aria-label="Fermer le rappel"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
