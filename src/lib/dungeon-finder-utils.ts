/**
 * Utilitaires pour le Dungeon Finder (normalisation multi-donjons, titres, sous-titres, images)
 * #26 — Mode multi-donjons
 */

import { achievementEmojiName } from "@/lib/discord-emoji-catalog";

/** Icône **réelle** de quête (asset Dofus du dépôt) — repli quand la quête n'a pas de carte connue. */
export const QUEST_ICON_FALLBACK = "/assets/dofus/icons/quests.png";

/**
 * `mapId` de la position de départ d'une quête DofusDB (`startPosition[].mapId`) — `null` si la
 * source n'en donne pas (jamais de carte inventée).
 *
 * 📏 Mesure du 27/09/2026 (250 quêtes, 271 entrées) : `startPosition` est **toujours** un
 * **tableau** d'objets `{ mapId, npcId }` (parfois dupliqué à l'identique) — jamais un objet seul.
 */
export function questStartMapId(startPosition: unknown): number | null {
    const first = Array.isArray(startPosition) ? startPosition[0] : null;
    const mapId = Math.floor(Number((first as { mapId?: unknown } | null)?.mapId) || 0);
    return mapId > 0 ? mapId : null;
}

/**
 * Chemin **interne** de la carte du jeu pour un `mapId` Dofus (`/game-data/hd_maps/{id}.webp` —
 * le même jeu de tuiles que la worldmap, versionné dans `public/`) — `null` si l'id n'est pas
 * exploitable. C'est **la** source unique du chemin : `questThumbnail` (affichage) et les siphons
 * (écriture en base) passent tous les deux par ici.
 *
 * 📏 Mesure du 27/09/2026 : sur 133 `mapId` de départ de quêtes distincts, **133/133** sont
 * présents dans le cache local ⇒ la carte de départ est un vrai asset disponible, pas un espoir.
 */
export function questMapImageUrl(mapId: unknown): string | null {
    const id = Math.floor(Number(mapId) || 0);
    return Number.isSafeInteger(id) && id > 0 ? `/game-data/hd_maps/${id}.webp` : null;
}

/**
 * Miniature **réelle** d'une quête : image explicite si la base en porte une, sinon la **carte de
 * départ** de la quête (`startPosition[].mapId` → `/game-data/hd_maps/{id}.webp`, asset du jeu),
 * sinon l'**icône de quête Dofus**.
 *
 * 🐛 Constat user du 27/09/2026 : « liste quête : supprimer les numéros et vrai asset quête Dofus
 * par quête ». La liste affichait `#606` (l'id technique) sans aucune image.
 * Mesure en base (locale) : `GameQuest.imageUrl` **0/1 976** et `DofusQuestEntry.mapId` **0/433**.
 * ⚠️ `GameQuest` **ne stocke pas** `startPosition` : une quête servie par la base locale n'a donc
 * de carte que si le siphon l'a **écrite** dans `imageUrl` (fait le 27/09/2026 — `quest-siphon` et
 * l'import God la dérivent de `startPosition`). Sans carte : icône de quête.
 *
 * 🛡️ Garde de forme : seul un chemin **interne** (`/…`) est publié dans le `<img>` — une valeur
 * brute venue de la base ne part jamais telle quelle dans le DOM (même leçon que les images d'avis).
 */
export function questThumbnail(
    quest: { imageUrl?: string | null; startPosition?: unknown } | null | undefined
): string {
    const image = typeof quest?.imageUrl === "string" ? quest.imageUrl.trim() : "";
    if (image.startsWith("/") && !image.startsWith("//")) return image;
    return questMapImageUrl(questStartMapId(quest?.startPosition)) ?? QUEST_ICON_FALLBACK;
}

export interface MultiDungeonItem {
    dungeonId: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl: string | null;
    wantedAchievementIds?: string[];
    achievements?: { id: string; name: string; iconUrl: string | null }[];
    message?: string | null;
    targetDate?: Date | string | null;
    maxMembers?: number;
    /** #26 — classes recherchées **de ce donjon** (absent = post créé avant la fonctionnalité). */
    requiredClasses?: string[];
}

/**
 * Normalise la liste des donjons d'un post multi-donjons (#26).
 * Supporte :
 * - Tableau direct : [...]
 * - Objet enveloppé (sauvegarde rappels Discord / inactivité) : { _items: [...], _autoReminderCount: ... }
 * - Chaîne JSON sérialisée
 */
