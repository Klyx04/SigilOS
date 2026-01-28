"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncMembershipStatus } from "@/server/actions/sync-actions";

interface SyncButtonProps {
    guildId: string;
}

export function MemberSyncButton({ guildId }: SyncButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        archived: number;
        reactivated: number;
        message?: string;
    } | null>(null);

    async function handleSync() {
        setIsLoading(true);
        setResult(null);

        try {
            const syncResult = await syncMembershipStatus(guildId);
            setResult({
                success: syncResult.success,
                archived: syncResult.archived,
                reactivated: syncResult.reactivated,
                message: syncResult.errors.length > 0 ? syncResult.errors[0] : undefined
            });
        } catch (error) {
            setResult({
                success: false,
                archived: 0,
                reactivated: 0,
                message: error instanceof Error ? error.message : "Erreur inconnue"
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <Button
                    onClick={handleSync}
                    disabled={isLoading}
                    variant="outline"
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    {isLoading ? "Synchronisation..." : "Synchroniser les Membres"}
                </Button>

                {result && (
                    <div className={`flex items-center gap-2 text-sm ${result.success ? "text-green-500" : "text-red-500"}`}>
                        {result.success ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        {result.success ? (
                            <span>
                                {result.archived > 0 || result.reactivated > 0 ? (
                                    <>
                                        {result.archived > 0 && `${result.archived} archivé(s)`}
                                        {result.archived > 0 && result.reactivated > 0 && ", "}
                                        {result.reactivated > 0 && `${result.reactivated} réactivé(s)`}
                                    </>
                                ) : (
                                    "Tout est synchronisé ✓"
                                )}
                            </span>
                        ) : (
                            <span>{result.message}</span>
                        )}
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Compare les membres Discord avec les profils en base.
                Archive automatiquement les profils des membres ayant quitté le serveur.
            </p>
        </div>
    );
}
