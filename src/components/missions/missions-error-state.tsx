"use client";

import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface MissionsErrorStateProps {
    error: string;
}

export function MissionsErrorState({ error }: MissionsErrorStateProps) {
    return (
        <div className="py-12">
            <EmptyState
                icon={ScrollText}
                title="Oups ! Erreur de chargement"
                description={`Nous n'avons pas pu récupérer les missions de cette semaine : ${error}`}
                variant="premium"
                action={{
                    label: "Réessayer",
                    onClick: () => window.location.reload()
                }}
            />
        </div>
    );
}