export function getMultiDungeons(dungeonsJson: unknown): MultiDungeonItem[] {
    if (!dungeonsJson) return [];
    if (Array.isArray(dungeonsJson)) return dungeonsJson as MultiDungeonItem[];
    if (typeof dungeonsJson === "object" && dungeonsJson !== null) {
        if (Array.isArray((dungeonsJson as any)._items)) return (dungeonsJson as any)._items as MultiDungeonItem[];
        if (Array.isArray((dungeonsJson as any).items)) return (dungeonsJson as any).items as MultiDungeonItem[];
        if (Array.isArray((dungeonsJson as any).posts)) return (dungeonsJson as any).posts as MultiDungeonItem[];
    }
    if (typeof dungeonsJson === "string") {
        try {
            const parsed = JSON.parse(dungeonsJson);
            return getMultiDungeons(parsed);
        } catch {
            return [];
        }
    }
    return [];
}

/** Participant minimal lu par les stats de donjon (carte, modale, filtre). */
export interface DjStatParticipant {
    status: string;
    /** #26 — index du donjon rejoint ; `null` = inscrit « global » (post simple, ou inscrit avant #26). */
    dungeonIndex?: number | null;
}

/**
 * Statistiques d'**un** groupe : places, roster et file d'attente.
 * `index = -1` ⇒ post simple (un seul groupe, pas de `dungeonsJson`).
 */
export interface DjDungeonStats<P extends DjStatParticipant = DjStatParticipant> {
    index: number;
    dungeon: MultiDungeonItem | null;
    maxMembers: number;
    accepted: P[];
    pending: P[];
    /** Inscrits **+ créateur** : le créateur compte dans chaque donjon (règle #203). */
    acceptedCount: number;
    spotsLeft: number;
    isFull: boolean;
}

/**
 * **La** règle de comptage des places d'un post DJ — valable pour un post simple
 * comme pour un post multi-donjons (#26).
 *
 * Chantier #203 : chaque donjon d'une session a **sa** taille de groupe
 * (`dungeonsJson[i].maxMembers`) et **ses** inscrits. La même règle est appliquée :
 *  - par l'embed Discord (`buildMultiPostEmbeds`) et les boutons qui portent l'index ;
 *  - par la capacité serveur (`internalJoinDjPost`, `acceptDjParticipant`) ;
 *  - par l'interface du site (carte, modale, filtre « places dispos »).
 *
 * Avant cette fonction, le calcul était **dupliqué** et divergent : la carte et la
 * modale affichaient un ratio **global** (`1/4 — 3 dispos`) sur un post de 5 donjons,
 * alors que Discord affichait 1/4 **par donjon** — constat du 16/10/2026.
 *
 * Un inscrit `dungeonIndex == null` (créé par le site avant la reprise, ou post simple)
 * est compté dans **chaque** donjon : c'est la tolérance historique de #203, jamais un
 * doublon silencieux (il reste visible dans « Sans donjon » côté interface).
 */
export function getDjDungeonStats<P extends DjStatParticipant>(
    post: { dungeonsJson?: unknown; maxMembers: number; participants?: P[] | null }
): DjDungeonStats<P>[] {
    const participants = post.participants ?? [];
    const entries = getMultiDungeons(post.dungeonsJson);

    const build = (index: number, dungeon: MultiDungeonItem | null, maxMembers: number): DjDungeonStats<P> => {
        const belongs = (p: P) => index < 0 || p.dungeonIndex === index || p.dungeonIndex == null;
        const accepted = participants.filter((p) => p.status === "ACCEPTED" && belongs(p));
        const pending = participants.filter((p) => p.status === "PENDING" && belongs(p));
        const acceptedCount = accepted.length + 1; // +1 créateur
        const size = maxMembers > 0 ? maxMembers : 1;
        return {
            index,
            dungeon,
            maxMembers: size,
            accepted,
            pending,
            acceptedCount,
            spotsLeft: Math.max(0, size - acceptedCount),
            isFull: acceptedCount >= size,
        };
    };

    // Post simple : un seul groupe, borné par `post.maxMembers`.
    if (entries.length === 0) return [build(-1, null, post.maxMembers)];

    return entries.map((entry, index) => build(index, entry, entry.maxMembers ?? post.maxMembers));
}

/** Synthèse affichable des places d'un post (jamais un ratio global trompeur). */
export interface DjDungeonsSummary {
    total: number;
    full: number;
    /** Somme des places restantes sur tous les groupes. */
    openSpots: number;
    minSpots: number;
    maxSpots: number;
    allFull: boolean;
    /** Libellé court, prêt à afficher (carte, en-tête de modale). */
    label: string;
    perDungeon: {
        index: number;
        name: string;
        acceptedCount: number;
        maxMembers: number;
        spotsLeft: number;
        isFull: boolean;
    }[];
}

