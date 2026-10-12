/**
 * Parsing **PUR** du changelog Discord — version **markdown** (`change-log.md`).
 *
 * Pourquoi ce module : la page HTML du changelog pèse ~3 Mo (CSS/JS/navigation) et la
 * veille historique n'en lisait que les **150 000 premiers caractères** ⇒ l'essentiel
 * n'était jamais scanné. Discord publie une version **markdown** propre
 * (`https://docs.discord.com/developers/change-log.md`, ~300 Ko) où chaque entrée est une
 * balise `<Update label="<date>" tags={[...]} rss={{ title, description }}>` :
 *  · `label` → la **date** de l'entrée ;
 *  · `tags` → les catégories, dont **`Breaking Change`** ⇒ détection **structurelle** des
 *    ruptures (bien plus fiable qu'une recherche de sous-chaîne « Breaking Change ») ;
 *  · `rss.title` / `rss.description` → un **résumé** lisible.
 *
 * Aucune I/O ici : tout est pur et testé (`tests/unit/discord-changelog.test.ts`).
 */

export type DiscordChangelogEntry = {
    /** Libellé brut de la date, ex. « September 28, 2026 ». */
    label: string;
    /** Date ISO (`AAAA-MM-JJ`) dérivée du libellé, ou `null` si non reconnu. */
    iso: string | null;
    /** Catégories de l'entrée, ex. `["HTTP API", "Breaking Change"]`. */
    tags: string[];
    /** Titre de l'entrée (bloc `rss`). */
    title: string;
    /** Description courte (bloc `rss`). */
    description: string;
};

const MONTHS: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

/** « November 16, 2026 » → « 2026-11-16 ». `null` si le libellé n'est pas du mois-jour-année. */
export function labelToIso(label: string): string | null {
    const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(label.trim());
    if (!m) return null;
    const month = MONTHS[m[1].toLowerCase()];
    if (!month) return null;
    return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

function unescapeMd(value: string): string {
    return value.replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
}

function parseTags(inner: string): string[] {
    const trimmed = inner.trim();
    if (!trimmed) return [];
    const items = trimmed.startsWith("[")
        ? trimmed.slice(1, -1).split(",")
        : [trimmed];
    return items.map((t) => t.trim().replace(/^"|"$/g, "")).filter((t) => t.length > 0);
}

/**
 * Extrait toutes les entrées `<Update …>…</Update>` d'un markdown de changelog.
 * Tolérant : un bloc sans `label`/`rss` n'empêche pas les autres d'être lus.
 */
export function parseDiscordChangelog(markdown: string): DiscordChangelogEntry[] {
    if (!markdown) return [];
    const entries: DiscordChangelogEntry[] = [];
    const blockRe = /<Update\b([\s\S]*?)<\/Update>/g;
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(markdown)) !== null) {
        const block = match[1];
        const label = /label="([^"]+)"/.exec(block)?.[1] ?? "";
        const tagsRaw = /tags=\{\s*(\[[^\]]*\]|"[^"]*")\s*\}/.exec(block)?.[1] ?? "";
        const title = /title:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1] ?? "";
        const description = /description:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1] ?? "";
        entries.push({
            label,
            iso: label ? labelToIso(label) : null,
            tags: parseTags(tagsRaw),
            title: unescapeMd(title),
            description: unescapeMd(description),
        });
    }
    return entries;
}

/** Vrai si l'entrée est catégorisée « breaking » (tag quelconque contenant « breaking »). */
export function isBreakingEntry(entry: DiscordChangelogEntry): boolean {
    return entry.tags.some((t) => /breaking/i.test(t));
}

/** Texte d'une entrée sur lequel chercher les mots-clés. */
export function entrySearchText(entry: DiscordChangelogEntry): string {
    return [entry.label, entry.tags.join(" "), entry.title, entry.description].join(" \n ");
}

/** Signature stable d'une entrée (déduplication des breaking changes entre deux veilles). */
export function entrySignature(entry: DiscordChangelogEntry): string {
    return `${entry.iso ?? entry.label}|${entry.title}`;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mots-clés présents dans `text` — comparaison **insensible à la casse** et **bornée** par des
 * caractères non alphanumériques (« v11 » ne matche ni « v11x » ni « xv11 »). Corrige deux
 * défauts de la version historique : `includes` sensible à la casse (d'où une liste avec
 * `Obfuscation` **et** `obfuscation`) et `v11` qui matchait n'importe quelle sous-chaîne.
 */
export function matchChangelogKeywords(text: string, keywords: readonly string[]): string[] {
    const hits: string[] = [];
    for (const kw of keywords) {
        const re = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(kw)}(?:[^A-Za-z0-9]|$)`, "i");
        if (re.test(text)) hits.push(kw);
    }
    return hits;
}
