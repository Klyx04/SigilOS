"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { 
    getGuildSynergyForDofus, 
    toggleQuestStatus,
    MemberOnQuest,
    GuildHeatmapData,
} from "@/server/actions/dofus-quest-actions";
import { DofusTimelineQuest } from "./DofusTimelineQuest";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DofusQuestStatus } from "@prisma/client";

interface DofusQuestManagerV3Props {
    guildId: string;
    dofus: any;
    chains: any[];
    dofusColor: string;
    heatmapData?: GuildHeatmapData | null;
    selectedCharacter?: string;
    initialGlobalCompletedIds?: string[];
}

export function DofusQuestManagerV3({ 
    guildId, 
    dofus, 
    chains, 
    dofusColor, 
    heatmapData,
    selectedCharacter = "PRINCIPAL",
    initialGlobalCompletedIds = []
}: DofusQuestManagerV3Props) {
    const [synergy, setSynergy] = useState<Record<string, MemberOnQuest[]>>({});
    const [loadingSynergy, setLoadingSynergy] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ pseudo: string; image: string | null } | null>(null);
    
    const [localOverrides, setLocalOverrides] = useState<Map<string, DofusQuestStatus>>(new Map());

    const router = useRouter();
    const [, startTransition] = useTransition();

    // Fetch current user info for "QUI EST OÙ" panel
    useEffect(() => {
        import("@/server/actions/user-actions").then(m => m.getUserContext(guildId)).then(ctx => {
            if (ctx) {
                setCurrentUser({
                    pseudo: ctx.pseudoDofus || ctx.name || "Moi",
                    image: ctx.image || null
                });
            }
        }).catch(() => {});
        setLocalOverrides(new Map());
    }, [guildId, chains]);

    const completedIds = useMemo(() => {
        const ids = new Set<string>(initialGlobalCompletedIds);
        
        chains.forEach(c => {
            (c?.entries || []).forEach((e: any) => {
                const override = localOverrides.get(e.id);
                const overrideStr = override as string | undefined;
                const statusStr = e.status as string;
                if (overrideStr === "NOT_STARTED") {
                    ids.delete(e.id);
                    if (e.dofusdbId) ids.delete(String(e.dofusdbId));
                } else if (overrideStr === "COMPLETED" || statusStr === "COMPLETED") {
                    ids.add(e.id);
                    if (e.dofusdbId) ids.add(String(e.dofusdbId));
                } else if (overrideStr === "IN_PROGRESS" || statusStr === "IN_PROGRESS") {
                    // neutral
                }
            });
        });
        return ids;
    }, [chains, localOverrides, initialGlobalCompletedIds]);

    async function handleToggleStatus(questId: string, newStatus: DofusQuestStatus) {
        setLocalOverrides(prev => {
            const next = new Map(prev);
            next.set(questId, newStatus);
            return next;
        });

        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, questId, newStatus, selectedCharacter);
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Erreur de mise à jour");
                setLocalOverrides(prev => {
                    const next = new Map(prev);
                    next.delete(questId);
                    return next;
                });
            }
        });
    }

    async function loadSynergy() {
        setLoadingSynergy(true);
        const res = await getGuildSynergyForDofus(guildId, dofus.id);
        if (res.success && res.data) setSynergy(res.data);
        setLoadingSynergy(false);
    }

    useEffect(() => {
        loadSynergy();
        const interval = setInterval(loadSynergy, 120000);
        return () => clearInterval(interval);
    }, [dofus.id, guildId]);

    const totalMembers = Object.values(synergy).reduce((acc, members) => {
        members.forEach(m => acc.add(m.profileId));
        return acc;
    }, new Set()).size;

    return (
        <div className="space-y-4">
            <DofusTimelineQuest
                guildId={guildId}
                dofus={dofus}
                chains={chains}
                dofusColor={dofusColor}
                completedIds={completedIds}
                onToggleStatus={handleToggleStatus}
                selectedCharacter={selectedCharacter}
                synergy={synergy}
                currentUser={currentUser || undefined}
            />
        </div>
    );
}