/** Résume `getDjDungeonStats` en un libellé + des nombres (une seule formulation pour l'UI). */
export function summarizeDjDungeons(stats: DjDungeonStats<any>[]): DjDungeonsSummary {
    if (stats.length === 0) {
        return { total: 0, full: 0, openSpots: 0, minSpots: 0, maxSpots: 0, allFull: false, label: "", perDungeon: [] };
    }
    const spots = stats.map((s) => s.spotsLeft);
    const minSpots = Math.min(...spots);
    const maxSpots = Math.max(...spots);
    const full = stats.filter((s) => s.isFull).length;
    const openSpots = spots.reduce((acc, n) => acc + n, 0);
    const allFull = full === stats.length;
    const plural = (n: number) => (n > 1 ? "s" : "");

    let label: string;
    if (stats.length === 1) {
        // Post simple : le ratio exact du groupe, comme avant (aucun changement de wording).
        label = `${stats[0].acceptedCount}/${stats[0].maxMembers}`;
    } else if (allFull) {
        label = "Complet partout";
    } else if (minSpots === maxSpots) {
        label = `${minSpots} place${plural(minSpots)} sur ${stats.length} donjons`;
    } else {
        label = `${minSpots} à ${maxSpots} places selon le donjon`;
    }

    return {
        total: stats.length,
        full,
        openSpots,
        minSpots,
        maxSpots,
        allFull,
        label,
        perDungeon: stats.map((s) => ({
            index: s.index,
            name: s.dungeon?.name ?? "",
            acceptedCount: s.acceptedCount,
            maxMembers: s.maxMembers,
            spotsLeft: s.spotsLeft,
            isFull: s.isFull,
        })),
    };
}

/**
 * URL d'illustration d'un embed Discord.
 *
 * Un embed ne charge une image que depuis une URL **https absolue** : un chemin relatif
 * (`/game-data/dungeons/x.webp`) ou du http (localhost en dev) est ignoré SILENCIEUSEMENT
 * par Discord — l'embed s'affiche alors sans illustration, sans aucune erreur de notre
 * côté. On résout donc le chemin relatif contre l'origine publique du site et on rend
 * `null` quand Discord ne pourrait pas la charger.
 *
 * @param imageUrl Chemin d'asset local ou URL absolue (`dungeon.imageUrl`, `titan.imageUrl`…).
 * @param appUrl   Origine publique du site (`getAppBaseUrl()`).
 */
