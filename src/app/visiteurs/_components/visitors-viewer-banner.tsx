import Link from "next/link";
import { GameIcon } from "@/components/shared/game-icon";
import { getClass } from "@/lib/dofus-assets";
import { formatDofusLevel } from "@/lib/dofus-level";
import { visitorProfileHref } from "@/lib/public-directory";
import { ALL_DOFUS_SERVER_ENTRIES } from "@/lib/presentation-constants";
import type { DirectoryViewer } from "@/server/public-directory";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Bandeau « toi » du hub : le lecteur se reconnaît avant de lire les autres.
 *
 * Aucune donnée nouvelle : le résumé vient de **sa propre** fiche (`DirectoryViewer`),
 * étendue dans `resolveDirectoryViewer`. Les quatre chiffres sont ceux que l'annuaire
 * affiche déjà (succès cochés, métiers, niveau, points de succès) — pas d'invention, pas
 * de score calculé côté client.
 */
export function VisitorsViewerBanner({
    viewer,
    labels,
}: {
    viewer: DirectoryViewer;
    labels: Translations["visitorsPage"];
}) {
    const classe = viewer.classe ? getClass(viewer.classe) : undefined;
    const server = ALL_DOFUS_SERVER_ENTRIES.find((entry) => entry.id === viewer.serverId);
    const metrics = [
        {
            label: labels.hub.metricAchievements,
            value: viewer.achievements,
            icon: "/assets/dofus/game-icons/trophy-1.png",
        },
        {
            label: labels.hub.metricJobs,
            value: viewer.jobs,
            icon: "/assets/dofus/game-icons/hammer.png",
        },
        {
            label: labels.hub.metricLevel,
            value: formatDofusLevel(viewer.level),
            icon: "/assets/dofus/game-icons/experience.png",
        },
        {
            label: labels.hub.metricSuccessPoints,
            value: viewer.successPoints ?? "—",
            icon: "/assets/dofus/modules/success.png",
        },
    ];

    return (
        <section className="reg-panel mt-8 p-4 sm:p-5" aria-label={labels.hub.viewerLabel}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    {classe ? <GameIcon src={classe.icon} className="size-12 shrink-0" /> : null}
                    <div className="min-w-0">
                        <p className="reg-eyebrow">{labels.hub.viewerEyebrow}</p>
                        <p className="mt-1 truncate text-lg font-semibold text-foreground">
                            {viewer.pseudo ?? labels.anonymous}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            {classe ? <span>{classe.name}</span> : null}
                            {server ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <GameIcon src={server.icon} className="size-4" />
                                    {server.name}
                                </span>
                            ) : null}
                        </p>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[22rem]">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="reg-panel px-3 py-2">
                            <dt className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
                                <GameIcon src={metric.icon} className="size-4 shrink-0" />
                                {metric.label}
                            </dt>
                            <dd className="reg-mono mt-1 text-lg font-semibold text-foreground">
                                {metric.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href="/espace-visiteur/general" className="reg-btn reg-btn-secondary">
                    {labels.hub.editProfile}
                </Link>
                {viewer.showOnDirectory ? (
                    <Link
                        href={visitorProfileHref({ id: viewer.profileId, pseudo: viewer.pseudo })}
                        className="reg-link text-sm"
                    >
                        {labels.hub.viewPublicProfile}
                    </Link>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {labels.hub.notListed}{" "}
                        <Link href="/espace-visiteur/reglages" className="reg-link">
                            {labels.hub.optIn}
                        </Link>
                    </p>
                )}
            </div>
        </section>
    );
}
