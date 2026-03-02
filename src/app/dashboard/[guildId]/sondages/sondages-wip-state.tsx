"use client";

import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface SondagesWIPStateProps {
    guildId: string;
}

export function SondagesWIPState({ guildId }: SondagesWIPStateProps) {
    return (
        <div className="py-12 px-6">
            <EmptyState
                icon={Activity}
                title="Module en construction"
                description="Ce module permettra bientôt aux officiers de créer des sondages et aux membres de voter directement sur SigilOS."
                variant="premium"
                action={{
                    label: "Retour au Dashboard",
                    onClick: () => window.location.href = `/dashboard/${guildId}`
                }}
            />
        </div>
    );
}
