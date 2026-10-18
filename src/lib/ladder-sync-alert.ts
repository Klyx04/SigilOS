/**
 * Règle PURE de l'alerte « Ladder General/Succès Sync » (cron `/api/cron/ladder-sync`).
 *
 * Mesure du 02/10/2026 (bêta, table `GodNotification`, 90 j) : **17 des 34 alertes**
 * « Ladder General/Succès Sync » étaient **vertes alors que des profils avaient échoué**
 * (`metadata.fail_count > 0`) — la moitié. Cause : la route posait
 * `success: results.some(r => r.success)`, donc « vert dès qu'un seul profil passe ».
 * En plus, le message ne disait **ni qui** avait échoué **ni pourquoi** (motif capturé
 * mais jamais affiché) → alerte **inactionnable**.
 *
 * Ici, tout est pur et testé : la couleur dit la vérité (`vert ⇔ aucun échec`), le
 * message liste les échecs (borné), et les champs d'embed sont en **français**.
 */

import { truncateDetailValue } from "@/lib/detail-value";

export type LadderSyncResult = {
    pseudo: string;
    success: boolean;
    /** Motif métier (ex. « Not found on ladder »). */
    reason?: string;
    /** Erreur technique éventuelle (déjà stringifiée par l'appelant). */
    error?: string;
};

export type LadderSyncFailure = { pseudo: string; reason: string };

export type LadderSyncSummary = {
    batchSize: number;
    successCount: number;
    failCount: number;
    failures: LadderSyncFailure[];
    /** **Vert uniquement si AUCUN échec** — la couleur ne doit jamais mentir. */
    allSucceeded: boolean;
};

/** Nombre maximal d'échecs détaillés dans le message (le reste est résumé). */
export const LADDER_SYNC_MAX_LISTED_FAILURES = 5;

function failureReason(result: LadderSyncResult): string {
    const raw = result.reason ?? result.error ?? "raison inconnue";
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : "raison inconnue";
}

/** Réduit la liste des résultats bruts en un résumé exploitable (pur). */
export function summarizeLadderSync(results: LadderSyncResult[]): LadderSyncSummary {
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success).map((r) => ({ pseudo: r.pseudo, reason: failureReason(r) }));
    return {
        batchSize: results.length,
        successCount: successes.length,
        failCount: failures.length,
        failures,
        allSucceeded: failures.length === 0,
    };
}

/** Message humain : l'état, puis la liste bornée des échecs. */
export function buildLadderSyncMessage(summary: LadderSyncSummary): string {
    const head = summary.allSucceeded
        ? `Synchronisation ladder : ${summary.successCount}/${summary.batchSize} profils à jour.`
        : `Synchronisation ladder : ${summary.successCount}/${summary.batchSize} profils à jour — ${summary.failCount} échec(s) à regarder.`;
    if (summary.failures.length === 0) return head;

    const shown = summary.failures.slice(0, LADDER_SYNC_MAX_LISTED_FAILURES);
    const lines = shown.map((f) => `• ${f.pseudo} — ${f.reason}`);
    const remaining = summary.failures.length - shown.length;
    if (remaining > 0) lines.push(`• … et ${remaining} autre(s).`);
    return `${head}\n${lines.join("\n")}`;
}

