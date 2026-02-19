"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceRefreshOcre } from "@/server/actions/ocre-actions";
import { toast } from "sonner";

interface OcreSyncButtonProps {
    guildId: string;
}

export function OcreSyncButton({ guildId }: OcreSyncButtonProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const result = await forceRefreshOcre(guildId);
            if (result.success) {
                if (result.data?.questUpdated) {
                    toast.success("🎉 Nouvelle quête détectée et mise à jour !");
                } else {
                    toast.success("Synchronisation forcée réussie !");
                }
                // Small delay before reload for toast visibility
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.error(result.error || "Erreur lors du rafraîchissement");
                setIsRefreshing(false);
            }
        } catch (error) {
            toast.error("Erreur serveur lors de la synchronisation");
            setIsRefreshing(false);
        }
    };

    return (
        <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="h-12 px-6 border-white/5 bg-zinc-900/40 backdrop-blur-md rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all hover:border-amber-500/30 shadow-lg group shrink-0"
        >
            <RefreshCw className={cn("h-5 w-5", isRefreshing ? "animate-spin text-amber-500" : "group-hover:text-amber-500 transition-colors")} />
            <span className="hidden sm:inline">
                {isRefreshing ? "Synchronisation..." : "Synchroniser mon profil"}
            </span>
            <span className="sm:hidden">
                {isRefreshing ? "..." : "Synchro"}
            </span>
        </Button>
    );
}
