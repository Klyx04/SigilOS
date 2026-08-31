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
        name: "stats",
        description: "Récapitulatif des succès collectifs, présences et activité de la guilde",
        usage: "/stats",
        category: "COMMUNAUTE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    }
];
