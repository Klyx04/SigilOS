export const siteConfig = {
    name: "SigilOS",
    version: "v2.5.0",
    betaMode: true, // Set to false to hide "Private Beta" badge

    // Copywriting (FR)
    hero: {
        badge: "v2.5 : L'Ère de la Singularité",
        title: "L'OS Ultime pour",
        titleSuffix: "Guildes d'Élite",
        subtitle: "Dominez votre serveur avec une interface forgée pour la performance. Pensée pour les Songes, taillée pour l'ordre, conçue pour l'élite.",
        cta: "Initialiser le Protocole",
        secondaryCta: "Documentation",
        loginNote: "⚠️ Accès restreint aux guildes partenaires (Whitelist).",
    },

    features: {
        title: "Arsenal Numérique",
        subtitle: "Une suite d'outils interconnectés pour une gestion sans faille.",
        items: [
            {
                id: "songes",
                title: "Gestion des Songes",
                description: "Planification des runs, tracking des étages et répartition automatique du butin.",
                status: "Live"
            },
            {
                id: "missions",
                title: "Objectifs & Quêtes",
                description: "Suivi en temps réel de l'avancement de la guilde sur les objectifs majeurs (Ocre, events).",
                status: "Beta"
            },
            {
                id: "directory",
                title: "Annuaire Tactique",
                description: "Profils détaillés des membres, classes, métiers et disponibilités.",
                status: "Live"
            },
            {
                id: "security",
                title: "Clearance Level 5",
                description: "Système de permissions RBAC granulaire basé sur les rôles Discord.",
                status: "Secure"
            }
        ]
    },

    links: {
        discord: "https://discord.gg/stellium",
        github: "https://github.com/stellium",
        docs: "/docs"
    }
} as const;
