"use client";

import { ModuleHelpActions } from "@/components/doc/module-help-actions";

/**
 * Bouton d'aide unifié (Documentation + Tutoriel) pour le profil personnel.
 */
export function ProfileTourReplayButton({ className }: { className?: string }) {
    return (
        <ModuleHelpActions
            docSlug="introduction"
            docTitle="Profil & Synchronisation"
            tourPhase="profile"
            className={className}
        />
    );
}
