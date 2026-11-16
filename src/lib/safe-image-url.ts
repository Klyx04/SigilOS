/**
 * URL d'image sûre pour un `src` (CodeQL 123/125, `js/xss-through-dom`).
 *
 * Les champs d'embed Discord sont saisis par un admin de guilde. React échappe le
 * texte, mais une URL `javascript:` ou `data:` ne doit jamais atteindre un `src` :
 * on n'accepte que `http(s)` et les chemins internes (`/uploads/...`). Tout le reste
 * est refusé (`null`), ce qui masque simplement l'image.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function safeImageSrc(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Chemin interne : accepté tel quel. `//host` est un protocole relatif → refusé.
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

    try {
        const parsed = new URL(trimmed);
        return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
    } catch {
        return null;
    }
}
