/**
 * Lot 2 — session live de raid : constantes + règles PURES (testées sans base).
 *
 * Le chrono est SERVEUR (`startedAt`/`endsAt` en base) : l'overlay ne fait
 * qu'afficher le restant. Les objectifs portent les points théoriques du
 * siphon guides (Mureine 1 000, Exécrabe 5 000, Willorque 10 000, paliers
 * 5k/7k/10k) : cocher = compteur de score, sans lire le coffre en jeu.
 */

/** Fenêtre de lancement du combat final (chrono jeu : 60 min). */
export const RAID_LIVE_DURATION_MS = 60 * 60 * 1000;

/**
 * Canal Redis d'une session live : `raid-live:<eventId>`.
 *
 * ⚠️ Règle **pure** et **non exportable depuis un module `"use server"`** : Next
 * refuse catégoriquement tout export synchrone d'un fichier `"use server"`
 * (« Server Actions must be async functions » — build cassé). Elle vit donc ici,
 * à côté des autres règles du lot : les server actions **publient** dessus et le
 * pont WebSocket s'y **abonne** (`src/server/websocket/raid-live.ts`,
 * `psubscribe "raid-live:*"`) — une seule définition du préfixe.
 */
export function raidLiveChannel(eventId: string): string {
    return `raid-live:${eventId}`;
}

export interface RaidLiveObjective {
    id: string;
    label: string;
    /** Points théoriques au coffre (0 = jalon sans points). */
    points: number;
    done: boolean;
}

/** Objectifs fermés du Gigalodon (siphon guides corrélé, lot 1). */
export function defaultGigalodonObjectives(): RaidLiveObjective[] {
    const items: Array<[string, string, number]> = [
        ["farm-moins-1", "Étage -1 : 18 groupes nettoyés", 0],
        ["mureine", "Mureine vaincue (relique +1 000)", 1000],
        ["luminarium", "Luminarium résolu (-3)", 0],
        ["execrabe", "Exécrabe vaincu (relique +5 000)", 5000],
        ["statues", "Statues sous le lac (ordre exact)", 0],
        ["raccourci", "Raccourci pince ouvert [6,10]", 0],
        ["depot-10k", "Dépôt coffre ≥ 10 000 pts (drop 20 %)", 10000],
        ["fragment-4", "Fragment 4 (Krak'Haine -5)", 0],
        ["willorque", "Willorque vaincu (relique +10 000)", 10000],
        ["depot-final", "Dépôt final avant Gigalodon", 0],
        ["gigalodon", "Gigalodon lancé (burst 3 tours)", 15000],
    ];
    return items.map(([id, label, points]) => ({ id, label, points, done: false }));
}

/**
 * Objectifs par type de raid. Jardin : dérivés des titres d'étapes (points
 * inconnus = 0, jamais inventés) — à chiffrer quand le siphon suivra.
 */
export function defaultObjectivesForRaid(raidType: string, stepTitles: string[] = []): RaidLiveObjective[] {
    if (raidType === "gigalodon") return defaultGigalodonObjectives();
    return stepTitles.slice(0, 16).map((title, i) => ({
        id: `etape-${i + 1}`,
        label: String(title).slice(0, 120),
        points: 0,
        done: false,
    }));
}

/** Score théorique = somme des points des objectifs cochés. */
export function liveScoreOf(objectives: RaidLiveObjective[]): number {
    return objectives.reduce((sum, o) => sum + (o.done ? Math.max(0, Math.floor(Number(o.points) || 0)) : 0), 0);
}

export type RaidLiveAlertLevel = "ok" | "warn15" | "warn30" | "alert45" | "ended";

/**
 * Palier d'alerte du chrono (temps ÉCOULÉ) : 15/30 ambre, 45 rouge, 60 fin.
 * `nowMs` injectable (tests).
 */
export function liveAlertLevel(startedAtMs: number, nowMs: number = Date.now()): RaidLiveAlertLevel {
    const elapsed = nowMs - startedAtMs;
    if (elapsed >= RAID_LIVE_DURATION_MS) return "ended";
    if (elapsed >= 45 * 60 * 1000) return "alert45";
    if (elapsed >= 30 * 60 * 1000) return "warn30";
    if (elapsed >= 15 * 60 * 1000) return "warn15";
    return "ok";
}

/** `mm:ss` restants (jamais négatif). */
export function formatLiveRemaining(endsAtMs: number, nowMs: number = Date.now()): string {
    const ms = Math.max(0, endsAtMs - nowMs);
    const totalS = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalS / 60)).padStart(2, "0");
    const ss = String(totalS % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

/** Garde d'objectif : forme valide venue de base (fail-closed). */
export function isValidObjective(o: unknown): o is RaidLiveObjective {
    if (typeof o !== "object" || o === null) return false;
    const r = o as Record<string, unknown>;
    return (
        typeof r.id === "string" && r.id.length > 0 && r.id.length <= 64 &&
        typeof r.label === "string" && r.label.length > 0 && r.label.length <= 160 &&
        Number.isFinite(Number(r.points)) &&
        typeof r.done === "boolean"
    );
}