export function embedCoverUrl(imageUrl: string | null | undefined, appUrl: string): string | null {
    if (!imageUrl) return null;
    const raw = /^https?:\/\//i.test(imageUrl)
        ? imageUrl
        : `${appUrl.replace(/\/+$/, "")}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    return raw.startsWith("https://") ? raw : null;
}

/**
 * Une ligne par succès visé d'un embed Discord : le **picto du succès** (le même asset
 * que la modale du site) quand l'application Discord le porte, sinon la puce historique.
 *
 * Une seule implémentation pour le post simple ET le post multi-donjons : deux copies
 * divergeraient au premier succès ajouté.
 *
 * @param emo Résolveur d'emojis (`loadEmojiResolver()`), rend `•` tant que la synchro
 *            n'a pas été jouée — l'embed reste alors exactement comme avant.
 */
export function achievementLines(
    achievements: { name: string; iconUrl?: string | null }[],
    emo: (name: string) => string
): string {
    return achievements
        .map((achievement) => {
            const key = achievementEmojiName(achievement.iconUrl);
            const picto = key ? emo(key) : "";
            return picto ? `${picto} ${achievement.name}` : `• ${achievement.name}`;
        })
        .join("\n");
}

/**
 * Calcule le titre d'affichage pour un post DJ (simple ou multi-donjons).
 */
export function getDjPostTitle(post: {
    mode?: string | null;
    dungeon?: { name?: string | null } | null;
    dungeonsJson?: unknown;
    defiName?: string | null;
    titanName?: string | null;
    questName?: string | null;
}): string {
    const multi = getMultiDungeons(post.dungeonsJson);
    if (multi.length > 0) {
        if (multi.length <= 2) {
            return multi.map(d => d.name || "Donjon").join(" + ");
        }
        return `Multi-donjons (${multi.length})`;
    }
    if (post.mode === "DONJON") {
        return post.dungeon?.name || "Donjon";
    }
    if (post.mode === "DEFI") return post.defiName || "Défi";
    if (post.mode === "TITAN") return post.titanName || "Titan";
    return post.questName || "Quête";
}

/**
 * Calcule le sous-titre d'affichage (ex: niveau, boss, etc.).
 */
export function getDjPostSubtitle(post: {
    mode?: string | null;
    dungeon?: { bossName?: string | null; level?: number | null } | null;
    dungeonsJson?: unknown;
    defiName?: string | null;
    titanName?: string | null;
}): string {
    const multi = getMultiDungeons(post.dungeonsJson);
    if (multi.length > 0) {
        const levels = multi
            .map(d => d.level)
            .filter((lvl): lvl is number => typeof lvl === "number" && !isNaN(lvl));
        if (levels.length > 0) {
            const minLvl = Math.min(...levels);
            const maxLvl = Math.max(...levels);
            const lvlText = minLvl === maxLvl ? `Niv. ${minLvl}` : `Niv. ${minLvl} à ${maxLvl}`;
            return `${lvlText} · ${multi.length} donjons`;
        }
        return `Session de ${multi.length} donjons`;
    }
    if (post.mode === "DONJON") {
        const boss = post.dungeon?.bossName;
        const lvl = post.dungeon?.level;
        if (boss && lvl != null) return `Niv. ${lvl} — ${boss}`;
        if (lvl != null) return `Niv. ${lvl}`;
        if (boss) return boss;
        return "Donjon";
    }
    if (post.mode === "DEFI") return post.defiName || "Événement Défi";
    if (post.mode === "TITAN") return post.titanName || "Mode Titan";
    return "Mode Quête";
}

/* ------------------------------------------------------------------------- */
/* Date & heure prévues — OPTIONNELLES sur un post Donjons & Quêtes           */
/* ------------------------------------------------------------------------- */

/**
 * La date est optionnelle, et l'heure aussi (« Sans heure » dans le sélecteur,
 * qui pose alors minuit). Afficher « 00:00 » dans ce cas serait un mensonge
 * (personne ne lance un donjon à minuit pile) : on affiche la **date seule**.
 *
 * Le calcul est fait en **heure civile Europe/Paris**, pour le serveur (embed
 * Discord) ET le navigateur (carte dashboard) : sans ça les deux vues
 * divergeaient (le serveur en UTC voyait 22:00 → « heure fixée », la carte
 * voyait 00:00 → « date seule »). C'est aussi le référentiel que Discord
 * affiche aux membres français.
 */
const DJ_DATE_TZ = "Europe/Paris";

export type DjDateParts = {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    /** Vrai si une heure a été fixée (≠ 00:00) ; « Sans heure » → false. */
    explicitTime: boolean;
};

/** Découpe une date de post DJ en heure civile Paris, ou null si non exploitable. */
export function getDjDateParts(value: Date | string | null | undefined): DjDateParts | null {
    if (value == null || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;

    const parts = new Intl.DateTimeFormat("fr-CA", {
        timeZone: DJ_DATE_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(d);
    const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);

    const year = num("year");
    const month = num("month");
    const day = num("day");
    // `hour12: false` peut rendre « 24 » pour minuit selon l'ICU → on ramène à 0.
    const hours = num("hour") % 24;
    const minutes = num("minute");
    if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return null;

    return { year, month, day, hours, minutes, explicitTime: hours !== 0 || minutes !== 0 };
}

/** Une heure a-t-elle été fixée ? (faux pour une date posée à minuit → « date seule ») */
export function hasExplicitTime(value: Date | string | null | undefined): boolean {
    return getDjDateParts(value)?.explicitTime ?? false;
}

/**
 * Libellé français unique des cartes et écrans du finder :
 * « dimanche 20 septembre 2026 à 18:00 », ou « dimanche 20 septembre 2026 »
 * quand aucune heure n'a été fixée. `null` si la date est absente/invalide.
 */
export function formatDjDateLabel(
    value: Date | string | null | undefined,
    opts: { shortWeekday?: boolean; shortMonth?: boolean } = {}
): string | null {
    const parts = getDjDateParts(value);
    if (!parts) return null;
    const d = value instanceof Date ? value : new Date(value as string);
    const datePart = new Intl.DateTimeFormat("fr-FR", {
        timeZone: DJ_DATE_TZ,
        weekday: opts.shortWeekday ? "short" : "long",
        day: "numeric",
        month: opts.shortMonth ? "short" : "long",
        year: "numeric",
    }).format(d);
    if (!parts.explicitTime) return datePart;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${datePart} à ${pad(parts.hours)}:${pad(parts.minutes)}`;
}

