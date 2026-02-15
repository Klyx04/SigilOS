'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MissionCard } from "./mission-card";
import { InterestModal } from "./interest-modal";
import { ResetCountdown } from "./reset-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { Filter, Swords, Skull, Zap, Clock, Infinity as InfinityIcon, CheckCircle2, Hourglass, Sparkles, RefreshCcw, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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

    // Category Styling Map
    const CATEGORY_STYLES: Record<MissionCategory, { bg: string; border: string; text: string; icon: string; shadow: string }> = {
        DONJON: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", icon: "text-indigo-400", shadow: "shadow-indigo-500/10" },
        REGULATION: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", icon: "text-rose-400", shadow: "shadow-rose-500/10" },
        ANOMALIE: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-400", icon: "text-fuchsia-400", shadow: "shadow-fuchsia-500/10" },
        SONGES: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", icon: "text-cyan-400", shadow: "shadow-cyan-500/10" },
        EXPEDITION: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: "text-amber-400", shadow: "shadow-amber-500/10" },
        EVENT: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", icon: "text-yellow-400", shadow: "shadow-yellow-500/10" },
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">

                    {/* LEFT: Quick Search / Status (Pill Design) */}
                    <div className="flex items-center gap-2 p-1 bg-black/40 backdrop-blur-md border border-white/5 rounded-full shadow-lg">
                        {STATUS_FILTERS.map(f => {
                            const IconComponent = f.icon;
                            const isActive = selectedCategory === f.value;
                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setSelectedCategory(f.value)}
                                    className={cn(
                                        "relative flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all duration-300",
                                        isActive
                                            ? "bg-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] ring-1 ring-white/10"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                    )}
                                >
                                    {IconComponent && <IconComponent className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-zinc-600")} />}
                                    {f.label}
                                    {isActive && (
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* RIGHT: Refresh */}
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent sm:hidden" />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-full border border-white/5 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                            onClick={() => startTransition(() => router.refresh())}
                            disabled={isPending}
                            title="Actualiser les données"
                        >
                            <RefreshCcw className={cn("w-4 h-4", isPending && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* BOTTOM: Category Filters (Colored Tags) */}
                <div className="flex flex-wrap gap-3">
                    {CATEGORY_FILTERS.map(f => {
                        const IconComponent = f.icon;
                        const isActive = selectedCategory === f.value;
                        // Cast to ensure type safety if value is strictly typed
                        const style = CATEGORY_STYLES[f.value as MissionCategory];

                        return (
                            <button
                                key={f.value}
                                onClick={() => setSelectedCategory(f.value)}
                                className={cn(
                                    "group relative flex items-center gap-2.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-300",
                                    isActive
                                        ? cn(style.bg, style.border, style.text, style.shadow, "ring-1 ring-inset ring-white/10 scale-105")
                                        : "bg-zinc-900/40 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300 hover:bg-zinc-900/80"
                                )}
                            >
                                <div className={cn(
                                    "p-1 rounded-md transition-colors",
                                    isActive ? "bg-black/20" : "bg-black/40 group-hover:bg-black/60"
                                )}>
                                    {IconComponent && <IconComponent className={cn(
                                        "w-3.5 h-3.5 transition-colors",
                                        isActive ? style.icon : "text-zinc-600 group-hover:text-zinc-400"
                                    )} />}
                                </div>
                                <span>{f.label}</span>

                                {isActive && (
                                    <div className={cn("absolute inset-0 rounded-xl opacity-20 bg-gradient-to-b from-white/20 to-transparent pointer-events-none")} />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                {filteredMissions.length === 0 ? (
                    <div className="col-span-full py-12">
                        <EmptyState
                            icon={SearchX}
                            title="Aucune mission trouvée"
                            description="Ajustez vos filtres ou revenez plus tard pour voir les nouveaux défis."
                            variant="glow"
                        />
                    </div>
                ) : null}
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
