/**
 * Miroir agenda lecture seule — DJ / Songes → `GuildEvent`.
 *
 * Lot R1 (§4) : la source reste le post DJ (`DjSearchPost`) / la run Songes
 * (`DreamRun`) — cartes et embeds Discord intouchés. Le calendrier ne reçoit
 * qu'une copie miroir `GuildEvent` (`metadata.source = { kind, … }`).
 *
 * Règles (validées user) :
 * - post/run daté → crée le miroir ; date ajoutée après coup → crée ;
 * - date changée → patch `start/end` ; date retirée (post/run toujours ouvert)
 *   ou jamais mise → pas de miroir (celui qui existe sort du calendrier) ;
 * - post fermé / run clôturée → miroir `COMPLETED` (filigrane « Terminé »,
 *   plus sympa qu'une suppression) ; run abandonnée → `CANCELLED` ;
 * - multi 2-5 dates → UN SEUL Event chapeau (min-max), détail en `metadata` ;
 * - modale lecture seule pour tout le monde, même admin (cf. `isAgendaMirror`).
 *
 * Module **pur** (aucune I/O) — testé unitairement.
 */

/** Durée par défaut d'un miroir (2 h, cohérent avec les crons H-1). */
export const AGENDA_MIRROR_DURATION_MS = 2 * 60 * 60 * 1000;

/** Bornes anti-abus (jamais de blob du client en base tel quel). */
export const AGENDA_MIRROR_MAX_MESSAGE = 500;
export const AGENDA_MIRROR_MAX_ACHIEVEMENTS = 5;
export const AGENDA_MIRROR_MAX_CLASSES = 8;
export const AGENDA_MIRROR_MAX_MULTI_LINES = 5;
export const AGENDA_MIRROR_MAX_TITLE = 100;

export type AgendaMirrorKind = "DJ" | "SONGES";
export type DjMirrorMode = "DONJON" | "QUETE" | "DEFI" | "TITAN";

/** Libellé court du mode DJ (titre du miroir). */
export function djMirrorModeLabel(mode: string | null | undefined): string {
    switch (mode) {
        case "QUETE":
            return "Quête";
        case "DEFI":
            return "Défi";
        case "TITAN":
            return "Titan";
        case "DONJON":
        default:
            return "DJ";
    }
}

/** Type calendrier d'un miroir DJ : repli `DUNGEON_FARM` (pas d'équivalent natif). */
export function djMirrorEventType(): "DUNGEON_FARM" {
    return "DUNGEON_FARM";
}

/** Type calendrier d'un miroir Songes. */
export function songesMirrorEventType(): "SONGES_RUN" {
    return "SONGES_RUN";
}

function truncate(value: string | null | undefined, max: number): string | null {
    if (value == null) return null;
    const clean = String(value).trim();
    if (!clean) return null;
    if (clean.length <= max) return clean;
    return `${clean.slice(0, Math.max(0, max - 1))}…`;
}

