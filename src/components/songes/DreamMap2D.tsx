"use client";

import { useState } from "react";
import Image from "next/image";

type RoomType = "combat" | "fontaine" | "faveur" | "boss";

interface DreamMap2DProps {
    currentFloor: number;
    isLeader?: boolean;
    onFloorSelect?: (floor: number) => void;
}

// Room type for each floor - simplified version following Dofus Songes pattern
// Floors 1-3: Combat only (Palier I)
// Floors 4-9: Combat + occasional Fontaine/Faveur (Palier II)
// Floors 10-15: Combat + more variety (Palier III)
// Floors 16-21: Combat + more variety (Palier IV)
// Floors 22-25: Combat + variety (Palier V)
// Floor 26: Boss (always)
const getFloorType = (floor: number): RoomType => {
    if (floor === 26) return "boss";
    if (floor <= 3) return "combat";
    // Mix of room types for other floors
    const types: RoomType[] = ["combat", "combat", "combat", "fontaine", "faveur"];
    return types[(floor * 7) % types.length]; // Pseudo-random based on floor
};

const ROOM_IMAGES: Record<RoomType, string> = {
    combat: "/songes/salle_combat.png",
    fontaine: "/songes/salle_fontaine.png",
    faveur: "/songes/salle_faveur.png",
    boss: "/songes/salle_boss.png",
};

const ROOM_LABELS: Record<RoomType, string> = {
    combat: "Combat",
    fontaine: "Fontaine Onirique",
    faveur: "Faveur Onirique",
    boss: "Fin du Rêve",
};

// Palier definitions
const PALIERS = [
    { name: "Pensées oniriques", floors: [1, 2, 3], color: "#a78bfa" },
    { name: "Balades fantastiques", floors: [4, 5, 6, 7, 8, 9], color: "#60a5fa" },
    { name: "Espaces imaginaires", floors: [10, 11, 12, 13, 14, 15], color: "#34d399" },
    { name: "Concepts brumeux", floors: [16, 17, 18, 19, 20, 21], color: "#fbbf24" },
    { name: "Abstractions chimériques", floors: [22, 23, 24, 25, 26], color: "#f87171" },
];

export function DreamMap2D({ currentFloor, isLeader, onFloorSelect }: DreamMap2DProps) {
    const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#0a0118] to-[#1a0933] border border-info/30 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Carte des Songes</h2>
                    <p className="text-info/70 text-sm">Progression: {currentFloor} / 26 étages</p>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-bold text-warning">{currentFloor}</div>
                    <div className="text-xs text-info/50">Étage actuel</div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="h-3 bg-info/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-info via-info to-warning transition-all duration-300"
                        style={{ width: `${(currentFloor / 26) * 100}%` }}
                    />
                </div>
            </div>

            {/* Palier sections with floor grid */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {PALIERS.map((palier, palierIdx) => (
                    <div key={palierIdx} className="relative">
                        {/* Palier header */}
                        <div
                            className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0d0520] py-1 z-10"
                            style={{ borderLeftColor: palier.color }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: palier.color }}
                            />
                            <span className="text-sm font-medium" style={{ color: palier.color }}>
                                Palier {palierIdx + 1}: {palier.name}
                            </span>
                        </div>

                        {/* Floors grid */}
                        <div className="grid grid-cols-6 gap-2">
                            {palier.floors.map((floor) => {
                                const roomType = getFloorType(floor);
                                const isCompleted = floor < currentFloor;
                                const isCurrent = floor === currentFloor;
                                const isNext = floor === currentFloor + 1;
                                const isHovered = hoveredFloor === floor;
                                const canClick = isLeader && (floor === currentFloor - 1 || floor === currentFloor + 1);

                                return (
                                    <div
                                        key={floor}
                                        className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all duration-200 cursor-pointer
                                            ${isCurrent
                                                ? "border-warning ring-2 ring-warning/50 scale-105 z-10"
                                                : isCompleted
                                                    ? "border-green-500/50 opacity-60"
                                                    : isNext && isLeader
                                                        ? "border-info/50 hover:border-info"
                                                        : "border-info/30"
                                            }
                                            ${canClick ? " hover:z-10" : ""}
                                        `}
                                        onMouseEnter={() => setHoveredFloor(floor)}
                                        onMouseLeave={() => setHoveredFloor(null)}
                                        onClick={() => canClick && onFloorSelect?.(floor)}
                                    >
                                        {/* Room image */}
                                        <Image
                                            src={ROOM_IMAGES[roomType]}
                                            alt={ROOM_LABELS[roomType]}
                                            fill
                                            className={`object-cover ${isCompleted ? "grayscale" : ""}`}
                                            sizes="80px"
                                        />

                                        {/* Floor number overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded bg-black/60
                                                ${isCurrent ? "text-warning" : isCompleted ? "text-green-400" : "text-foreground"}
                                            `}>
                                                {floor}
                                            </span>
                                        </div>

                                        {/* Completed checkmark */}
                                        {isCompleted && (
                                            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                <span className="text-foreground text-xs">✓</span>
                                            </div>
                                        )}

                                        {/* Current indicator */}
                                        {isCurrent && (
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 
                                                border-l-[6px] border-l-transparent 
                                                border-r-[6px] border-r-transparent 
                                                border-b-[8px] border-b-amber-400
                                                rotate-180"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Hover tooltip */}
            {hoveredFloor !== null && (
                <div className="mt-4 p-3 rounded-lg bg-info/50 border border-info/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-foreground font-medium">Étage {hoveredFloor}</span>
                            <span className="text-info/70 ml-2">
                                {ROOM_LABELS[getFloorType(hoveredFloor)]}
                            </span>
                        </div>
                        {isLeader && (hoveredFloor === currentFloor - 1 || hoveredFloor === currentFloor + 1) && (
                            <span className="text-xs text-warning">Cliquez pour naviguer</span>
                        )}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {Object.entries(ROOM_LABELS).map(([type, label]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded overflow-hidden relative">
                            <Image
                                src={ROOM_IMAGES[type as RoomType]}
                                alt={label}
                                fill
                                className="object-cover"
                                sizes="16px"
                            />
                        </div>
                        <span className="text-info/70">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
