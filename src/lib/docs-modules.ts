/**
 * Documentation — organisation « par module » (source unique, pure).
 *
 * La vérité documentaire vit en base (`DocPage`, éditée via /god/docs).
 * Ce module ne fait que **ranger** les fiches : ordre canonique des
 * catégories, groupement pur, et lien slug → route dashboard du module.
 * Importable côté client comme côté serveur (aucun import prisma/auth).
 */

import { MODULE_GROUPS, moduleLabel } from "@/lib/module-catalog";

/** Ordre canonique d'affichage des catégories (hub, God, sidebar). */
export const DOC_CATEGORY_ORDER = [
    "Progression & Objectifs",
    "Outils & Services",
    "Communauté & Guilde",
    "Administration & Staff",
    "Spécifications Techniques",
] as const;

export type DocScope = "user" | "staff";

export interface ModuleRoute {
    label: string;
    href: string;
}

/** Slug de fiche → route dashboard du module documenté (sans le préfixe `/dashboard/[guildId]`). */
export const MODULE_ROUTES: Record<string, ModuleRoute> = {
    // Guides membres
    "introduction":                    { label: "Accueil Dashboard",           href: "/home" },
    "missions":                        { label: "Missions de Guilde",          href: "/missions" },
    "quete-ocre":                      { label: "Quête Ocre",                  href: "/quete-ocre" },
    "ladder":                          { label: "Ladder de Guilde",            href: "/ladder" },
    "succes":                          { label: "Succès & Donjons",            href: "/succes" },
    "quetes-dofus":                    { label: "Les Quêtes Dofus",            href: "/quetes-dofus" },
    "donjons-et-quetes":               { label: "Donjons & Quêtes (LFG)",      href: "/donjons-et-quetes" },
    "songes":                          { label: "Songes Infinis",              href: "/songes" },
    "galerie-stuff":                   { label: "Galerie de Stuff",            href: "/galerie-stuff" },
    "services":                        { label: "Services de Guilde",          href: "/services" },
    "planning":                        { label: "Planning & Disponibilités",   href: "/planning" },
    "members":                         { label: "Annuaire de Guilde",          href: "/members" },
    "calendar":                        { label: "Calendrier des Sorties",      href: "/calendar" },
    "sondages":                        { label: "Sondages Communautaires",     href: "/sondages" },
    "worldmap":                        { label: "Carte du Monde HD",           href: "/worldmap" },
    "mini-jeux":                       { label: "Mini-Jeux Dofus",             href: "/mini-jeux" },
    "ressources":                      { label: "Ressources Dofus",            href: "/ressources" },

    // Administration & Staff
    "admin-getting-started":           { label: "Centre de Contrôle Admin",   href: "/admin" },
    "admin-settings":                  { label: "Paramètres Généraux",         href: "/admin/settings" },
    "admin-permissions":               { label: "Rôles & Permissions",         href: "/admin/permissions" },
    "admin-modules":                   { label: "Gestion des Modules",         href: "/admin/modules" },
    "admin-reaction-roles":            { label: "Reaction Roles Discord",      href: "/admin/reaction-roles" },
    "admin-tickets":                   { label: "Bot Tickets & Support",       href: "/admin/tickets" },
    "admin-presentation":              { label: "Identité & Vitrine Publique", href: "/admin/presentation" },
    "admin-missions":                  { label: "Gestion des Missions",        href: "/missions/manage" },
    "admin-validation":                { label: "File de Validation OCR",      href: "/admin/validation" },
    "admin-members":                   { label: "Audit Roster Discord",        href: "/admin/members" },
    "module-recrutement-cycle-de-vie": { label: "Recrutement & Cycle de Vie", href: "/admin/members" },
    "admin-points":                    { label: "Points & Économie Guilde",    href: "/admin/points" },
    "admin-logs":                      { label: "Logs d'Audit Staff",          href: "/admin/logs" },
    "admin-api-keys":                  { label: "Clés d'API Rest",             href: "/admin/api-keys" },
};

export function getModuleRoute(slug: string): ModuleRoute | null {
    return MODULE_ROUTES[slug] ?? null;
}

export interface DocListItem {
    id: string;
    slug: string;
    title: string;
    category: string;
    order: number;
    isPublished: boolean;
    accessLevel: string;
    guildId?: string | null;
}

/**
 * Range les fiches par catégorie dans l'ordre canonique.
 * Les catégories inconnues passent après, par ordre alphabétique.
 * À l'intérieur d'un groupe : `order` puis titre.
 */
export function groupDocsByCategory<T extends DocListItem>(docs: T[]): { category: string; docs: T[] }[] {
    const byCategory = new Map<string, T[]>();
    for (const doc of docs) {
        const cat = doc.category || "Autres";
        const list = byCategory.get(cat);
        if (list) list.push(doc);
        else byCategory.set(cat, [doc]);
    }
    const rank = (cat: string): number => {
        const i = (DOC_CATEGORY_ORDER as readonly string[]).indexOf(cat);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...byCategory.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "fr"))
        .map(([category, list]) => ({
            category,
            docs: [...list].sort((x, y) => x.order - y.order || x.title.localeCompare(y.title, "fr")),
        }));
}

