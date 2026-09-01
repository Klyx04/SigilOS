"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceRefreshOcre } from "@/server/actions/ocre-actions";
import { toast } from "sonner";

interface OcreSyncButtonProps {
    guildId: string;
    lastSync?: Date | null;
}

export function OcreSyncButton({ guildId, lastSync }: OcreSyncButtonProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Client-only hydration guard: `toLocaleString("fr-FR")` formats in the runtime's local
    // timezone, which differs between the Node server (UTC) and the browser (local tz).
    // Rendering it during SSR would create a text mismatch → React #418. Gated behind `mounted`.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

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
        <div className="flex items-center gap-4">
            {mounted && lastSync && (
                <div className="hidden md:flex flex-col items-end opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1.5">Dernière MAJ</span>
                    <span className="text-caption font-bold text-foreground tabular-nums leading-none">
                        {new Date(lastSync).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                        })}
                    </span>
                </div>
            )}
            
            <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                className="h-12 px-6 border-border bg-surface/40 backdrop-blur-md rounded-xl font-bold flex items-center gap-2 hover:bg-elevated transition-all hover:border-warning/30 shadow-lg group shrink-0"
            >
                <RefreshCw className={cn("h-5 w-5", isRefreshing ? "animate-spin text-warning" : "group-hover:text-warning transition-colors")} />
                <span className="hidden sm:inline">
                    {isRefreshing ? "Synchronisation..." : "Synchroniser mon profil"}
                </span>
                <span className="sm:hidden">
                    {isRefreshing ? "..." : "Synchro"}
                </span>
            </Button>
        </div>
    );
}
