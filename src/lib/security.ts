import DOMPurify from 'isomorphic-dompurify';

/**
 * Shared Security Utilities
 */

/**
 * Sanitize HTML/Markdown input to prevent XSS
 * - Uses isomorphic-dompurify for robust DOM-based sanitization
 * 
 * @param input The raw string to sanitize
 * @param maxLength Optional max length constraint
 * @param strict If true, strips ALL HTML tags except basic formatting (b, i, u, br). Default false for Docs.
 */
export function sanitizeHtml(input: string | null, maxLength: number = 100000, strict: boolean = false): string | null {
    if (!input) return null;

    // Limit length first
    const truncated = input.slice(0, maxLength);

    // Strict mode for Presentation (Bio/Description)
    const config = strict
        ? { ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br'] }
        : {}; // Normal mode allows safe HTML (h1, img, etc.) but removes scripts/iframes.

    return DOMPurify.sanitize(truncated, config);
}

/**
 * Sanitize Discord invite link - strict validation
 */
export function sanitizeDiscordLink(url: string | null): string | null {
    if (!url) return null;
    const cleaned = url.trim();
    if (!cleaned) return null;

    // Strict regex for Discord invite links only
    // Supports discord.gg, discord.com/invite
    const discordInviteRegex = /^https?:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/i;

    if (!discordInviteRegex.test(cleaned)) {
        return null;
    }

    if (cleaned.includes('<') || cleaned.includes('>') || cleaned.includes('"') || cleaned.includes("'")) {
        return null;
    }

    return cleaned;
}

/**
 * Sanitize simple name/title input
 */
export function sanitizeName(name: string | null, maxLength: number = 50): string | null {
    if (!name) return null;
    return name
        .trim()
        .replace(/[<>"'&]/g, "") // Remove HTML special chars, keep ( ) and space
        .slice(0, maxLength);
}
