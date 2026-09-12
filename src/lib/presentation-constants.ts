// ============================================================================
// DOFUS UNITY SERVER LIST (Official servers only - no Retro, no Touch)
// ============================================================================

export const DOFUS_UNITY_SERVERS = {
    epique: [
        { name: "Ombre", id: 50 }
    ],
    monocompte: [
        { name: "Draconiros", id: 295 }
    ],
    classique: [
        { name: "Tal Kasha", id: 290 },
        { name: "Imagiro", id: 291 },
        { name: "Orukam", id: 292 },
        { name: "Tylezia", id: 293 },
        { name: "Hell Mina", id: 294 }
    ],
    pionnierMono: [
        { name: "Dakal", id: 353 },
        { name: "Mikhal", id: 354 },
        { name: "Kourial", id: 355 }
    ],
    pionnier: [
        { name: "Rafal", id: 350 },
        { name: "Brial", id: 351 },
        { name: "Salar", id: 352 }
    ],
} as const;

export const ALL_DOFUS_SERVERS = [
    ...DOFUS_UNITY_SERVERS.epique.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.monocompte.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.classique.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.pionnierMono.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.pionnier.map(s => s.name),
];

/**
 * Résout un nom de serveur Dofus affichable à l'utilisateur :
 * 1) dofusServerName configuré par la guilde (ex: "Draconiros")
 * 2) sinon, résolution par dofusServerId via la liste officielle
 * 3) sinon, libellé générique (rare — admin n'a pas configuré le serveur)
 */
export function resolveDofusServerName(name?: string | null, id?: string | null): string {
    if (name && name.trim()) return name.trim();
    if (id) {
        for (const group of Object.values(DOFUS_UNITY_SERVERS)) {
            const server = (group as ReadonlyArray<{ name: string; id: number }>).find(s => String(s.id) === String(id));
            if (server) return server.name;
        }
    }
    return "le serveur configuré par la guilde";
}

// ============================================================================
// AVAILABLE ACTIVITIES
// ============================================================================

export const AVAILABLE_ACTIVITIES = [
    { id: "economie", label: "Économie", subtitle: "Artisanat, Récolte, Commerce, Élevage" },
    { id: "pvm", label: "PVM", subtitle: "Donjons, Quêtes, Succès, Farm" },
    { id: "roleplay", label: "Roleplay", subtitle: "" },
    { id: "kolizeum", label: "Kolizéum", subtitle: "" },
    { id: "percepteur", label: "Percepteur", subtitle: "" },
    { id: "raids", label: "Raids de Guilde", subtitle: "Dungeons, Gigalodon, Sanctuaire" },
] as const;

/**
 * Construit un slug d'URL propre pour une guilde (ex: "Stellium" -> "stellium").
 * Repli automatique sur discordGuildId si le nom est indisponible.
 */
export function getGuildSlug(guild: { name?: string | null; discordGuildId?: string | null }): string {
    if (guild.name && guild.name.trim().length > 0) {
        return encodeURIComponent(guild.name.trim().toLowerCase().replace(/\s+/g, '-'));
    }
    return guild.discordGuildId || '';
}
