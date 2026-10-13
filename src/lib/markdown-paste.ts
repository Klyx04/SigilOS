/**
 * Collage Markdown dans l'éditeur TipTap — détection + conversion (pur, testé).
 *
 * Contexte : l'éditeur stocke du HTML et TipTap ne convertit pas le Markdown
 * collé en texte brut (`## Titre` restait affiché littéralement). Ce module
 * convertit les constructions courantes vers le sous-ensemble HTML que
 * l'éditeur sait garder (h1-h3, p, ul/ol/li, blockquote, pre/code, hr, a,
 * img, strong/em/s/strike, code inline).
 *
 * Limites assumées (documentées, jamais silencieuses) :
 * - les tableaux Markdown n'existent pas dans l'éditeur → chaque ligne de
 *   données devient un puce « cellule — cellule » (visible, rien de perdu) ;
 * - les listes imbriquées sont aplaties ; les titres h4+ deviennent des h3.
 */

/** Échappe le HTML brut (fail-closed : une saisie ne produit jamais de balise). */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Convertit l'inline Markdown (images, liens, code, gras, italique, barré). */
export function markdownInlineToHtml(text: string): string {
    let out = escapeHtml(text);
    // Images : ![alt](src) — avant les liens classiques.
    out = out.replace(
        /!\[([^\]]*)\]\(([^)\s]+)\)/g,
        (_m, alt: string, src: string) => `<img src="${src}" alt="${alt}" />`
    );
    // Liens : [texte](url).
    out = out.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, label: string, url: string) => `<a href="${url}">${label}</a>`
    );
    // Code inline : `code`.
    out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
    // Gras : **texte**.
    out = out.replace(/\*\*([^*]+)\*\*/g, (_m, bold: string) => `<strong>${bold}</strong>`);
    // Barré : ~~texte~~.
    out = out.replace(/~~([^~]+)~~/g, (_m, strike: string) => `<s>${strike}</s>`);
    // Italique : *texte* (après le gras pour ne pas croiser les paires).
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, before: string, it: string) => `${before}<em>${it}</em>`);
    return out;
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const OL_RE = /^\d+[.)]\s+(.*)$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const HR_RE = /^(\*\*\*|---|___)\s*$/;
// Ligne de séparation d'un tableau : | --- | --- |
const TABLE_SEP_RE = /^\|?[\s:|-]+\|[\s:|.-]*$/;

function isTableRow(line: string): boolean {
    return line.trim().startsWith("|") && line.includes("|", 1);
}

function tableRowToItem(line: string): string {
    const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => escapeHtml(c.trim()))
        .filter((c) => c.length > 0);
    return `<li>${cells.join(" — ")}</li>`;
}

/**
 * Vrai si le texte ressemble à du Markdown (seuils : au moins 2 marqueurs
 * ou un bloc de code/liste-titre évident). Le texte courant n'en a aucun.
 */
export function looksLikeMarkdown(text: string): boolean {
    const lines = text.split("\n");
    let score = 0;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (/^#{1,3}\s+\S/.test(line)) score += 2;
        else if (/^```/.test(line)) score += 2;
        else if (/^>\s+\S/.test(line)) score += 1;
        else if (OL_RE.test(line) || UL_RE.test(line)) score += 1;
        else if (isTableRow(line)) score += 1;
        else if (HR_RE.test(line)) score += 1;
        else if (/\*\*[^*]+\*\*/.test(line)) score += 1;
        else if (/\[([^\]]+)\]\(([^)\s]+)\)/.test(line)) score += 1;
        else if (/`[^`]+`/.test(line)) score += 1;
        if (score >= 2) return true;
    }
    return score >= 2;
}

/** Convertit un document Markdown en HTML compatible éditeur. */
export function markdownToHtml(markdown: string): string {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const html: string[] = [];
    let openList: "ul" | "ol" | null = null;
    let inCode = false;
    let codeBuffer: string[] = [];
    let inTable = false;

    const closeList = () => {
        if (openList) {
            html.push(`</${openList}>`);
            openList = null;
        }
    };
    const closeTable = () => {
        if (inTable) {
            html.push("</ul>");
            inTable = false;
        }
    };

    const openListTag = (kind: "ul" | "ol") => {
        closeTable();
        if (openList !== kind) {
            closeList();
            html.push(`<${kind}>`);
            openList = kind;
        }
    };

    for (const raw of lines) {
        const line = raw;
        const trimmed = line.trim();

        // Blocs de code ``` (ouvrent/ferment).
        if (/^```/.test(trimmed)) {
            if (inCode) {
                html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
                codeBuffer = [];
                inCode = false;
            } else {
                closeList();
                closeTable();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            codeBuffer.push(line);
            continue;
        }

        if (!trimmed) {
            closeList();
            closeTable();
            continue;
        }

        // Tableaux → liste de puces (l'éditeur n'a pas de nœud table).
        if (isTableRow(trimmed)) {
            closeList();
            if (TABLE_SEP_RE.test(trimmed)) continue;
            if (!inTable) {
                html.push("<ul>");
                inTable = true;
            }
            html.push(tableRowToItem(trimmed));
            continue;
        }
        closeTable();

        // Titres.
        const heading = HEADING_RE.exec(trimmed);
        if (heading) {
            closeList();
            const level = Math.min(heading[1].length, 3);
            html.push(`<h${level}>${markdownInlineToHtml(heading[2])}</h${level}>`);
            continue;
        }

        // Séparateur horizontal.
        if (HR_RE.test(trimmed)) {
            closeList();
            html.push("<hr />");
            continue;
        }

        // Citations (le `>` a été échappé en `&gt;` par escapeHtml… on teste
        // avant conversion inline, donc on matche le `>` brut ici).
        if (trimmed.startsWith(">")) {
            closeList();
            const inner = trimmed.replace(/^>\s?/, "");
            html.push(`<blockquote><p>${markdownInlineToHtml(inner)}</p></blockquote>`);
            continue;
        }

        // Listes.
        const ol = OL_RE.exec(trimmed);
        if (ol) {
            openListTag("ol");
            html.push(`<li>${markdownInlineToHtml(ol[1])}</li>`);
            continue;
        }
        const ul = UL_RE.exec(trimmed);
        if (ul) {
            openListTag("ul");
            html.push(`<li>${markdownInlineToHtml(ul[1])}</li>`);
            continue;
        }

        // Paragraphe courant.
        closeList();
        html.push(`<p>${markdownInlineToHtml(trimmed)}</p>`);
    }

    if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    }
    closeList();
    closeTable();
    return html.join("");
}
