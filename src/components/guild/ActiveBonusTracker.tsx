"use client";

import { useEffect, useState } from "react";
import { BonusStatus } from "@prisma/client";
import { Clock, Sparkles } from "lucide-react";

interface ActiveBonusTrackerProps {
    guildId: string;
}

interface BonusData {
    id: string;
    bonusType: string;
    status: BonusStatus;
    activatesAt: Date;
    expiresAt?: Date | null;
    config: {
        name: string;
        description: string;
    };
}

export function ActiveBonusTracker({ guildId }: ActiveBonusTrackerProps) {
    const [bonus, setBonus] = useState<BonusData | null>(null);
    const [timeRemaining, setTimeRemaining] = useState("");
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        loadBonus();
        const interval = setInterval(loadBonus, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [guildId]);

    useEffect(() => {
        if (!bonus) return;

        const updateCountdown = () => {
            const now = new Date();

            if (bonus.status === "PURCHASED") {
                const activatesAt = new Date(bonus.activatesAt);
                const totalDuration = 24 * 60 * 60 * 1000; // 24h in ms
                const timeLeft = activatesAt.getTime() - now.getTime();

                if (timeLeft <= 0) {
                    setTimeRemaining("Activation en cours...");
                    setProgress(100);
                    return;
                }

                const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                setTimeRemaining(`${hours}h ${minutes}m`);
                setProgress(((totalDuration - timeLeft) / totalDuration) * 100);
            } else if (bonus.status === "ACTIVE" && bonus.expiresAt) {
                const expiresAt = new Date(bonus.expiresAt);
                const activatedAt = new Date(new Date(bonus.expiresAt).getTime() - 2 * 60 * 60 * 1000);
                const totalDuration = 2 * 60 * 60 * 1000; // 2h in ms
                const timeLeft = expiresAt.getTime() - now.getTime();

                if (timeLeft <= 0) {
                    setTimeRemaining("Expiré");
                    setProgress(100);
                    return;
                }

                const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                setTimeRemaining(`${hours}h ${minutes}m`);
                setProgress(((totalDuration - timeLeft) / totalDuration) * 100);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [bonus]);

    const loadBonus = async () => {
        try {
            const res = await fetch(`/api/guild/${guildId}/active-bonus`);
            if (res.ok) {
                const data = await res.json();
                if (data.bonus) {
                    setBonus(data.bonus);
                } else {
                    setBonus(null);
                }
            }
        } catch (error) {
            console.error("Failed to load active bonus:", error);
        }
    };

    if (!bonus) return null;

    const isActive = bonus.status === "ACTIVE";
    const isPending = bonus.status === "PURCHASED";

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-surface via-surface/95 to-transparent backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className={`
                    rounded-lg border-2 p-4 transition-all
                    ${isActive ? "border-green-500/50 bg-green-500/5" : "border-warning/50 bg-warning/5"}
                `}>
                    <div className="flex items-center justify-between gap-4">
                        {/* Icon + Name */}
                        <div className="flex items-center gap-3">
                            {isActive ? (
                                <Sparkles className="w-6 h-6 text-green-400 animate-pulse" />
                            ) : (
                                <Clock className="w-6 h-6 text-warning" />
                            )}
                            <div>
                                <h3 className="font-bold text-foreground">{bonus.config.name}</h3>
                                <p className="text-xs text-muted-foreground">{bonus.config.description}</p>
                            </div>
                        </div>

                        {/* Progress + Time */}
                        <div className="flex-1 max-w-md">
                            {/* Progress Bar */}
                            <div className="relative h-3 bg-elevated rounded-full overflow-hidden mb-1">
                                <div
                                    className={`
                                        h-full transition-all duration-300 rounded-full
                                        ${isActive ? "bg-gradient-to-r from-green-500 to-success" : "bg-gradient-to-r from-warning to-warning"}
                                    `}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Time Label */}
                            <div className="flex items-center justify-between text-xs">
                                <span className={isActive ? "text-green-400" : "text-warning"}>
                                    {isPending ? "Activation dans" : "Expire dans"}
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                    {timeRemaining}
                                </span>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className={`
                            px-3 py-1 rounded-full text-xs font-bold uppercase
                            ${isActive ? "bg-green-500/20 text-green-400" : "bg-warning/20 text-warning"}
                        `}>
                            {isActive ? "✨ Actif" : "⏳ En attente"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
