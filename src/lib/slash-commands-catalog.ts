// ⚡ Catalogue des commandes Slash SigilOS — fichier de constantes PURES (pas de "use server")
// Importable côté client ET côté serveur.

export interface SlashCommandDefinition {
    name: string;
    description: string;
    usage: string;
    category: "DONJONS_QUETES" | "COMMUNAUTE" | "PROFIL" | "UTILITAIRE";
    defaultRoles: ("MEMBER" | "OFFICER" | "LEADER")[];
}

export const SLASH_COMMANDS_CATALOG: SlashCommandDefinition[] = [
    {
        name: "almanax",
        description: "Affiche l'offrande, le bonus Almanax du jour et les prévisions de la semaine",
        usage: "/almanax [date]",
        category: "UTILITAIRE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "dofus",
        description: "Consulte le guide, les prérequis et l'avancement d'un Dofus spécifique",
        usage: "/dofus <nom_du_dofus>",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "profil",
        description: "Affiche la fiche joueur Dofus, le rang de guilde, les badges et trophées",
        usage: "/profil [@membre]",
        category: "PROFIL",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "sorties",
        description: "Liste les sorties donjons, songes et quêtes ouvertes actuellement dans la guilde",
        usage: "/sorties [type]",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "defi",
        description: "Affiche le défi double boss en cours, les bonus de points et les participants",
        usage: "/defi",
        category: "DONJONS_QUETES",
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
        name: "stats",
        description: "Récapitulatif des succès collectifs, présences et activité de la guilde",
        usage: "/stats",
        category: "COMMUNAUTE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "artisan",
        description: "Trouve les artisans et forgemages disponibles dans la guilde selon le métier choisi",
        usage: "/artisan <metier>",
        category: "COMMUNAUTE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "ocre",
        description: "Assistant quête Ocre : zone d'apparition et statut des doublons/recherches en guilde",
        usage: "/ocre <archimonstre>",
        category: "DONJONS_QUETES",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "ladder",
        description: "Classement et podium des meilleurs membres de la guilde",
        usage: "/ladder [categorie]",
        category: "COMMUNAUTE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    }
];

