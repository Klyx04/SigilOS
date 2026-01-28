'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MissionCard } from "./mission-card";
import { InterestModal } from "./interest-modal";
import { ResetCountdown } from "./reset-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { Filter, Swords, Skull, Zap, Clock, Infinity as InfinityIcon, CheckCircle2, Hourglass, Sparkles, RefreshCcw } from "lucide-react";

interface MissionBoardProps {
    missions: (Mission & {
        interests: (MissionInterest & {
            profile: UserProfile & {
                user: User | null
            }
        })[];
        submissions?: Submission[];
    })[];
    currentUserId: string;
    guildId: string; // Discord Guild ID for uploads
}

const STATUS_FILTERS: { label: string; value: 'ALL' | 'PENDING' | 'VALIDATED'; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Tout", value: "ALL" },
    { label: "En attente", value: "PENDING", icon: Hourglass },
    { label: "Validé", value: "VALIDATED", icon: CheckCircle2 },
];

const CATEGORY_FILTERS: { label: string; value: MissionCategory; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "Donjon", value: "DONJON", icon: Swords },
    { label: "Régulation", value: "REGULATION", icon: Skull },
    { label: "Anomalie", value: "ANOMALIE", icon: Zap },
    { label: "Songes", value: "SONGES", icon: InfinityIcon },
    { label: "Expédition", value: "EXPEDITION", icon: Clock },
    { label: "Événement", value: "EVENT", icon: Sparkles },
];

export function MissionBoard({ missions, currentUserId, guildId }: MissionBoardProps) {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState<MissionCategory | 'ALL' | 'PENDING' | 'VALIDATED'>('ALL');
    const [isPending, startTransition] = useTransition();

    // Interest Modal State
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

    // Filter Logic
    const filteredMissions = missions.filter(m => {
        if (selectedCategory === 'ALL') return true;

        // Status Filters
        if (selectedCategory === 'PENDING') {
            return m.submissions?.[0]?.status === 'PENDING';
        }
        if (selectedCategory === 'VALIDATED') {
            return m.submissions?.[0]?.status === 'VALIDATED';
        }

        // Category Filters
        return m.category === selectedCategory;
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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">

                    {/* LEFT: Status Filters (Tabs Style) */}
                    <div className="inline-flex items-center p-1 bg-zinc-900/50 border border-white/5 rounded-lg">
                        {STATUS_FILTERS.map(f => {
                            const IconComponent = f.icon;
                            const isActive = selectedCategory === f.value;
                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setSelectedCategory(f.value)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                        isActive
                                            ? "bg-zinc-800 text-white shadow-sm"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    )}
                                >
                                    {IconComponent && <IconComponent className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-zinc-500")} />}
                                    {f.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-zinc-400 hover:text-white transition-colors border border-white/5 bg-zinc-900/50"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                            title="Actualiser les données"
                        >
                            <RefreshCcw className={cn("w-4 h-4", isPending && "animate-spin")} />
                        </Button>
                        <ResetCountdown />
                    </div>
                </div>

                {/* BOTTOM: Category Filters (Pills Style - Wrapped) */}
                <div className="flex flex-wrap gap-2">
                    {CATEGORY_FILTERS.map(f => {
                        const IconComponent = f.icon;
                        const isActive = selectedCategory === f.value;
                        return (
                            <button
                                key={f.value}
                                onClick={() => setSelectedCategory(f.value)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                                    isActive
                                        ? "bg-primary/10 border-primary/20 text-primary"
                                        : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-300"
                                )}
                            >
                                {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                                {f.label}
                            </button>
                        )
                    })}
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
