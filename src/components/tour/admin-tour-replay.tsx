"use client";

import { TourPhase } from "./tour-provider";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

/**
 * Bouton admin unifié Documentation + Tutoriel.
 * Délègue à ModuleHelpActions pour garder un design cohérent avec les modules guilde.
 * Le mapping phase → slug de doc est géré dans module-tour-replay-button.tsx.
 */

const ADMIN_PHASE_TO_DOC: Record<string, { slug: string; title: string }> = {
    admin:             { slug: "admin-getting-started",  title: "Guide de Démarrage Admin" },
    adminOverview:     { slug: "admin-getting-started",  title: "Guide de Démarrage Admin" },
    adminSettings:     { slug: "admin-settings",         title: "Paramètres Généraux" },
    adminPermissions:  { slug: "admin-permissions",      title: "Rôles & Permissions" },
    adminModules:      { slug: "admin-modules",          title: "Gestion des Modules" },
    adminModulesMgmt:  { slug: "admin-modules",          title: "Gestion des Modules" },
    adminMembers:      { slug: "admin-members",          title: "Audit & Membres" },
    adminMissions:     { slug: "admin-missions",         title: "Gestion des Missions" },
    adminValidation:   { slug: "admin-validation",       title: "File de Validation" },
    adminPoints:       { slug: "admin-points",           title: "Points de Contribution" },
    adminLogs:         { slug: "admin-logs",             title: "Logs d'Audit" },
    adminApiKeys:      { slug: "admin-api-keys",         title: "Clés d'API" },
    adminRecruitment:  { slug: "module-recrutement-cycle-de-vie", title: "Recrutement & Cycle de Vie" },
    adminPresentation: { slug: "admin-presentation",    title: "Identité & Présentation" },
    tickets:           { slug: "admin-tickets",         title: "Bot Tickets" },
    reactionRoles:     { slug: "admin-reaction-roles",  title: "Reaction Roles" },
};

export function AdminTourReplay({ phase, className }: { phase: TourPhase; className?: string }) {
    const docInfo = phase ? ADMIN_PHASE_TO_DOC[phase] : null;

    return (
        <ModuleHelpActions
            docSlug={docInfo?.slug}
            docTitle={docInfo?.title}
            tourPhase={phase}
            className={className}
        />
    );
}