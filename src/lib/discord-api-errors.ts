/**
 * Erreurs d'écriture Discord : classification (retry vs définitif) + alerte God
 * actionnable. Pur (aucune I/O) → testable unitairement.
 *
 * ── Contexte (#223 P3.1) ─────────────────────────────────────────────────────
 * Avec `DISCORD_OUTBOX_ENABLED=true`, les écritures Discord passent par la file
 * BullMQ `discord-outbox` (8 tentatives, backoff exponentiel 5 s → ~10 min).
 * Alerte reçue (18/09) :
 *   « Discord Outbox : écriture abandonnée — L'écriture Discord <sha256>
 *     (postMessage) a échoué définitivement après 8 tentatives : Discord a refusé
 *     la demande » — avec pour seuls indices `jobId` (hash du payload), `kind` et
 *     `attempts` : impossible de savoir QUEL salon, QUELLE fonctionnalité et
 *     POURQUOI (statut masqué).
 *
 * Deux défauts corrigés ici :
 * 1. DIAGNOSTIC — `postChannelMessage` perdait le statut HTTP (F-15 interdit
 *    d'exposer le corps brut Discord). Le statut + le `code` Discord sont
 *    désormais portés par l'erreur (`DiscordApiError`) puis affichés dans
 *    l'alerte avec le `channelId`.
 * 2. RETRY INUTILE — un refus PERMANENT (4xx hors 429 : 400 corps invalide,
 *    401 token invalide, 403 permissions, 404 salon supprimé) était retenté
 *    8 fois ≈ 10 min et ~24 requêtes HTTP avant l'alerte, sans aucune chance de
 *    succès. Il devient « unrecoverable » (BullMQ ne retente pas) → alerte
 *    IMMÉDIATE, pendant que le contexte est encore frais.
 *
 * Seuls 429 (rate limit) et 5xx/réseau restent retentables : ce sont des pannes
 * passagères, exactement le cas d'usage de l'outbox.
 */

/** Statuts HTTP Discord dont un rejeu ne peut PAS changer l'issue. */
export function isPermanentDiscordHttpStatus(status: number): boolean {
    return Number.isFinite(status) && status >= 400 && status < 500 && status !== 429;
}

/**
 * Erreur d'écriture Discord portant le statut HTTP et le `code` d'erreur Discord
 * (jamais le corps brut — exigence F-15). Jetée par `postChannelMessage`.
 */
export class DiscordApiError extends Error {
    readonly status: number;
    readonly discordCode?: number;

    constructor(message: string, status: number, discordCode?: number) {
        super(message);
        this.name = "DiscordApiError";
        this.status = status;
        this.discordCode = discordCode;
    }
}

/**
 * Refus PERMANENT d'une écriture outbox (4xx hors 429) : le worker ne doit plus
 * retenter. `name` volontairement fixé à `"UnrecoverableError"` : BullMQ
 * (`Job.shouldRetryJob`) teste `err instanceof UnrecoverableError || err.name ==
 * "UnrecoverableError"` — double sécurité même si le worker est mal câblé.
 */
export class PermanentDiscordWriteError extends Error {
    readonly status?: number;
    readonly discordCode?: number;
    readonly channelId?: string;

    constructor(message: string, opts: { status?: number; discordCode?: number; channelId?: string } = {}) {
        super(message);
        this.name = "UnrecoverableError";
        this.status = opts.status;
        this.discordCode = opts.discordCode;
        this.channelId = opts.channelId;
    }
}

/** Statut HTTP porté par une erreur (0 si inconnu). */
export function getDiscordApiStatus(error: unknown): number {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === "number" && Number.isFinite(status) ? status : 0;
}

/** `code` d'erreur Discord porté par une erreur (undefined si inconnu). */
export function getDiscordApiCode(error: unknown): number | undefined {
    const code = (error as { discordCode?: unknown } | null)?.discordCode;
    return typeof code === "number" && Number.isFinite(code) ? code : undefined;
}

/**
 * `true` si l'écriture ne doit PAS être retentée : erreur HTTP permanente
 * (4xx hors 429) ou erreur déjà marquée définitive.
 */
export function isPermanentDiscordWriteFailure(error: unknown): boolean {
    if (error instanceof PermanentDiscordWriteError) return true;
    if ((error as { name?: unknown } | null)?.name === "UnrecoverableError") return true;
    return isPermanentDiscordHttpStatus(getDiscordApiStatus(error));
}

/** Motif lisible « · HTTP 400 · code 50035 » (vide si non renseigné). */
export function describeDiscordRefusal(error: unknown): string {
    const status = getDiscordApiStatus(error);
    const code = getDiscordApiCode(error);
    if (!status && code === undefined) return "";
    return `${status ? ` · HTTP ${status}` : ""}${code !== undefined ? ` · code ${code}` : ""}`;
}