function toValidDate(value: unknown): Date | null {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Entrées multi-donjons (`dungeonsJson`) : tableau, enveloppe
 * `{ _items | items | posts }` ou chaîne JSON — même tolérance que
 * `getMultiDungeons` (`@/lib/dungeon-finder-utils`), sans sa dépendance.
 */
export function mirrorMultiEntries(dungeonsJson: unknown): { name?: string | null; targetDate?: unknown }[] {
    if (dungeonsJson == null) return [];
    let raw: unknown = dungeonsJson;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (Array.isArray(raw)) return raw as { name?: string | null; targetDate?: unknown }[];
    if (typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        for (const key of ["_items", "items", "posts"]) {
            if (Array.isArray(obj[key])) return obj[key] as { name?: string | null; targetDate?: unknown }[];
        }
    }
    return [];
}

export interface DjMirrorDateInput {
    mode?: string | null;
    targetDate?: unknown;
    dungeonsJson?: unknown;
}

/**
 * Plage du miroir DJ : date simple → +2 h ; multi → chapeau min-max
 * (fin = dernière date + 2 h). `null` = sans date → pas de miroir.
 */
export function djMirrorRange(input: DjMirrorDateInput): { start: Date; end: Date } | null {
    const entries = mirrorMultiEntries(input.dungeonsJson);
    if (entries.length > 0) {
        const dates = entries.map((e) => toValidDate(e?.targetDate)).filter((d): d is Date => d !== null);
        if (dates.length === 0) return null;
        const min = new Date(Math.min(...dates.map((d) => d.getTime())));
        const max = new Date(Math.max(...dates.map((d) => d.getTime())));
        return { start: min, end: new Date(max.getTime() + AGENDA_MIRROR_DURATION_MS) };
    }
    const start = toValidDate(input.targetDate);
    if (!start) return null;
    return { start, end: new Date(start.getTime() + AGENDA_MIRROR_DURATION_MS) };
}

export interface DjMirrorTitleInput {
    mode?: string | null;
    dungeonName?: string | null;
    questName?: string | null;
    defiName?: string | null;
    titanName?: string | null;
    multiNames?: (string | null | undefined)[];
}

/** Titre du miroir DJ, borné à 100 caractères (limite du schéma `GuildEvent`). */
export function djMirrorTitle(input: DjMirrorTitleInput): string {
    const label = djMirrorModeLabel(input.mode);
    const names = (input.multiNames ?? []).map((n) => String(n ?? "").trim()).filter(Boolean);
    let core: string;
    if (names.length > 0) {
        core = names.length === 1 ? names[0] : `Tournée ${names.length} donjons (${names.slice(0, 2).join(" · ")}${names.length > 2 ? "…" : ""})`;
    } else {
        const raw =
            input.mode === "QUETE"
                ? input.questName
                : input.mode === "DEFI"
                  ? input.defiName
                  : input.mode === "TITAN"
                    ? input.titanName
                    : input.dungeonName;
        const clean = String(raw ?? "").trim();
        core = clean || (input.mode === "QUETE" ? "Quête" : input.mode === "DEFI" ? "Défi" : input.mode === "TITAN" ? "Titan" : "Donjon");
    }
    return truncate(`[${label}] ${core}`, AGENDA_MIRROR_MAX_TITLE) ?? `[${label}] Sortie`;
}

/** Libellé FR d'une difficulté Songes (`REVE_I` → « Rêve I »). */
export function songesDifficultyLabel(difficulty: string | null | undefined): string {
    const map: Record<string, string> = {
        REVE_I: "Rêve I",
        REVE_II: "Rêve II",
        REVE_III: "Rêve III",
        PARADOXE_I: "Paradoxe I",
        PARADOXE_II: "Paradoxe II",
        PARADOXE_III: "Paradoxe III",
        PARADOXE_IV: "Paradoxe IV",
        CAUCHEMAR_I: "Cauchemar I",
        CAUCHEMAR_II: "Cauchemar II",
        CAUCHEMAR_III: "Cauchemar III",
    };
    if (!difficulty) return "Songes";
    return map[difficulty] ?? String(difficulty).replace(/_/g, " ");
}

/** Titre du miroir Songes, borné à 100 caractères. */
export function songesMirrorTitle(difficulty: string | null | undefined): string {
    return truncate(`[Songes] ${songesDifficultyLabel(difficulty)}`, AGENDA_MIRROR_MAX_TITLE) ?? "[Songes] Run";
}

/** Plage du miroir Songes (`scheduledAt` → +2 h). `null` = sans date → pas de miroir. */
export function songesMirrorRange(scheduledAt: unknown): { start: Date; end: Date } | null {
    const start = toValidDate(scheduledAt);
    if (!start) return null;
    return { start, end: new Date(start.getTime() + AGENDA_MIRROR_DURATION_MS) };
}

/** Statut du miroir DJ : fermé/expiré → `COMPLETED` (filigrane « Terminé »). */
export function djMirrorStatus(postStatus: string | null | undefined): "PUBLISHED" | "COMPLETED" {
    return postStatus === "CLOSED" || postStatus === "EXPIRED" ? "COMPLETED" : "PUBLISHED";
}

/**
 * Statut du miroir Songes : clôturée/terminée/échouée → `COMPLETED` (filigrane),
 * abandonnée → `CANCELLED`.
 */
export function songesMirrorStatus(runStatus: string | null | undefined): "PUBLISHED" | "COMPLETED" | "CANCELLED" {
    if (runStatus === "COMPLETED" || runStatus === "FAILED") return "COMPLETED";
    if (runStatus === "ABANDONED") return "CANCELLED";
    return "PUBLISHED";
}

/** Composition du groupe : classes agrégées (classe → effectif), triées, bornées. */
export function aggregateMirrorClasses(classes: (string | null | undefined)[]): { classe: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const raw of classes) {
        const clean = String(raw ?? "").trim();
        if (!clean) continue;
        const key = clean.length > 50 ? `${clean.slice(0, 50)}…` : clean;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([classe, count]) => ({ classe, count }))
        .sort((a, b) => b.count - a.count || a.classe.localeCompare(b.classe))
        .slice(0, AGENDA_MIRROR_MAX_CLASSES);
}

