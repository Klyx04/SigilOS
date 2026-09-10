export const DOCS_MAPPING: Record<string, string> = {
    // Dashboard Roots
    "/dashboard": "intro",

    // Guild Management
    "/guilds": "guide/configuration",
    "/dashboard/settings": "guide/configuration",

    // Features
    "/dashboard/missions": "guide/missions",
    "/dashboard/marche": "marche",
    "/dashboard/quete-ocre": "guide/ocre",
    "/dashboard/songes": "guide/songes",

    // Admin
    "/god": "admin/overview",
    "/god/users": "admin/users",
    "/god/guilds": "admin/guilds",
};

export function getDocForRoute(pathname: string): string {
    // Exact match
    if (DOCS_MAPPING[pathname]) {
        return DOCS_MAPPING[pathname];
    }

    // Partial match (e.g. /dashboard/missions/validate -> /dashboard/missions)
    const sortedKeys = Object.keys(DOCS_MAPPING).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (pathname.startsWith(key)) {
            return DOCS_MAPPING[key];
        }
    }

    // Default
    return "intro";
}
