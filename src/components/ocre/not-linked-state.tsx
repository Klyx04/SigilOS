"use client";

import { Link2, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface NotLinkedStateProps {
    guildId: string;
    error?: string;
}

export function NotLinkedState({ guildId, error }: NotLinkedStateProps) {
    const isNotLinked = error?.includes("Aucun compte Metamob") || error?.includes("Profil Metamob non lié.");

    return (
        <div className="max-w-2xl mx-auto py-12">
            <EmptyState
                icon={isNotLinked ? Link2 : AlertCircle}
                title={isNotLinked ? "Liez votre compte Metamob" : "Erreur de chargement"}
                description={isNotLinked
                    ? "Pour accéder à la Quête Ocre, vous devez lier votre compte Metamob à votre profil SigilOS dans l'onglet \"Général\"."
                    : (error || "Impossible de charger vos données Metamob. Réessayez plus tard.")
                }
                variant="premium"
                action={{
                    label: isNotLinked ? "Aller à mon profil" : "Retour au profil",
                    onClick: () => window.location.href = `/dashboard/${guildId}/profile`
                }}
            />
        </div>
    );
}
