"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Sparkles } from "lucide-react";

interface ActiveBonusBarProps {
    guildId: string;
}

interface BonusData {
    id: string;
    bonusType: string;
    status: "PURCHASED" | "ACTIVE";
    activatesAt: string;
    expiresAt?: string | null;
    purchaserName?: string;
    config: {
        name: string;
        description: string;
    };
}

// Map bonus type to icon filename
const ICON_MAP: Record<string, string> = {
    FORTUNE: "oracle_de_fortune",
    GLADIATOR: "oracle_de_gladiateur",
    HARVESTER: "oracle_de_recolteur",
    WISDOM: "oracle_de_savoir",
    DIVINE: "oracle_divin",
};

function getCountdown(bonus: BonusData) {
    const now = new Date();

    if (bonus.status === "PURCHASED") {
        const activatesAt = new Date(bonus.activatesAt);
        const totalDuration = 24 * 60 * 60 * 1000;
        const timeLeft = activatesAt.getTime() - now.getTime();

        if (timeLeft <= 0) return { text: "Activation...", progress: 100 };

        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        return {
            text: `${hours}h ${String(minutes).padStart(2, "0")}m`,
            progress: ((totalDuration - timeLeft) / totalDuration) * 100,
        };
    }

    if (bonus.status === "ACTIVE" && bonus.expiresAt) {
        const expiresAt = new Date(bonus.expiresAt);
        const totalDuration = 2 * 60 * 60 * 1000;
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (timeLeft <= 0) return { text: "Expiré", progress: 100 };

        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        return {
            text: `${hours}h ${String(minutes).padStart(2, "0")}m`,
            progress: ((totalDuration - timeLeft) / totalDuration) * 100,
        };
    }

    return { text: "", progress: 0 };
}

function BonusBarItem({ bonus }: { bonus: BonusData }) {
    const [countdown, setCountdown] = useState(() => getCountdown(bonus));
    const isActive = bonus.status === "ACTIVE";
    const iconFile = ICON_MAP[bonus.bonusType] || "oracle_de_fortune";

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(getCountdown(bonus));
        }, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [bonus]);

    return (
        <div
            className={`
                flex items-center gap-3 rounded-lg border-2 px-3 py-2 transition-all
                ${isActive ? "border-green-500/50 bg-green-500/5" : "border-orange-500/50 bg-orange-500/5"}
            `}
        >
            {/* Icon + Info */}
            <div className="flex items-center gap-2 min-w-0">
                <img
                    src={`/bonus_guilde/${iconFile}.png`}
                    alt={bonus.config.name}
                    className="w-8 h-8 rounded-full bg-slate-900/50 p-0.5 flex-shrink-0"
                    onError={(e) => {
                        e.currentTarget.src = "/bonus_guilde/oracle_de_fortune.png";
                    }}
                />
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-xs truncate uppercase">{bonus.config.name}</h4>
                        {isActive ? (
                            <Sparkles className="w-3 h-3 text-green-400 animate-pulse flex-shrink-0" />
                        ) : (
                            <Clock className="w-3 h-3 text-orange-400 flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                        Acheté par {bonus.purchaserName || "un membre"}
                    </p>
                </div>
            </div>

            {/* Progress Bar + Counter */}
            <div className="flex-1 min-w-[100px]">
                <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden mb-0.5">
                    <div
                        className={`
                            h-full transition-all duration-1000 rounded-full
                            ${isActive ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-orange-500 to-yellow-400"}
                        `}
                        style={{ width: `${countdown.progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                    <span className={isActive ? "text-green-400" : "text-orange-400"}>
                        {isActive ? "Expire dans" : "Active dans"}
                    </span>
                    <span className="font-mono font-bold text-white">{countdown.text}</span>
                </div>
            </div>

            {/* Status Badge */}
            <div
                className={`
                    px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap flex-shrink-0
                    ${isActive ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}
                `}
            >
                {isActive ? "✨ Actif" : "⏳ Attente"}
            </div>
        </div>
    );
}

export function ActiveBonusBar({ guildId }: ActiveBonusBarProps) {
    const [bonuses, setBonuses] = useState<BonusData[]>([]);

    const loadBonuses = useCallback(async () => {
        try {
            const res = await fetch(`/api/guild/${guildId}/active-bonus`);
            if (res.ok) {
                const data = await res.json();
                setBonuses(data.bonuses || []);
            }
        } catch {
            // Silently fail
        }
    }, [guildId]);

    useEffect(() => {
        loadBonuses();
        const interval = setInterval(loadBonuses, 60000);
        return () => clearInterval(interval);
    }, [loadBonuses]);

    if (bonuses.length === 0) return null;

    return (
        <div className="space-y-2">
            {bonuses.map((bonus) => (
                <BonusBarItem key={bonus.id} bonus={bonus} />
            ))}
        </div>
    );
}
