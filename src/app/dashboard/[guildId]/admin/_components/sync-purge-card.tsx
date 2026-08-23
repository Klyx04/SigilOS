"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncGuildMembers } from "@/server/actions/lifecycle-actions";
import { toast } from "sonner";
import { RefreshCcw, ShieldCheck, UserX, Info, Loader2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface SyncPurgeCardProps {
    guildId: string;
}

export function SyncPurgeCard({ guildId }: SyncPurgeCardProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleSync = async () => {
        setIsLoading(true);
        try {
            const result = await syncGuildMembers(guildId);
            if (result.success) {
                toast.success("Synchronisation Militarisée terminée", {
                    description: result.message,
                    icon: <ShieldCheck className="w-5 h-5 text-success" />
                });
            } else {
                toast.error(result.error || "Une erreur est survenue.");
            }
        } catch (error) {
            toast.error("Échec de la communication avec le serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface/30 border border-border/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center border border-info/20 shrink-0">
                    <RefreshCcw className="w-5 h-5 text-info" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground">Actualisation des Membres</h3>
                    <p className="text-caption text-muted-foreground leading-tight max-w-md">
                        Synchronise votre liste SigilOS avec Discord pour archiver les membres ayant quitté le serveur.
                    </p>
                </div>
            </div>

            <Button
                onClick={handleSync}
                disabled={isLoading}
                size="sm"
                className="bg-info/10 hover:bg-info/20 text-info border border-info/30 font-semibold h-9 px-4 shrink-0 transition-all hover:scale-[1.02]"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                        Analyse...
                    </>
                ) : (
                    <>
                        <RefreshCcw className="mr-2 w-3 h-3" />
                        Synchroniser
                    </>
                )}
            </Button>
        </div>
    );
}