/** Noms de succès visés, dédupliqués, bornés (jamais de blob). */
export function pickMirrorAchievements(names: (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
        const clean = String(raw ?? "").trim();
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean.length > 80 ? `${clean.slice(0, 80)}…` : clean);
        if (out.length >= AGENDA_MIRROR_MAX_ACHIEVEMENTS) break;
    }
    return out;
}

/** Détail multi-donjons pour `metadata.mirror.multiLines` (borné). */
export function mirrorMultiLines(entries: { name?: string | null; targetDate?: unknown }[]): { name: string; date: string | null }[] {
    return entries.slice(0, AGENDA_MIRROR_MAX_MULTI_LINES).map((e) => ({
        name: String(e?.name ?? "").trim().slice(0, 80) || "Donjon",
        date: toValidDate(e?.targetDate)?.toISOString() ?? null,
    }));
}

/** Message du créateur pour `GuildEvent.description` (borné, `null` si vide). */
export function mirrorMessage(message: string | null | undefined): string | null {
    return truncate(message, AGENDA_MIRROR_MAX_MESSAGE);
}

export interface AgendaMirrorSourceMeta {
    kind: AgendaMirrorKind;
    djPostId?: string;
    dreamRunId?: string;
}

export interface AgendaMirrorDetailMeta {
    /** Libellé d'origine (« DJ », « Quête », « Rêve II »…). */
    label: string;
    /** Noms portés (donjon / quête / défi / titan / tournée). */
    names: string[];
    /** Message du créateur (rappel, jamais deparse : la description le porte déjà). */
    message: string | null;
    /** Succès visés (noms, max 5). */
    achievements: string[];
    /** Composition (classe → effectif, max 8). */
    classes: { classe: string; count: number }[];
    /** Groupe : inscrits + capacité. */
    memberCount: number;
    maxMembers: number | null;
    /** Multi-donjons : détail par donjon (max 5). */
    multiLines: { name: string; date: string | null }[];
    /** Lien profond vers le post / la run d'origine. */
    href: string | null;
    /** Objectifs Songes (`DROP_LEGENDE`, `FUN`…), vide côté DJ. */
    objectives: string[];
}

/** `true` si ce `metadata` de `GuildEvent` est un miroir DJ/Songes (avec son id d'origine). */
export function isAgendaMirror(metadata: unknown): boolean {
    return agendaMirrorSource(metadata) !== null;
}

/** Source du miroir (`kind` + id d'origine), ou `null` si ce n'en est pas un. */
export function agendaMirrorSource(metadata: unknown): { kind: AgendaMirrorKind; id: string } | null {
    const source = (metadata as { source?: AgendaMirrorSourceMeta } | null | undefined)?.source;
    if (source?.kind === "DJ" && typeof source.djPostId === "string" && source.djPostId) {
        return { kind: "DJ", id: source.djPostId };
    }
    if (source?.kind === "SONGES" && typeof source.dreamRunId === "string" && source.dreamRunId) {
        return { kind: "SONGES", id: source.dreamRunId };
    }
    return null;
}
