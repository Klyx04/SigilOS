"use client";

import { RunCard } from "./RunCard";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    _count: { floors: number; bonuses: number };
};

interface RunCardGridProps {
    runs: RunWithRelations[];
    currentUserId?: string;
}

export function RunCardGrid({ runs, currentUserId }: RunCardGridProps) {
    if (runs.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">🌙</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    Aucune run en cours
                </h3>
                <p className="text-purple-300/70">
                    Créez une nouvelle run pour commencer l'aventure dans les Songes Infinis
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run) => (
                <RunCard key={run.id} run={run} currentUserId={currentUserId} />
            ))}
        </div>
    );
}