/** Champs d'embed en français (fin du jargon `success_count` / `fail_count`). */
export function buildLadderSyncFields(summary: LadderSyncSummary): { name: string; value: string; inline?: boolean }[] {
    return [
        { name: "Profils traités", value: String(summary.batchSize), inline: true },
        { name: "À jour", value: String(summary.successCount), inline: true },
        { name: "Échecs", value: String(summary.failCount), inline: true },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Run du WORKER BullMQ (« Ladder Background Sync ») — compteurs **et** QUI a
// échoué. Mesure du 12/10/2026 : l'embed montrait `jobId`, `synced`, `notFound`,
// `errored` (clés techniques anglaises) sans jamais dire **quels** pseudos
// étaient introuvables ⇒ alerte illisible et inactionnable.
// ─────────────────────────────────────────────────────────────────────────────

/** Résumé **au niveau run** renvoyé par `processLadderSync` (compteurs + listes). */
export type LadderWorkerSummary = {
    synced?: number;
    notFound?: number;
    errored?: number;
    total?: number;
    cooldowns?: number;
    aborted?: boolean;
    /** Pseudos réellement introuvables sur le ladder (bornés à l'affichage). */
    notFoundPseudos?: string[];
    /** Pseudos en erreur technique (réseau/WAF) (bornés à l'affichage). */
    erroredPseudos?: string[];
    /** C3 — profils introuvables **avec leur guilde et leur dernier état connu**. */
    notFoundFailures?: LadderFailureProfile[];
    /** C3 — profils en erreur technique, avec le même contexte. */
    erroredFailures?: LadderFailureProfile[];
};

/** Liste bornée « a, b, c … (+N) » — jamais une liste infinie dans un embed. */
function boundedJoin(values: string[] | undefined): string {
    const list = (values ?? []).filter((v) => v && v.trim() !== "");
    if (list.length === 0) return "";
    const shown = list.slice(0, LADDER_SYNC_MAX_LISTED_FAILURES);
    const suffix = list.length > shown.length ? ` … (+${list.length - shown.length})` : "";
    return `${shown.join(", ")}${suffix}`;
}

/** Message humain du run worker : l'état, puis **qui** est concerné (borné). */
export function buildLadderWorkerMessage(
    summary: LadderWorkerSummary,
    breakdown?: LadderFailureBreakdown,
): string {
    const total = summary.total ?? 0;
    const synced = summary.synced ?? 0;
    const notFound = summary.notFound ?? 0;
    const errored = summary.errored ?? 0;
    const head = summary.aborted
        ? `Sync ladder interrompue : ${synced}/${total} profils à jour, ${notFound} introuvable(s), ${errored} erreur(s) — reprise au prochain run.`
        : `Sync ladder : ${synced}/${total} profils à jour, ${notFound} introuvable(s), ${errored} erreur(s).`;

    // C3 — répartition par guilde : on nomme la guilde ET les pseudos concernés.
    if (breakdown && breakdown.guilds.length > 0) {
        const shown = breakdown.guilds.slice(0, LADDER_SYNC_MAX_MESSAGE_GUILDS);
        const lines = shown.map((guild) => {
            const parts: string[] = [];
            if (guild.notFoundTotal > 0) {
                parts.push(`${guild.notFoundTotal} introuvable(s) : ${boundedJoin(guild.notFound.map((f) => f.pseudo))}`);
            }
            if (guild.erroredTotal > 0) {
                parts.push(`${guild.erroredTotal} erreur(s) : ${boundedJoin(guild.errored.map((f) => f.pseudo))}`);
            }
            return `• ${guildFieldName(guild)} — ${parts.join(" / ")}`;
        });
        const hidden = breakdown.guildsTotal - shown.length;
        if (hidden > 0) lines.push(`• … et ${hidden} autre(s) guilde(s).`);
        return `${head}\n${lines.join("\n")}`;
    }

    const lines: string[] = [];
    const missing = boundedJoin(summary.notFoundPseudos);
    if (missing) lines.push(`Introuvables : ${missing}`);
    const failed = boundedJoin(summary.erroredPseudos);
    if (failed) lines.push(`En erreur : ${failed}`);
    return lines.length > 0 ? `${head}\n${lines.join("\n")}` : head;
}

/** Champs d'embed FR du run worker (fin du jargon `synced` / `notFound` / `errored`). */
export function buildLadderWorkerFields(
    summary: LadderWorkerSummary,
    breakdown?: LadderFailureBreakdown
): { name: string; value: string; inline?: boolean }[] {
    const fields: { name: string; value: string; inline?: boolean }[] = [
        { name: "Profils traités", value: String(summary.total ?? 0), inline: true },
        { name: "À jour", value: String(summary.synced ?? 0), inline: true },
        { name: "Introuvables", value: String(summary.notFound ?? 0), inline: true },
        { name: "Erreurs", value: String(summary.errored ?? 0), inline: true },
    ];
    if (summary.cooldowns) {
        fields.push({ name: "Pauses anti-blocage", value: String(summary.cooldowns), inline: true });
    }
    if (breakdown && breakdown.guilds.length > 0) {
        fields.push(...buildLadderGuildFields(breakdown));
    }
    return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// C3 — « qui, PAR GUILDE », avec le maximum de contexte.
//
// Mesure : le run traite des profils de **plusieurs guildes** (`guild.dofusServerId`),
// mais l'alerte ne listait que des pseudos **à plat** (5 max) : impossible de savoir
// quelle guilde prévenir, ni si le membre a simplement **changé de pseudo** (le cas
// le plus fréquent d'un « introuvable »). On joint donc, pour chaque échec, ce que le
// profil savait encore : niveau, points de succès, classe, dernier sync, **alias
// déclarés** et pseudo Discord — de quoi agir sans ouvrir la base.
// ─────────────────────────────────────────────────────────────────────────────

/** Un profil en échec, avec le dernier état connu **avant** cet échec. */
export type LadderFailureProfile = {
    guildId: string;
    guildName: string;
    /** Serveur Dofus de la guilde (`GuildConfig.dofusServerId`), `null` si absent. */
    serverId: string | null;
    /** Pseudo réellement interrogé sur le ladder. */
    pseudo: string;
    /** Pseudos alternatifs déclarés — un renommage y figure souvent. */
    altPseudos: string[];
    classe: string | null;
    dofusLevel: number | null;
    successPoints: number | null;
    /** `BigInt` sérialisé en chaîne (jamais un `number` : perte de précision). */
    totalXp: string | null;
    /** Dernière synchronisation ladder réussie (ISO), `null` = jamais. */
    lastLadderUpdate: string | null;
    /** Pseudo Discord du membre — pour savoir **qui** prévenir. */
    discordNickname: string | null;
};

/** Une guilde et ses profils en échec (listes **complètes**, bornées au rendu). */
export type LadderGuildFailure = {
    guildId: string;
    guildName: string;
    serverId: string | null;
    notFound: LadderFailureProfile[];
    errored: LadderFailureProfile[];
    notFoundTotal: number;
    erroredTotal: number;
};

export type LadderFailureBreakdown = {
    guilds: LadderGuildFailure[];
    /** Nombre total de guildes concernées (avant plafond d'affichage). */
    guildsTotal: number;
    /** Guildes non détaillées (plafond `LADDER_SYNC_MAX_LISTED_GUILDS`). */
    hiddenGuilds: number;
};

/** Plafond de guildes détaillées dans l'embed / le journal. */
export const LADDER_SYNC_MAX_LISTED_GUILDS = 10;
/** Plafond de guildes détaillées dans le **message** (limite de lisibilité). */
export const LADDER_SYNC_MAX_MESSAGE_GUILDS = 5;
/** Plafond de lignes « un profil en échec » dans le journal (perte **dite**). */
export const LADDER_SYNC_MAX_DETAIL_ROWS = 100;

function formatLadderNumber(value: number | null): string | null {
    if (value === null || !Number.isFinite(value)) return null;
    return value.toLocaleString("fr-FR");
}

/** Contexte compact d'un profil : ce qui explique un pseudo disparu du ladder. */
export function formatLadderFailureContext(failure: LadderFailureProfile): string {
    const parts: string[] = [];
    if (failure.dofusLevel !== null) parts.push(`niv. ${failure.dofusLevel}`);
    const points = formatLadderNumber(failure.successPoints);
    if (points) parts.push(`${points} pts`);
    if (failure.classe) parts.push(failure.classe);
    parts.push(
        failure.lastLadderUpdate
            ? `dernier sync ${failure.lastLadderUpdate.slice(0, 10)}`
            : "jamais synchronisé",
    );
    if (failure.altPseudos.length > 0) {
        parts.push(`alias : ${failure.altPseudos.slice(0, 3).join(", ")}`);
    }
    if (failure.discordNickname) parts.push(`Discord : ${failure.discordNickname}`);
    return parts.join(" · ");
}

/** Regroupe les échecs **par guilde**, les plus touchées d'abord. */
export function summarizeLadderFailuresByGuild(
    notFound: LadderFailureProfile[],
    errored: LadderFailureProfile[],
): LadderFailureBreakdown {
    const guilds = new Map<string, LadderGuildFailure>();

    const add = (failure: LadderFailureProfile, bucket: "notFound" | "errored") => {
        const row = guilds.get(failure.guildId) ?? {
            guildId: failure.guildId,
            guildName: failure.guildName,
            serverId: failure.serverId,
            notFound: [],
            errored: [],
            notFoundTotal: 0,
            erroredTotal: 0,
        };
        row[bucket].push(failure);
        if (bucket === "notFound") row.notFoundTotal += 1;
        else row.erroredTotal += 1;
        guilds.set(failure.guildId, row);
    };

    for (const failure of notFound) add(failure, "notFound");
    for (const failure of errored) add(failure, "errored");

    const all = [...guilds.values()].sort(
        (a, b) =>
            b.notFoundTotal + b.erroredTotal - (a.notFoundTotal + a.erroredTotal) ||
            a.guildName.localeCompare(b.guildName, "fr"),
    );
    const kept = all.slice(0, LADDER_SYNC_MAX_LISTED_GUILDS);

    return {
        guilds: kept,
        guildsTotal: all.length,
        hiddenGuilds: Math.max(0, all.length - kept.length),
    };
}

/** Nom affiché d'une guilde (nom + serveur Dofus quand il est connu). */
function guildFieldName(guild: LadderGuildFailure): string {
    return guild.serverId ? `${guild.guildName} · serveur ${guild.serverId}` : guild.guildName;
}

/** Une ligne « N introuvable(s)/erreur(s) : pseudo (contexte), … (+N) » bornée. */
function guildFailureLine(label: string, failures: LadderFailureProfile[], total: number): string | null {
    if (total === 0) return null;
    const shown = failures.slice(0, LADDER_SYNC_MAX_LISTED_FAILURES);
    const details = shown.map((failure) => `${failure.pseudo} (${formatLadderFailureContext(failure)})`).join(" ; ");
    const suffix = total > shown.length ? ` … (+${total - shown.length})` : "";
    return `• ${total} ${label} : ${details}${suffix}`;
}

/** Valeur d'embed d'une guilde : introuvables puis erreurs, **avec** le contexte. */
function guildFieldValue(guild: LadderGuildFailure): string {
    const lines = [
        guildFailureLine("introuvable(s)", guild.notFound, guild.notFoundTotal),
        guildFailureLine("erreur(s)", guild.errored, guild.erroredTotal),
    ].filter((line): line is string => line !== null);
    return truncateDetailValue(lines.join("\n"), 1024);
}

/** Un champ d'embed par guilde (10 max) + un champ qui dit combien sont masquées. */
export function buildLadderGuildFields(
    breakdown: LadderFailureBreakdown
): { name: string; value: string; inline?: boolean }[] {
    const fields = breakdown.guilds.map((guild) => ({
        name: truncateDetailValue(guildFieldName(guild), 256),
        value: guildFieldValue(guild),
        inline: false,
    }));

    if (breakdown.hiddenGuilds > 0) {
        fields.push({
            name: "… autres guildes",
            value: `${breakdown.hiddenGuilds} guilde(s) non détaillée(s) — voir le journal God (Tâches CRON).`,
            inline: false,
        });
    }

    return fields;
}

/**
 * Lignes « un profil en échec = une ligne » pour le **journal God** (onglet Tâches CRON
 * → Journal → fiche de l'exécution). Chaque ligne porte le contexte complet : c'est là
 * qu'on voit qu'un pseudo introuvable a peut-être été **renommé** (alias, dernier sync).
 * Au-delà du plafond, la perte est **dite** — jamais silencieuse.
 */
export function ladderFailureDetailRows(breakdown: LadderFailureBreakdown): Record<string, string> {
    const rows: Record<string, string> = {};
    let written = 0;
    let hidden = 0;

    const add = (guild: LadderGuildFailure, failure: LadderFailureProfile, kind: string) => {
        if (written >= LADDER_SYNC_MAX_DETAIL_ROWS) {
            hidden += 1;
            return;
        }
        const key = `${guild.guildName} · ${failure.pseudo}`;
        const value = `${kind} le ${new Date().toISOString().slice(0, 10)} · ${formatLadderFailureContext(failure)}`;
        rows[key] = rows[key] ? `${rows[key]}\n${value}` : value;
        written += 1;
    };

    for (const guild of breakdown.guilds) {
        for (const failure of guild.notFound) add(guild, failure, "introuvable");
        for (const failure of guild.errored) add(guild, failure, "erreur technique");
    }

    if (breakdown.hiddenGuilds > 0) {
        rows["… autres guildes"] = `${breakdown.hiddenGuilds} guilde(s) non détaillée(s) (plafond ${LADDER_SYNC_MAX_LISTED_GUILDS}).`;
    }
    if (hidden > 0) {
        rows["… autres profils non détaillés"] = `${hidden} profil(s) en échec non affichés (plafond ${LADDER_SYNC_MAX_DETAIL_ROWS}).`;
    }

    return rows;
}

