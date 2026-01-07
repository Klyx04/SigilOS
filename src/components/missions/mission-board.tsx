'use client'

import { useState } from "react";
import { MissionCard } from "./mission-card";
import { InterestModal } from "./interest-modal";
import { ResetCountdown } from "./reset-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mission, MissionCategory, MissionInterest, UserProfile, User } from "@prisma/client";
import { Filter, Swords, Skull, Zap, Clock, Infinity as InfinityIcon } from "lucide-react";

interface MissionBoardProps {
    missions: (Mission & {
        interests: (MissionInterest & {
            profile: UserProfile & {
                user: User | null
            }
        })[];
    })[];
    currentUserId: string;
    guildId: string; // Discord Guild ID for uploads
}

const FILTERS: { label: string; value: MissionCategory | 'ALL'; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Tout", value: "ALL" },
    { label: "Donjon", value: "DONJON", icon: Swords },
    { label: "Régulation", value: "REGULATION", icon: Skull },
    { label: "Anomalie", value: "ANOMALIE", icon: Zap },
    { label: "Songes", value: "SONGES", icon: InfinityIcon },
    { label: "Expédition", value: "EXPEDITION", icon: Clock },
];

export function MissionBoard({ missions, currentUserId, guildId }: MissionBoardProps) {
    const [selectedCategory, setSelectedCategory] = useState<MissionCategory | 'ALL'>('ALL');

    // Interest Modal State
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

    // Filter Logic
    const filteredMissions = missions.filter(m => {
        if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
        return true;
    });

    // Find selected mission for modal
    const selectedMission = selectedMissionId
        ? missions.find(m => m.id === selectedMissionId)
        : null;

    const handleInterestClick = (missionId: string) => {
        setSelectedMissionId(missionId);
    };

    const handleCloseModal = () => {
        setSelectedMissionId(null);
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-white/5">

                {/* Visual Category Filters */}
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map(f => {
                        const IconComponent = f.icon;
                        return (
                            <Button
                                key={f.value}
                                variant={selectedCategory === f.value ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setSelectedCategory(f.value)}
                                className="h-8 text-xs gap-1.5"
                            >
                                {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                                {f.label}
                            </Button>
                        );
                    })}
                </div>

                {/* Reset Countdown (Replacing Tier Filter) */}
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                    <ResetCountdown />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMissions.map((mission) => (
                    <div key={mission.id} className="h-full">
                        <MissionCard
                            mission={mission}
                            currentUserId={currentUserId}
                            guildId={guildId}
                            onInterestClick={handleInterestClick}
                        />
                    </div>
                ))}

                {/* Empty State */}
                {filteredMissions.length === 0 && (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                        <Filter className="w-8 h-8 mb-2 opacity-50" />
                        <p>Aucune mission ne correspond à ces filtres.</p>
                    </div>
                )}
            </div>

            {/* Interest Modal */}
            {selectedMission && (
                <InterestModal
                    isOpen={!!selectedMissionId}
                    onClose={handleCloseModal}
                    missionTitle={selectedMission.title || "Mission"}
                    missionId={selectedMission.id}
                    interests={selectedMission.interests}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
}
