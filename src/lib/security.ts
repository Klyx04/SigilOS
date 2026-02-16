/**
 * Shared Security Utilities
 */

/**
 * Sanitize HTML/Markdown input to prevent XSS
 * - Removes script tags
 * - Removes iframe tags
 * - Removes javascript: protocols
 * - Removes event handlers (on*)
 * 
 * @param input The raw string to sanitize
 * @param maxLength Optional max length constraint
 * @param strict If true, strips ALL HTML tags except basic formatting (b, i, u, br). Default false for Docs.
 */
export function sanitizeHtml(input: string | null, maxLength: number = 20000, strict: boolean = false): string | null {
    if (!input) return null;

    let clean = input
        // Remove script tags and content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        // Remove iframe tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        // Remove object/embed
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
        // Remove javascript: protocols in href/src
        .replace(/javascript:/gi, "")
        .replace(/vbscript:/gi, "")
        .replace(/data:text\/html/gi, "")
        // Remove event handlers (onclick, onmouseover, etc.)
        .replace(/ on\w+="[^"]*"/gi, "")
        .replace(/ on\w+='[^']*'/gi, "")
        .replace(/ on\w+=\S+/gi, "");

    // Strict mode for Presentation (Bio/Description)
    if (strict) {
        clean = clean.replace(/<(?!\/?(b|i|u|strong|em|br)\b)[^>]+>/gi, "");
    }

    // Limit length
    return clean.slice(0, maxLength);
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
