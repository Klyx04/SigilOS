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
 * Vignettes du jeu pour chaque activité (assets déjà dans `public/assets`,
 * jamais d'URL écrite à la main — passer par cette table).
 */
export const ACTIVITY_ASSETS: Record<string, string> = {
    economie: "/assets/dofus/modules/kamas.png",
    pvm: "/assets/dofus/icons/crossedSwords.png",
    roleplay: "/assets/dofus/modules/social.png",
    kolizeum: "/assets/dofus/modules/kolizeum.png",
    percepteur: "/assets/dofus/modules/chest.png",
    raids: "/assets/dofus/icons/boss.png",
};

/** Couronne du meneur dans l'état-major (asset du jeu). */
export const FOUNDER_CROWN_ASSET = "/assets/dofus/icons/crown.png";

/** Parchemin du manifeste (asset du jeu). */
export const MANIFESTO_ASSET = "/assets/dofus/icons/parchment.png";

/** Blason de guilde pour les en-têtes recrutement / état-major. */
export const GUILD_BLASON_ASSET = "/assets/dofus/icons/guild.png";

/**
 * Segment d'URL de guilde **publiable dans le sitemap**.
 *
 * `getGuildSlug` retire les accents et la ponctuation, mais la résolution publique
 * (`buildGuildLookupConditions` dans `presentation-actions.ts`) compare le nom **tel quel**
 * (insensible à la casse, mais PAS aux accents ni à la ponctuation). Publier un slug qui ne
 * « revient pas » sur le nom tel qu'il est stocké produirait une **404** (pire qu'une
 * redirection) — c'est le cas de « Étoile du Nord » → `etoile-du-nord`.
 *
 * On ne publie donc le slug que s'il revient exactement sur le nom (nom déjà sans accent et
 * sans ponctuation perdue) ; sinon on retombe sur `discordGuildId`, qui **résout toujours**
 * (au prix d'une redirection 307 vers le slug). Correctif de fond : une colonne `slug`
 * persistée et unique sur `GuildConfig` (migration) — hors périmètre ici.
 */
export function getIndexableGuildSegment(guild: { name?: string | null; discordGuildId?: string | null }): string {
    const slug = getGuildSlug(guild);
    const name = (guild.name ?? "").trim();
    if (slug && name) {
        const deaccented = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const roundTrip = slug.replace(/-/g, " ").toLowerCase();
        if (deaccented === name && roundTrip === name.toLowerCase()) return slug;
    }
    return guild.discordGuildId || slug;
}

/**
 * Construit un slug d'URL propre pour une guilde.
 * - Normalise les accents via NFD (é→e, ô→o, ç→c…)
 * - Remplace les espaces/caractères spéciaux par des tirets
 * - Repli automatique sur discordGuildId si le nom est indisponible
 * Exemples : "Étoile du Nord" → "etoile-du-nord", "Stellium" → "stellium"
 */
export function getGuildSlug(guild: { name?: string | null; discordGuildId?: string | null }): string {
    if (guild.name && guild.name.trim().length > 0) {
        const slug = guild.name
            .trim()
            .toLowerCase()
            // Normalise les caractères accentués (NFD décompose, puis on retire les diacritiques)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Remplace les espaces et underscores par des tirets
            .replace(/[\s_]+/g, '-')
            // Supprime les caractères non alphanumériques sauf tirets
            .replace(/[^a-z0-9-]/g, '')
            // Évite les tirets multiples consécutifs
            .replace(/-{2,}/g, '-')
            // Supprime les tirets en début/fin
            .replace(/^-+|-+$/g, '');
        // Si le slug est vide après nettoyage (ex: nom tout en caractères asiatiques), repli sur l'ID
        return slug.length > 0 ? slug : (guild.discordGuildId || '');
    }
    return guild.discordGuildId || '';
}
