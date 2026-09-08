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
        description: "Affiche l'offrande, le bonus Almanax du jour demandé et les kamas",
        usage: "/almanax [date]",
        category: "UTILITAIRE",
        defaultRoles: ["MEMBER", "OFFICER", "LEADER"]
    },
    {
        name: "profil",
        description: "Affiche la fiche membre : avatar, classe, niveau et lien vers son profil",
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
    }
];

