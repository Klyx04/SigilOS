"use client";

import { TourPhase } from "./tour-provider";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

/**
 * Table de correspondance entre la phase du tour interactif
 * et le slug de la documentation officielle associée.
 */
const TOUR_PHASE_TO_DOC_SLUG: Record<string, { slug: string; title: string }> = {
    calendar:          { slug: "calendar",                          title: "Calendrier des Sorties" },
    donjons:           { slug: "donjons-et-quetes",                 title: "Donjons & Quêtes (LFG)" },
    galerie:           { slug: "galerie-stuff",                     title: "Galerie de Stuff" },
    ladder:            { slug: "ladder",                            title: "Ladder de Guilde" },
    minijeu:           { slug: "mini-jeux",                         title: "Mini-Jeux Dofus" },
    annuaire:          { slug: "members",                           title: "Annuaire de Guilde" },
    missions:          { slug: "missions",                          title: "Missions & Défis" },
    presentation:      { slug: "admin-presentation",                title: "Identité & Présentation" },
    ocre:              { slug: "quete-ocre",                        title: "Quête Ocre" },
    quetesDofus:       { slug: "quetes-dofus",                      title: "Les Quêtes Dofus" },
    ressources:        { slug: "ressources",                        title: "Ressources Dofus" },
    services:          { slug: "services",                          title: "Services de Guilde" },
    sondages:          { slug: "sondages",                          title: "Sondages Communautaires" },
    songes:            { slug: "songes",                            title: "Songes Infinis" },
    stats:             { slug: "introduction",                      title: "Statistiques de Guilde" },
    succes:            { slug: "succes",                            title: "Succès Donjons" },
    guide:             { slug: "quetes-dofus",                      title: "Les Quêtes Dofus" },
    admin:             { slug: "admin-getting-started",             title: "Panneau Admin" },
    adminOverview:     { slug: "admin-getting-started",             title: "Panneau Admin" },
    adminMembers:      { slug: "admin-members",                     title: "Audit & Membres" },
    adminSettings:     { slug: "admin-settings",                    title: "Paramètres Généraux" },
    adminPermissions:  { slug: "admin-permissions",                 title: "Rôles & Permissions" },
    adminModules:      { slug: "admin-modules",                     title: "Gestion des Modules" },
    adminModulesMgmt:  { slug: "admin-modules",                     title: "Gestion des Modules" },
    adminMissions:     { slug: "admin-missions",                    title: "Gestion des Missions" },
    adminValidation:   { slug: "admin-validation",                  title: "File de Validation" },
    adminPoints:       { slug: "admin-points",                      title: "Points de Contribution" },
    adminLogs:         { slug: "admin-logs",                        title: "Logs d'Audit" },
    adminApiKeys:      { slug: "admin-api-keys",                    title: "Clés d'API" },
    adminRecruitment:  { slug: "module-recrutement-cycle-de-vie",  title: "Recrutement & Cycle de Vie" },
    adminPresentation: { slug: "admin-presentation",                title: "Identité de Guilde" },
    tickets:           { slug: "admin-tickets",                     title: "Bot Tickets" },
    reactionRoles:     { slug: "admin-reaction-roles",              title: "Reaction Roles" },
    dashboardBricks:   { slug: "introduction",                      title: "Accueil & Dashboard" },
    profile:           { slug: "introduction",                      title: "Profil & Personnage" },
    docs:              { slug: "introduction",                      title: "Centre Documentaire" },
};

/**
 * Bouton d'aide modulaire unifié :
 * - Affiche [ 📖 Documentation ] (ouvre le slide-over de doc épinglée sur le côté)
 * - Affiche [ ❓ Tutoriel ] (lance le tour interactif du module)
 * Design professionnel, épuré, dark-glass, zéro AI-slop.
 */
export function ModuleTourReplayButton({ phase, className }: { phase: TourPhase; className?: string }) {
    const docInfo = phase ? TOUR_PHASE_TO_DOC_SLUG[phase] : null;

    return (
        <ModuleHelpActions
            docSlug={docInfo?.slug}
            docTitle={docInfo?.title}
            tourPhase={phase}
            className={className}
        />
    );
}
