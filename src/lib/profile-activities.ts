/** Tags « Activités & Contenu préféré » — source de vérité partagée.
 * Utilisé par le profil (presentation-card) ET l'onboarding forcé (onboarding-wizard)
 * pour garantir la cohérence des valeurs possibles. */

/** Liste stricte des ids acceptés (tuple `as const` pour la validation Zod côté serveur). */
export const PREFERRED_ACTIVITY_IDS = [
    "pvm",
    "succes",
    "rush_sylvestre",
    "songes",
    "fm",
    "quetes",
    "pvp",
    "metiers",
] as const;

export type PreferredActivityId = (typeof PREFERRED_ACTIVITY_IDS)[number];

export const PREFERRED_ACTIVITIES: { id: PreferredActivityId; label: string; icon: string; color: string; image: string }[] = [
    { id: "pvm", label: "PvM & Donjons", icon: "⚔️", color: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300", image: "/assets/dofus/game-icons/crossed-swords.png" },
    { id: "succes", label: "Succès", icon: "🏆", color: "bg-amber-500/15 border-amber-500/40 text-amber-300", image: "/assets/dofus/modules/success.png" },
    { id: "rush_sylvestre", label: "Rush Sylvestre", icon: "🌲", color: "bg-teal-500/15 border-teal-500/40 text-teal-300", image: "/assets/dofus/game-icons/dofus.png" },
    { id: "songes", label: "Songes Infinis", icon: "🔮", color: "bg-purple-500/15 border-purple-500/40 text-purple-300", image: "/assets/dofus/modules/breach.png" },
    { id: "fm", label: "Forgemagie", icon: "🔨", color: "bg-orange-500/15 border-orange-500/40 text-orange-300", image: "/assets/dofus/game-icons/hammer.png" },
    { id: "quetes", label: "Quêtes & Dofus", icon: "📖", color: "bg-sky-500/15 border-sky-500/40 text-sky-300", image: "/assets/dofus/modules/quest.png" },
    { id: "pvp", label: "PvP & Koli", icon: "🛡️", color: "bg-rose-500/15 border-rose-500/40 text-rose-300", image: "/assets/dofus/modules/kolizeum.png" },
    { id: "metiers", label: "Craft & Métiers", icon: "🎒", color: "bg-yellow-500/15 border-yellow-500/40 text-yellow-300", image: "/assets/dofus/game-icons/recipe.png" },
];

