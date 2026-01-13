"use client";

import Link from "next/link";
import { ArrowLeft, Crown, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, OBJECTIVES, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
import type { DreamRun, DreamRunMember } from "@prisma/client";

type RunWithMembers = DreamRun & {
    members: DreamRunMember[];
};

interface RunDetailHeaderProps {
    run: RunWithMembers;
    guildId: string;
}

export function RunDetailHeader({ run, guildId }: RunDetailHeaderProps) {
    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];

    const formatDate = (date: Date | null) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-900/50 via-indigo-900/50 to-blue-900/50 border border-purple-500/30 p-6">
            {/* Background glow */}
            <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20"
                style={{ backgroundColor: difficulty?.couleur }}
            />

            <div className="relative">
                {/* Back button */}
                <Link href={`/dashboard/${guildId}/songes`}>
                    <Button variant="ghost" size="sm" className="text-purple-300 hover:text-white mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour au Hub
                    </Button>
                </Link>

                {/* Title row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: difficulty?.couleur }}
                            />
                            {difficulty?.label}
                            <span className={`px-2 py-0.5 text-sm rounded ${run.status === "RECRUITING"
                                    ? "bg-green-500/20 text-green-400"
                                    : run.status === "IN_PROGRESS"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : run.status === "COMPLETED"
                                            ? "bg-amber-500/20 text-amber-400"
                                            : "bg-red-500/20 text-red-400"
                                }`}>
                                {run.status === "RECRUITING" ? "Recrutement" :
                                    run.status === "IN_PROGRESS" ? "En cours" :
                                        run.status === "COMPLETED" ? "Terminé" : "Échec"}
                            </span>
                        </h1>
                        <p className="text-purple-300/70 mt-1 flex items-center gap-2">
                            {objective?.icon} {objective?.label}
                        </p>
                    </div>

                    {/* Quick stats */}
                    <div className="flex gap-6 text-sm">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-amber-400">{run.currentFloor}</div>
                            <div className="text-purple-300/70">/ 26 étages</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">{run.pointsReve}</div>
                            <div className="text-purple-300/70">Points de Rêve</div>
                        </div>
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex gap-6 mt-4 text-sm text-purple-300/70">
                    <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {run.members.length}/4 membres
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Créée le {formatDate(run.createdAt)}
                    </div>
                    {run.startedAt && (
                        <div className="flex items-center gap-1">
                            Démarrée le {formatDate(run.startedAt)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
