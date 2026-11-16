/**
 * Télémétrie — **surface** d'un chemin : Admin, Membre, God ou Public.
 *
 * Règle pure, utilisée à deux endroits :
 *   • l'affichage (badge de chaque événement) ;
 *   • le filtre serveur de `getTelemetryLiveEvents` (`buildTelemetrySurfaceWhere`).
 *
 * Le filtre SQL ne peut pas appeler la fonction par ligne : il reproduit les
 * mêmes frontières avec des segments de chemin (`/dashboard/…/admin`).
 */

export type TelemetrySurface = "ADMIN" | "MEMBER" | "GOD" | "PUBLIC";

const DASHBOARD_PREFIX = "/dashboard/";

/** Classe un chemin réel (query tolérée) dans l'une des quatre surfaces. */
export function classifyTelemetrySurface(path: string | null | undefined): TelemetrySurface {
    if (!path || !path.startsWith("/")) return "PUBLIC";

    const [pathname] = path.split("?");
    if (pathname === "/god" || pathname.startsWith("/god/")) return "GOD";

    if (pathname.startsWith(DASHBOARD_PREFIX)) {
        const rest = pathname.slice(DASHBOARD_PREFIX.length);
        const slash = rest.indexOf("/");
        const afterGuild = slash === -1 ? "" : rest.slice(slash);
        return afterGuild === "/admin" || afterGuild.startsWith("/admin/") ? "ADMIN" : "MEMBER";
    }

    return "PUBLIC";
}

/** Sous-ensemble de `Prisma.TelemetryEventWhereInput` (aucun import Prisma : règle pure). */
export type TelemetrySurfaceWhere = {
    path?: { startsWith?: string; contains?: string; endsWith?: string };
    AND?: TelemetrySurfaceWhere[];
    OR?: TelemetrySurfaceWhere[];
    NOT?: TelemetrySurfaceWhere | TelemetrySurfaceWhere[];
};

/**
 * Filtre serveur équivalent à `classifyTelemetrySurface`.
 * `/dashboard/:id/admin` et `/dashboard/:id/admin/...` sont les deux formes admin.
 */
export function buildTelemetrySurfaceWhere(surface: TelemetrySurface): TelemetrySurfaceWhere {
    const adminSegment: TelemetrySurfaceWhere = {
        OR: [{ path: { endsWith: "/admin" } }, { path: { contains: "/admin/" } }],
    };

    switch (surface) {
        case "ADMIN":
            return { AND: [{ path: { startsWith: DASHBOARD_PREFIX } }, adminSegment] };
        case "MEMBER":
            return { AND: [{ path: { startsWith: DASHBOARD_PREFIX } }, { NOT: adminSegment }] };
        case "GOD":
            return { path: { startsWith: "/god" } };
        case "PUBLIC":
            return {
                NOT: [
                    { path: { startsWith: DASHBOARD_PREFIX } },
                    { path: { startsWith: "/god" } },
                ],
            };
    }
}
