"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cleanupGhostUsers, cleanupOrphanedProfiles } from "@/server/actions/super-admin-actions";
import { toast } from "sonner";
import { Trash2, Loader2, Sparkles, UserMinus } from "lucide-react";

export function JanitorButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [isOrphanLoading, setIsOrphanLoading] = useState(false);
    const [testMode, setTestMode] = useState(false);

    const handleCleanup = async () => {
        setIsLoading(true);
        try {
            const result = await cleanupGhostUsers(testMode);

            if (result.count > 0) {
                toast.success(`Nettoyage ${result.mode} terminé !`, {
                    description: `${result.count} comptes fantômes supprimés avec succès.`,
                    icon: <Sparkles className="w-5 h-5 text-emerald-400" />
                });
            } else {
                toast.info(`Rien à nettoyer (${result.mode}).`, {
                    description: `La base de données est déjà propre (aucun compte fantôme > ${testMode ? "2 mins" : "24h"}).`,
                });
            }

        } catch (error) {
            toast.error("Erreur lors du nettoyage.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOrphanCleanup = async () => {
        setIsOrphanLoading(true);
        try {
            const result = await cleanupOrphanedProfiles();
            if (result.success) {
                toast.success("Nettoyage des orphelins terminé", {
                    description: result.message,
                    icon: <UserMinus className="w-5 h-5 text-indigo-400" />
                });
            }
        } catch (error) {
            toast.error("Erreur lors du nettoyage des orphelins.");
        } finally {
            setIsOrphanLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        Zone de Maintenance
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                        Outils de nettoyage et d'hygiène de la base.
                    </p>
                </div>
            </div>

            {/* Ghost Users Janitor */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Comptes Fantômes</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTestMode(!testMode)}
                        className={`h-7 text-[10px] uppercase font-bold px-2 ${testMode ? "border-amber-500/50 text-amber-500 bg-amber-950/20" : "text-zinc-500 border-zinc-800"}`}
                    >
                        {testMode ? "Test (2m)" : "Prod (24h)"}
                    </Button>
                </div>
                <Button
                    variant="destructive"
                    onClick={handleCleanup}
                    disabled={isLoading}
                    className="w-full bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 text-red-200 h-10 text-xs"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                            Purge des fantômes...
                        </>
                    ) : (
                        `Purger les Fantômes (${testMode ? "TEST" : "PROD"})`
                    )}
                </Button>
            </div>

            {/* Orphan Profiles Janitor */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/50">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Profils Orphelins</span>
                <Button
                    variant="outline"
                    onClick={handleOrphanCleanup}
                    disabled={isOrphanLoading}
                    className="w-full border-indigo-900/50 hover:bg-indigo-900/20 text-indigo-300 h-10 text-xs"
                >
                    {isOrphanLoading ? (
                        <>
                            <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                            Nettoyage technique...
                        </>
                    ) : (
                        "Supprimer les Profils sans Utilisateur"
                    )}
                </Button>
                <p className="text-[10px] text-zinc-500 italic text-center">
                    Utile si des profils existent sans compte Discord lié (bugs ou suppression manuelle).
                </p>
            </div>
        </div>
    );
}
