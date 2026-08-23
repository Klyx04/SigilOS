"use client";

import { BonusType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

interface BonusCardProps {
    type: BonusType;
    name: string;
    description: string;
    cost: number;
    iconPath?: string;
    isPurchased: boolean;
    isActive: boolean;
    onPurchase: () => void;
}

export function BonusCard({
    type,
    name,
    description,
    cost,
    iconPath = "/game-data/bonuses/default.png",
    isPurchased,
    isActive,
    onPurchase,
}: BonusCardProps) {
    const getTypeColor = (type: BonusType) => {
        switch (type) {
            case "FORTUNE":
                return "border-warning/50 bg-warning/5";
            case "GLADIATOR":
                return "border-danger/50 bg-danger/5";
            case "HARVESTER":
                return "border-green-500/50 bg-green-500/5";
            case "WISDOM":
                return "border-info/50 bg-info/5";
            case "DIVINE":
                return "border-info/50 bg-info/5";
            default:
                return "border-border bg-elevated/30";
        }
    };

    const getTypeGlow = (type: BonusType) => {
        switch (type) {
            case "FORTUNE":
                return "shadow-yellow-500/20";
            case "GLADIATOR":
                return "shadow-red-500/20";
            case "HARVESTER":
                return "shadow-green-500/20";
            case "WISDOM":
                return "shadow-blue-500/20";
            case "DIVINE":
                return "shadow-purple-500/20";
            default:
                return "";
        }
    };

    return (
        <div
            className={`
                relative overflow-hidden rounded-lg border-2 p-4 transition-all
                ${getTypeColor(type)}
                ${!isPurchased && !isActive ? "hover:shadow-lg  " + getTypeGlow(type) : ""}
                ${isPurchased || isActive ? "opacity-60" : ""}
            `}
        >
            {/* Status Badge */}
            {isActive && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/50 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-xs font-bold text-green-400">ACTIF</span>
                </div>
            )}
            {isPurchased && !isActive && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-warning/20 border border-warning/50 rounded-full px-2 py-0.5">
                    <Clock className="w-3 h-3 text-warning" />
                    <span className="text-xs font-bold text-warning">EN ATTENTE</span>
                </div>
            )}

            {/* Icon */}
            <div className="flex justify-center mb-3">
                <div className="w-16 h-16 rounded-full bg-surface/50 p-2 flex items-center justify-center">
                    <img src={iconPath} alt={name} className="w-full h-full object-contain" onError={(e) => {
                        e.currentTarget.src = "/game-data/bonuses/default.png";
                    }} />
                </div>
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-foreground text-center mb-2">{name}</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 min-h-[40px]">{description}</p>

            {/* Cost & Button */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-warning">{cost}</span>
                    <span className="text-xs text-muted-foreground uppercase">kamas</span>
                </div>
                <Button
                    onClick={onPurchase}
                    disabled={isPurchased || isActive}
                    size="sm"
                    className="bg-info hover:bg-info disabled:opacity-50"
                >
                    {isPurchased || isActive ? "Indisponible" : "Acheter"}
                </Button>
            </div>
        </div>
    );
}