/**
 * Niveau de log d'un échec **d'appel Discord**.
 *
 * Mesure du 18/10/2026 : la couche réseau (`src/server/discord.ts`) journalisait 43 sites en
 * « erreur », dont 27 `console.error` ⇒ `captureConsoleIntegration({ levels: ["error"] })`
 * transformait chaque refus Discord (403 permissions, 404 salon supprimé, 429 rate-limit) en
 * **Issue Sentry**. Ce n'est pas un défaut du produit : c'est de l'**exploitation**.
 *
 * Règle (fail-loud par défaut) :
 *  · HTTP **401** → `error` (token invalide/reset : configuration cassée, on veut le voir) ;
 *  · tout autre statut HTTP (4xx/5xx) → `warn` (permissions, salon supprimé, rate-limit, panne Discord) ;
 *  · erreur **réseau** connue (ETIMEDOUT, ENETUNREACH, ECONNRESET, fetch failed…) → `warn` ;
 *  · tout le reste (bug inconnu, valeur illisible) → `error` : on ne fait taire que du connu.
 */
export type DiscordFailureLevel = "warn" | "error";

/** Codes/ motifs réseau reconnus comme « amont indisponible », jamais un bug produit. */
const DISCORD_NETWORK_CODE_RE = /^(EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|ENOTFOUND|ETIMEDOUT|EPIPE|EHOSTUNREACH|UND_ERR_)/;
const DISCORD_NETWORK_MESSAGE_RE =
    /ETIMEDOUT|ENETUNREACH|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|fetch failed|socket hang up|network (error|timeout)/i;

export function discordFailureLevel(error: unknown): DiscordFailureLevel {
    const status = getDiscordApiStatus(error);
    if (status === 401) return "error";
    if (status > 0) return "warn";

    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && DISCORD_NETWORK_CODE_RE.test(code)) return "warn";

    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    if (DISCORD_NETWORK_MESSAGE_RE.test(message)) return "warn";

    // Défaut : on garde le signal. Une erreur qu'on ne sait pas classer reste une erreur.
    return "error";
}

/** Contexte de log d'un refus Discord : statut + code, jamais le corps brut (F-15). */
export function describeDiscordFailure(error: unknown): { status?: number; code?: number } {
    const status = getDiscordApiStatus(error);
    const code = getDiscordApiCode(error);
    return {
        ...(status ? { status } : {}),
        ...(code !== undefined ? { code } : {}),
    };
}
export type DiscordOutboxFailureAlert = {
    title: string;
    message: string;
    type: "SYSTEM";
    success: false;
    ping: true;
    metadata: Record<string, string | number>;
};

/**
 * Construit l'alerte God d'un échec définitif d'écriture outbox.
 * Objectif : être exploitable SANS accès aux logs — salon concerné, nature de
 * l'écriture, cause (statut HTTP + code Discord), nombre de tentatives.
 */
export function buildDiscordOutboxFailureAlert(args: {
    jobId?: string;
    kind?: string;
    channelId?: string;
    attempts: number;
    error: unknown;
}): DiscordOutboxFailureAlert {
    const { jobId, kind, channelId, attempts, error } = args;
    const refusal = describeDiscordRefusal(error);
    const reason = error instanceof Error ? error.message : String(error ?? "inconnu");
    const status = getDiscordApiStatus(error);

    const message =
        `L'écriture Discord ${jobId ?? "?"} (${kind ?? "?"})${channelId ? ` vers le salon ${channelId}` : ""} ` +
        `a échoué définitivement après ${attempts} tentative(s)${refusal} : ${reason}`;

    // 5 champs max : `notifyGod` ne rend que les 5 premières entrées (embed Discord).
    return {
        title: "Discord Outbox : écriture abandonnée",
        message,
        type: "SYSTEM",
        success: false,
        ping: true,
        metadata: {
            jobId: jobId ?? "?",
            kind: kind ?? "?",
            channelId: channelId ?? "?",
            status: status || "?",
            attempts,
        },
    };
}

/**
 * Alerte God **agrégée** : combien de salons refusent les écritures du bot, et
 * lesquels. Née de la mesure du 25/09/2026 — à l'échelle, une alerte par salon
 * et par échec noie les alertes métier : le disjoncteur (`discord-channel-health`)
 * plafonne chaque salon à **une** alerte, et cette ligne donne le tableau
 * d'ensemble (plafonnée elle aussi par la déduplication).
 *
 * Reste **web-only** côté appelant : une alerte qui décrit une panne d'écriture
 * Discord ne doit jamais repartir sur Discord.
 */
export function buildAggregateOutboxFailureAlert(args: {
    channels: string[];
    total?: number;
    kind?: string;
}): DiscordOutboxFailureAlert {
    const { channels, kind } = args;
    const total = args.total ?? channels.length;
    const shown = channels.slice(0, 10);
    const rest = total > shown.length ? ` … (+${total - shown.length} autre(s))` : "";
    const liste = shown.length ? `\nSalons en pause : ${shown.map((c) => `\`${c}\``).join(", ")}${rest}` : "";

    return {
        title: "Discord Outbox : salons inaccessibles (agrégé)",
        message:
            `**${total}** salon(s) Discord refusent les écritures du bot${kind ? ` (${kind})` : ""}. ` +
            `Un refus permanent (403/50001, 404, 401) met le salon en pause d'écriture 15 min à 6 h : ` +
            `la file n'y retente plus, et la pause expire pour sonder la réparation.${liste}`,
        type: "SYSTEM",
        success: false,
        ping: true,
        metadata: {
            salons: total,
            listes: shown.length,
            premier: shown[0] ?? "?",
            kind: kind ?? "?",
        },
    };
}

