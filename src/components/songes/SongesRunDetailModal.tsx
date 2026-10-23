"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RunCard } from "./RunCard";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    joinRequests?: { id: string; userId: string; message: string | null; classe: string; status?: string }[];
    _count: { floors: number; bonuses: number };
};

interface SongesRunDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    run: RunWithRelations;
    guildId: string;
    currentUserId?: string;
    canJoinSonges?: boolean;
    isAdmin?: boolean;
    isDiscordConfigured?: boolean;
    onRefresh?: () => void;
}

export function SongesRunDetailModal({
    isOpen,
    onClose,
    run,
    guildId,
    currentUserId,
    canJoinSonges = true,
    isAdmin = false,
    isDiscordConfigured = false,
    onRefresh,
}: SongesRunDetailModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 bg-surface border-border rounded-lg">
                <DialogTitle className="sr-only">Détails de la run Songes</DialogTitle>
                <DialogDescription className="sr-only">Progression et membres de la run Songes</DialogDescription>
                <RunCard
                    run={run}
                    guildId={guildId}
                    currentUserId={currentUserId}
                    canJoinSonges={canJoinSonges}
                    isAdmin={isAdmin}
                    isDiscordConfigured={isDiscordConfigured}
                    onRefresh={onRefresh}
                />
            </DialogContent>
        </Dialog>
    );
}