/** Portée d'une fiche : "staff" pour tout ce qui est Administration, "user" sinon. */
export function docScopeOf(doc: Pick<DocListItem, "category" | "accessLevel">): DocScope {
    if (doc.accessLevel === "ADMIN" || doc.category === "Administration & Staff") return "staff";
    return "user";
}

// ============================================================================
// Couverture « un module = une fiche » (membre et staff).
// Chaque clé de MODULE_GROUPS a son entrée : fiche membre et/ou staff (slugs),
// ou `exempt` avec la raison (mécanisme technique sans page dédiée).
// ============================================================================

export interface ModuleDocCoverage {
    /** Slug de la fiche membre (scope user). */
    member?: string;
    /** Slug de la fiche staff (scope staff). */
    staff?: string;
    /** Raison d'exemption (aucune fiche attendue). */
    exempt?: string;
}

export const MODULE_DOC_COVERAGE: Record<string, ModuleDocCoverage> = {
    // Général
    presentation: { member: "presentation", staff: "admin-presentation" },
    roster: { member: "members", staff: "admin-members" },
    stats: { member: "stats" },
    calendar: { member: "calendar", staff: "admin-calendar" },
    availability: { member: "disponibilites" },
    commandes: { member: "commandes", staff: "admin-commandes" },
    // Fonctionnalités
    missions: { member: "missions", staff: "admin-missions" },
    songes: { member: "songes", staff: "admin-songes" },
    ocre: { member: "quete-ocre" },
    ladder: { member: "ladder" },
    succes: { member: "succes" },
    gallery: { member: "galerie-stuff" },
    ladderSync: { exempt: "mécanisme technique (worker), couvert par la fiche ladder" },
    manualLadderSync: { exempt: "mécanisme technique (OCR), couvert par la fiche ladder" },
    // Outils
    services: { member: "services" },
    marche: { member: "marche", staff: "admin-marche" },
    donjons: { member: "donjons-et-quetes" },
    docs: { member: "documentation" },
    polls: { member: "sondages" },
    minigames: { member: "mini-jeux" },
    quests: { member: "quetes-dofus" },
    worldmap: { member: "worldmap" },
    resources: { member: "ressources" },
    profile: { member: "profil" },
    // Administration (staff uniquement)
    reactionRoles: { staff: "admin-reaction-roles" },
    tickets: { staff: "admin-tickets" },
    logs: { staff: "admin-logs" },
};

/** Groupe catalogue (Général, Fonctionnalités, Outils, Administration) d'une clé de module. */
export function moduleGroupOf(moduleKey: string): string | null {
    for (const group of MODULE_GROUPS) {
        if (group.modules.some((m) => m.key === moduleKey)) return group.label;
    }
    return null;
}

/** Catégorie documentaire d'un groupe catalogue (les fiches staff vont toujours en Administration). */
export function docCategoryForModule(moduleKey: string, scope: "member" | "staff"): string {
    if (scope === "staff") return "Administration & Staff";
    const group = moduleGroupOf(moduleKey);
    if (group === "Fonctionnalités") return "Progression & Objectifs";
    if (group === "Outils") return "Outils & Services";
    return "Communauté & Guilde";
}

export interface MissingModuleDoc {
    moduleKey: string;
    scope: "member" | "staff";
    slug: string;
    title: string;
    category: string;
    accessLevel: "MEMBER" | "ADMIN";
}

/**
 * Pages de couverture manquantes : slugs du contrat absents de la base.
 * Pur : la création (serveur) rejoue exactement cette liste.
 */
export function missingModuleDocSlugs(existingSlugs: (string | null | undefined)[]): MissingModuleDoc[] {
    const known = new Set(existingSlugs.filter((s): s is string => !!s));
    const missing: MissingModuleDoc[] = [];
    for (const [moduleKey, coverage] of Object.entries(MODULE_DOC_COVERAGE)) {
        const label = moduleLabel(moduleKey);
        if (coverage.member && !known.has(coverage.member)) {
            missing.push({
                moduleKey,
                scope: "member",
                slug: coverage.member,
                title: label,
                category: docCategoryForModule(moduleKey, "member"),
                accessLevel: "MEMBER",
            });
        }
        if (coverage.staff && !known.has(coverage.staff)) {
            missing.push({
                moduleKey,
                scope: "staff",
                slug: coverage.staff,
                title: `${label} — Réglages`,
                category: "Administration & Staff",
                accessLevel: "ADMIN",
            });
        }
    }
    return missing;
}

/** Contenu d'amorçage d'une page de couverture manquante (vide assumée, jamais de faux contenu). */
export function missingDocStarterContent(title: string, moduleLabelName: string, scope: "member" | "staff"): string {
    return `<h2>${title}</h2>
<p>Documentation en cours de rédaction. Cette page accueillera le guide ${scope === "staff" ? "des réglages" : "pas-à-pas"} du module ${moduleLabelName}.</p>

<div class="callout callout-info">
<strong>En attendant</strong>
<p>Ouvrez le module depuis le tableau de bord — et si un point bloque, demandez à un officier de la guilde.</p>
</div>`;
}