/**
 * Timestamp Discord : `<t:ts:F>` (date + heure) quand une heure est fixée,
 * `<t:ts:D>` (date seule) sinon. `null` si la date est absente/invalide.
 */
export function formatDiscordDateStamp(value: Date | string | null | undefined): string | null {
    if (value == null || value === "") return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const ts = Math.floor(d.getTime() / 1000);
    return hasExplicitTime(d) ? `<t:${ts}:F>` : `<t:${ts}:D>`;
}

/**
 * Applique de NOUVELLES dates prévues aux donjons d'un post multi (#26).
 *
 * `dungeonsJson` n'est pas toujours un tableau : les rappels Discord inactifs y
 * ajoutent une enveloppe (`{ _items: [...], _autoReminderCount: n }`). On
 * conserve donc l'enveloppe et on ne remplace QUE `targetDate`, pour ne pas
 * écraser le compteur de rappels (régression connue).
 */
export function mergeMultiDungeonTargetDates(
    existing: unknown,
    updates: { targetDate?: Date | string | null }[] | null | undefined
): unknown {
    const items = getMultiDungeons(existing);
    if (items.length === 0) return existing;

    const next = items.map((item, index) => {
        const provided = updates?.[index];
        // `undefined` = donjon non touché ; `null` = date retirée explicitement.
        if (!provided || provided.targetDate === undefined) return item;
        return { ...item, targetDate: provided.targetDate ?? null };
    });

    if (Array.isArray(existing)) return next;
    if (existing && typeof existing === "object" && Array.isArray((existing as any)._items)) {
        return { ...(existing as any), _items: next };
    }
    return next;
}

/**
 * Applique de NOUVELLES **classes recherchées** aux donjons d'un post multi (#26).
 *
 * Même contrat que `mergeMultiDungeonTargetDates` : l'enveloppe `{ _items, _autoReminderCount }`
 * est conservée et un donjon non fourni (`undefined`) n'est **jamais** touché. Une liste **vide**
 * est un choix explicite (« aucune classe demandée »), pas un « ne touche pas ».
 */
export function mergeMultiDungeonRequiredClasses(
    existing: unknown,
    updates: (string[] | null | undefined)[] | null | undefined
): unknown {
    const items = getMultiDungeons(existing);
    if (items.length === 0) return existing;

    const next = items.map((item, index) => {
        const provided = updates?.[index];
        if (provided === undefined || provided === null) return item;
        return { ...item, requiredClasses: provided };
    });

    if (Array.isArray(existing)) return next;
    if (existing && typeof existing === "object" && Array.isArray((existing as any)._items)) {
        return { ...(existing as any), _items: next };
    }
    return next;
}

/**
 * Identifiants des **messages Discord par donjon** d'un post multi (#26), lus dans
 * l'enveloppe `dungeonsJson` (`{ _items: [...], _messageIds: [...] }`).
 *
 * Pourquoi une enveloppe et pas une colonne : le format « un message par donjon » doit
 * pouvoir être **adopté sans migration** — `mergeMultiDungeonTargetDates` et les rappels
 * d'inactivité se servent déjà de cette enveloppe, la clé est donc additive et tolérée.
 * `[]` = post encore au format historique (un seul message, N embeds).
 */
export function getMultiMessageIds(dungeonsJson: unknown): string[] {
    if (!dungeonsJson || typeof dungeonsJson !== "object" || Array.isArray(dungeonsJson)) return [];
    const ids = (dungeonsJson as { _messageIds?: unknown })._messageIds;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Réécrit l'enveloppe avec les identifiants de messages (`_items` normalisés, autres
 * clés — `_autoReminderCount` — **préservées**). Jamais de perte de données : c'est la
 * même règle que `mergeMultiDungeonTargetDates`.
 */
export function withMultiMessageIds(dungeonsJson: unknown, ids: string[]): {
    _items: MultiDungeonItem[];
    _messageIds: string[];
    [key: string]: unknown;
} {
    const env = dungeonsJson && typeof dungeonsJson === "object" && !Array.isArray(dungeonsJson)
        ? { ...(dungeonsJson as Record<string, unknown>) }
        : {};
    return { ...env, _items: getMultiDungeons(dungeonsJson), _messageIds: ids };
}

