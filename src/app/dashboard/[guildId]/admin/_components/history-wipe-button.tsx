"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { wipeUserProfile } from "@/server/actions/lifecycle-actions";
import { toast } from "sonner";

interface HistoryWipeButtonProps {
    profileId: string;
    guildId: string;
    nickname: string;
}

export function HistoryWipeButton({ profileId, guildId, nickname }: HistoryWipeButtonProps) {
    const [isWiping, setIsWiping] = useState(false);

    const handleWipe = async () => {
        if (!confirm(`Es-tu sûr de vouloir nettoyer définitivement les données de ${nickname} ? Cette action est irréversible.`)) {
            return;
        }

        setIsWiping(true);
        try {
            const res = await wipeUserProfile(profileId, guildId);
            if (res.success) {
                toast.success("Profil nettoyé avec succès");
            } else {
                toast.error(res.error || "Erreur lors du nettoyage");
            }
        } catch (e) {
            toast.error("Erreur réseau");
        } finally {
            setIsWiping(false);
        }
    };

    return (
        <button
            onClick={handleWipe}
            disabled={isWiping}
            className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-all group"
            title="Nettoyer les données (Wipe RGPD)"
        >
            {isWiping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Trash2 className="w-4 h-4" />
            )}
        </button>
    );
}
