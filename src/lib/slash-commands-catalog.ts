// ⚡ Catalogue des commandes Slash SigilOS — fichier de constantes PURES (pas de "use server")
// Importable côté client ET côté serveur.

export interface SlashCommandDefinition {
    name: string;
    description: string;
    usage: string;
    category: "DONJONS_QUETES" | "COMMUNAUTE" | "PROFIL" | "UTILITAIRE" | "STAFF";
    defaultRoles: ("MEMBER" | "OFFICER" | "LEADER")[];
    /**
     * Commande réservée au staff : masquée du guide membres (`/commandes`),
     * gate `staff:member_mgmt` côté route en plus de la matrice RBAC par guilde.
     */
    staffOnly?: boolean;
}

/**
 * Réglages dashboard de `/valider-recrue` : rôles Discord appliqués par défaut
 * (sauf choix explicite dans la commande). Snowflakes uniquement, jamais de noms.
 */
export interface ValiderRecrueConfig {
    addRoleId: string | null;
    removeRoleId: string | null;
}

const SNOWFLAKE_PATTERN = /^\d{5,25}$/;

function cleanRoleId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const v = value.trim();
    return SNOWFLAKE_PATTERN.test(v) ? v : null;
}

/** Parse fail-closed de la config dashboard (JSONB) : tout ce qui est douteux devient null. */
export function parseValiderRecrueConfig(raw: unknown): ValiderRecrueConfig {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { addRoleId: null, removeRoleId: null };
    }
    return {
        addRoleId: cleanRoleId((raw as Record<string, unknown>).addRoleId),
        removeRoleId: cleanRoleId((raw as Record<string, unknown>).removeRoleId),
    };
}

export const SLASH_COMMANDS_CATALOG: SlashCommandDefinition[] = [
    {
        name: "almanax",
        description: "Affiche l'offrande, le bonus Almanax du jour demandé et les kamas",
        usage: "/almanax [date]",
        category: "UTILITAIRE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "profil",
        description: "Affiche la fiche membre : classe, succès, métiers 200, activités et planning",
        usage: "/profil [@membre]",
        category: "PROFIL",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "boss",
        description: "Consulte la fiche d'un boss de donjon : PV, résistances élémentaires, sorts et tactique",
        usage: "/boss <nom>",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "monstre",
        description: "Recherche un monstre ou archimonstre : caractéristiques, zone, drops et stats",
        usage: "/monstre <nom>",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "metiers",
        description: "Trouve qui a tel métier dans la guilde, avec les niveaux",
        usage: "/metiers <metier>",
        category: "COMMUNAUTE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "ocre",
        description: "Assistant quête Ocre : zone d'apparition d'un archimonstre",
        usage: "/ocre <archimonstre>",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "valider-recrue",
        description: "Staff — complète la ligne registre d'une recrue (pseudo Dofus, tag Ankama, recruteur, arrivée)",
        usage: "/valider-recrue @membre [pseudo-dofus] [tag-ankama] [recruteur] [arrivee] [ajouter-role] [retirer-role]",
        category: "STAFF",
        defaultRoles: ["OFFICER", "LEADER"],
        staffOnly: true
    }
];

