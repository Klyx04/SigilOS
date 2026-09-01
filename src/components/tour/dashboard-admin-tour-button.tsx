"use client";

import { ModuleHelpActions } from "@/components/doc/module-help-actions";

/**
 * Bouton d'aide unifié Documentation + Tutoriel affiché sur le Dashboard.
 * Rejoue le tour des modules (dashboardBricks) et ouvre la doc de prise en main.
 */
export function DashboardAdminTourButton({ isAdmin, className }: { isAdmin?: boolean; className?: string }) {
    return (
        <ModuleHelpActions
            docSlug="introduction"
            docTitle="Prise en main du Dashboard"
            tourPhase="dashboardBricks"
            className={className}
        />
    );
}

