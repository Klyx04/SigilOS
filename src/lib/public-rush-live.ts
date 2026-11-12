/**
 * Rush Live des visiteurs (V2c) — **règles pures, aucune I/O**.
 *
 * Une seule room par **serveur Dofus** (`public:rush:live:<serverId>`), jamais par guilde :
 * l'espace visiteur n'a pas de `guildId` (D-V1) et le serveur est **résolu depuis le profil**,
 * jamais reçu du client.
 *
 * Ce que ce module ferme :
 *  · **aucun texte libre** : un événement ne transporte qu'un identifiant de bloc, un titre
 *    **résolu côté serveur** (`GuideMilestone.title`) et le pseudo déjà public du profil ;
 *  · **bornes explicites** : 10 blocs nouveaux par enregistrement, 100 événements en room,
 *    20 par trame, 50 présents — au-delà on **coupe**, on n'invente rien ;
 *  · **consentement** : `showPresence` gouverne le fait d'**être vu** (présence et validations).
 *    Il ne gouverne pas le fait de **recevoir** : un visiteur masqué voit les autres.
 */

import { z } from "zod";

/** Préfixe des clés Redis — une room par serveur, jamais par guilde. */
export const PUBLIC_RUSH_LIVE_KEY_PREFIX = "public:rush:live";

/** Combien d'événements une room garde (liste Redis plafonnée). */
export const PUBLIC_RUSH_LIVE_MAX_EVENTS = 100;
/** Combien d'événements tiennent dans une trame SSE. */
export const PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS = 20;
/** Combien de présents un instantané accepte. */
export const PUBLIC_RUSH_LIVE_MAX_MEMBERS = 50;
/** Durée de vie d'une room sans activité. */
export const PUBLIC_RUSH_LIVE_EVENT_TTL_SECONDS = 600;
/** Un présent qui n'a pas reçu de battement depuis 45 s n'est plus « en ligne ». */
export const PUBLIC_RUSH_LIVE_PRESENCE_TTL_SECONDS = 45;
/** Battement de présence : une écriture Redis toutes les 20 s par connexion. */
export const PUBLIC_RUSH_LIVE_PRESENCE_REFRESH_MS = 20_000;
/** Cadence de lecture de la room (événements). */
export const PUBLIC_RUSH_LIVE_POLL_MS = 2_000;
/** Cadence d'envoi de l'instantané de présence. */
export const PUBLIC_RUSH_LIVE_PRESENCE_POLL_MS = 10_000;
/** Durée de vie d'un flux : le navigateur se reconnecte, la présence est réévaluée. */
export const PUBLIC_RUSH_LIVE_STREAM_LIFETIME_MS = 3 * 60 * 1000;
/** Un enregistrement de progression ne peut publier que quelques blocs. */
export const PUBLIC_RUSH_LIVE_MAX_NEW_EVENTS = 10;

export const PUBLIC_RUSH_LIVE_PSEUDO_MAX = 40;
export const PUBLIC_RUSH_LIVE_TITLE_MAX = 120;
const MILESTONE_ID_MAX = 64;

/** Un événement affichable : nature, bloc, titre (serveur), pseudo (profil). */
export const publicRushLiveEventSchema = z.object({
    id: z.number().int().positive(),
    kind: z.enum(["bloc", "dofus"]),
    milestoneId: z.string().min(1).max(MILESTONE_ID_MAX),
    title: z.string().min(1).max(PUBLIC_RUSH_LIVE_TITLE_MAX),
    pseudo: z.string().min(1).max(PUBLIC_RUSH_LIVE_PSEUDO_MAX),
});

export type PublicRushLiveEvent = z.infer<typeof publicRushLiveEventSchema>;

/** Un présent : pseudo public + classe (id, jamais un libellé inventé). */
export const publicRushLiveMemberSchema = z.object({
    pseudo: z.string().min(1).max(PUBLIC_RUSH_LIVE_PSEUDO_MAX),
    classe: z.string().max(PUBLIC_RUSH_LIVE_PSEUDO_MAX).nullable(),
});

export type PublicRushLiveMember = z.infer<typeof publicRushLiveMemberSchema>;

/** Trames serveur → client. `unavailable` est un **état**, jamais un « 0 en ligne ». */
export const publicRushLiveFrameSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("presence"),
        status: z.enum(["live", "unavailable"]),
        members: z.array(publicRushLiveMemberSchema).max(PUBLIC_RUSH_LIVE_MAX_MEMBERS).default([]),
    }),
    z.object({
        type: z.literal("events"),
        events: z.array(publicRushLiveEventSchema).max(PUBLIC_RUSH_LIVE_MAX_FRAME_EVENTS),
    }),
]);

export type PublicRushLiveFrame = z.infer<typeof publicRushLiveFrameSchema>;


/**
 * Clé de room. Un **entier** de serveur : une valeur absente ou douteuse lève, elle ne
 * fabrique jamais une room « par défaut » où tout le monde se retrouverait.
 */
export function publicRushLiveRoom(serverId: number): string {
    if (!Number.isInteger(serverId) || serverId <= 0) {
        throw new Error("Serveur invalide pour le Rush Live.");
    }
    return `${PUBLIC_RUSH_LIVE_KEY_PREFIX}:${serverId}`;
}

/** Les quatre clés d'une room, dérivées d'une seule source. */
export function publicRushLiveKeys(serverId: number) {
    const room = publicRushLiveRoom(serverId);
    return {
        room,
        events: `${room}:events`,
        presence: `${room}:presence`,
        presenceMeta: `${room}:presence:meta`,
        sequence: `${PUBLIC_RUSH_LIVE_KEY_PREFIX}:seq`,
    };
}

/**
 * Nature d'un événement. Seuls les blocs `DOFUS` / `DOFUS_OBTAINED` annoncent un Dofus ;
 * tout le reste est un bloc validé — on ne devine pas au libellé.
 */
export function publicRushLiveKind(type: string): "dofus" | "bloc" {
    return type === "DOFUS" || type === "DOFUS_OBTAINED" ? "dofus" : "bloc";
}

/** Pseudo affichable : celui du profil, sinon un mot neutre — jamais un identifiant. */
export function publicRushLivePseudo(pseudo: string | null | undefined): string {
    const trimmed = (pseudo ?? "").trim();
    return trimmed.length > 0 ? trimmed.slice(0, PUBLIC_RUSH_LIVE_PSEUDO_MAX) : "Visiteur";
}

/**
 * Diff de progression : ce qui vient d'être coché, dans l'ordre reçu, sans doublon et borné.
 * L'ordre est celui du guide — deux coches dans la même passe publient deux événements
 * dans l'ordre de la progression, pas dans un ordre arbitraire.
 */
export function newMilestoneIds(previous: readonly string[], next: readonly string[]): string[] {
    const seen = new Set(previous);
    const out: string[] = [];
    for (const id of next) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= PUBLIC_RUSH_LIVE_MAX_NEW_EVENTS) break;
    }
    return out;
}

/** Trame reçue du serveur → objet typé, ou `null`. Le client ne fait jamais confiance au fil. */
export function parsePublicRushLiveFrame(raw: unknown): PublicRushLiveFrame | null {
    const parsed = publicRushLiveFrameSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}
