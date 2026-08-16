"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCircle2, Edit3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

    if (!mounted) return null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={cn(
                        "relative w-full rounded-2xl border border-violet-500/25 overflow-hidden",
                        "bg-gradient-to-r from-violet-950/60 via-indigo-950/60 to-violet-950/60 backdrop-blur-xl",
                        ""
                    )}
                >
                    {/* Animated top border glow */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />

                    {/* Dismiss button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all z-10 group"
                        aria-label="Fermer le rappel"
                    >
                        <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                    </button>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 pr-10">
                        {/* Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shadow-lg">
                            <Bell className="w-4.5 h-4.5 text-violet-400 animate-pulse" />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white uppercase tracking-widest leading-none mb-1">
                                Rappel mensuel du profil
                            </p>
                            <p className="text-caption text-zinc-400 font-medium leading-snug">
                                Vérifiez que vos informations de guilde sont à jour (pseudo Dofus, classe, métiers, disponibilités).
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                            <Button
                                size="sm"
                                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-caption font-black uppercase tracking-widest rounded-xl gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all active:scale-95"
                                onClick={handleConfirmUpToDate}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Tout est à jour
                            </Button>

                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-3.5 bg-violet-600/80 hover:bg-violet-600 text-white text-caption font-black uppercase tracking-widest rounded-xl gap-1.5 border border-violet-400/30 transition-all active:scale-95"
                                onClick={handleEditProfile}
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Modifier
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2.5 text-zinc-500 hover:text-zinc-200 text-caption font-black uppercase tracking-widest rounded-xl gap-1 transition-all"
                                onClick={handleDismiss}
                            >
                                <RefreshCw className="w-3 h-3" />
                                Plus tard
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

