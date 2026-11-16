import Link from "next/link";
import { CalendarDays, Eye, EyeOff, Users } from "lucide-react";
import { GameIcon } from "@/components/shared/game-icon";
import { formatDofusLevel } from "@/lib/dofus-level";
import { getClass } from "@/lib/dofus-assets";
import { ALL_DOFUS_SERVER_ENTRIES, resolveDofusServerName } from "@/lib/presentation-constants";
import { VISITOR_ONBOARDING_TOUR_STORAGE_KEY } from "@/lib/public-tour";
import { db } from "@/lib/prisma";
import { loadPublicProfileView, requirePublicSession } from "@/server/public-account";
import { CreateProfileForm } from "../_components/create-profile-form";
import { IdentityForm } from "../_components/identity-form";
import { MetamobForm } from "../_components/metamob-form";
import { VisitorOcreCard } from "../_components/visitor-ocre-card";
import { VisitorSection } from "../_components/visitor-section";
import { VisitorTourLauncher } from "../_components/visitor-tour-launcher";

export const metadata = {
    title: "Général — espace visiteur | SigilOS",
    description: "Ton serveur, ton pseudo, ta classe et ton nom de guilde déclaré.",
};

/** Onglet Général : la **seule** page qui accepte l'absence de profil (écran de création). */
export default async function GeneralPage() {
    const { userId, displayName } = await requirePublicSession();
    const profile = await loadPublicProfileView(userId);

    if (!profile) {
        return (
            <>
                {/* Visite de création : trois pas dont les ancres existent sur cet
                    écran (la visite complète attend le profil, cf. `public-tour.ts`). */}
                <VisitorTourLauncher
                    phase="visitorOnboarding"
                    storageKey={VISITOR_ONBOARDING_TOUR_STORAGE_KEY}
                />
                <CreateProfileForm displayName={displayName} />
            </>
        );
    }

    const classe = profile.classe ? getClass(profile.classe) : undefined;
    const server = ALL_DOFUS_SERVER_ENTRIES.find((entry) => entry.id === profile.dofusServerId);
    const className = classe?.name ?? "Classe non renseignée";
    const serverName = resolveDofusServerName(null, String(profile.dofusServerId));

    // Compteurs **tous personnages** : une réussite cochée sur le principal et sur une mule
    // ne doit pas compter deux fois dans le résumé.
    const [dungeonRows, bountyRows, professionCount] = await Promise.all([
        db.publicDungeonAchievement.findMany({
            where: { publicProfileId: profile.id },
            select: { dungeonAchievementId: true },
            distinct: ["dungeonAchievementId"],
            take: 2000,
        }),
        db.publicBountyCompletion.findMany({
            where: { publicProfileId: profile.id },
            select: { bountyId: true },
            distinct: ["bountyId"],
            take: 500,
        }),
        db.publicProfession.count({ where: { publicProfileId: profile.id } }),
    ]);

    const achievementsDone = dungeonRows.length;
    const bountiesDone = bountyRows.length;
    const levelLabel =
        profile.dofusLevel == null ? "—" : formatDofusLevel(profile.dofusLevel);
    const pointsLabel =
        profile.successPoints == null
            ? "—"
            : new Intl.NumberFormat("fr-FR").format(profile.successPoints);
    const updatedLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
        profile.updatedAt
    );

    const stats = [
        { label: "Niveau Dofus", value: levelLabel },
        { label: "Points de succès", value: pointsLabel },
        { label: "Succès cochés", value: achievementsDone },
        { label: "Avis faits", value: bountiesDone },
    ];

    const visibility = [
        {
            label: "Annuaire",
            visible: profile.showOnDirectory,
            description: "Ton profil apparaît dans la communauté SigilOS.",
        },
        {
            label: "Présence en ligne",
            visible: profile.showPresence,
            description: "Les autres visiteurs peuvent voir que tu es en ligne.",
        },
        {
            label: "Progression de rush",
            visible: profile.showRushProgress,
            description: "Tes blocs et donjons de rush sont partagés.",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Visite de première arrivée : une seule fois par navigateur, rejouable
                depuis Réglages. Aucun rendu, aucun déplacement de bloc. */}
            <VisitorTourLauncher />

            {/* Hero personnel : identité + chiffres réels, sans donnée inventée. */}
            <header className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <span className="grid size-16 shrink-0 place-items-center rounded-xl border border-border bg-background p-2">
                            {classe?.icon ? (
                                <GameIcon src={classe.icon} className="size-12" />
                            ) : (
                                <Users className="size-8 text-muted-foreground" aria-hidden="true" />
                            )}
                        </span>
                        <div className="min-w-0">
                            <p className="reg-eyebrow">Espace perso</p>
                            <h1 className="mt-1 truncate text-2xl font-semibold text-foreground">
                                {profile.pseudoDofus ?? "Pseudo non renseigné"}
                            </h1>
                            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>{className}</span>
                                {server ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <GameIcon src={server.icon} className="size-4" />
                                        {server.name}
                                    </span>
                                ) : (
                                    <span>{serverName}</span>
                                )}
                                {profile.declaredGuildName ? (
                                    <span>Guilde déclarée · {profile.declaredGuildName}</span>
                                ) : null}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/espace-visiteur/succes" className="reg-btn reg-btn-secondary">
                            Succès & avis
                        </Link>
                        <Link href="/espace-visiteur/reglages" className="reg-link text-sm">
                            Réglages
                        </Link>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 border-t border-border p-5 sm:grid-cols-4 sm:p-6">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-lg border border-border bg-background/60 px-3 py-2.5"
                        >
                            <dt className="text-[11px] leading-tight text-muted-foreground">
                                {stat.label}
                            </dt>
                            <dd className="reg-mono mt-1 text-xl font-semibold text-foreground">
                                {stat.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </header>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <VisitorSection
                    title="Ma progression"
                    description="Le résumé de ce que tu as déclaré dans ton espace visiteur."
                >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
                            <p className="text-[11px] text-muted-foreground">Métiers déclarés</p>
                            <p className="reg-mono mt-1 text-lg font-semibold text-foreground">
                                {professionCount}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
                            <p className="text-[11px] text-muted-foreground">Mules déclarées</p>
                            <p className="reg-mono mt-1 text-lg font-semibold text-foreground">
                                {profile.altPseudos.length}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
                            <p className="text-[11px] text-muted-foreground">Avis faits</p>
                            <p className="reg-mono mt-1 text-lg font-semibold text-foreground">
                                {bountiesDone}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link href="/espace-visiteur/succes" className="reg-link text-sm">
                            Cocher mes succès et mes avis
                        </Link>
                        <Link href="/espace-visiteur/metiers" className="reg-link text-sm">
                            Gérer mes métiers
                        </Link>
                        <Link href="/visiteurs" className="reg-link text-sm">
                            Voir la communauté SigilOS
                        </Link>
                    </div>
                </VisitorSection>

                <VisitorSection
                    title="Ma visibilité"
                    description="Trois consentements distincts, réglables à tout moment."
                >
                    <ul className="space-y-2.5">
                        {visibility.map((entry) => (
                            <li key={entry.label} className="flex items-start gap-2.5">
                                {entry.visible ? (
                                    <Eye className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                                ) : (
                                    <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                        {entry.label} · {entry.visible ? "visible" : "masqué"}
                                    </p>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        {entry.description}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <Link href="/espace-visiteur/reglages" className="reg-link mt-3 inline-block text-sm">
                        Modifier mes réglages
                    </Link>
                </VisitorSection>
            </div>

            <div data-tour="visitor-identity">
                <IdentityForm
                    serverId={profile.dofusServerId}
                    pseudoDofus={profile.pseudoDofus}
                    classe={profile.classe}
                    declaredGuildName={profile.declaredGuildName}
                />
            </div>

            {profile.hasMetamobApiKey ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <VisitorOcreCard />
                    <div data-tour="visitor-metamob">
                        <MetamobForm
                            metamobPseudo={profile.metamobPseudo}
                            hasKey={profile.hasMetamobApiKey}
                            verified={profile.metamobVerified}
                        />
                    </div>
                </div>
            ) : (
                <div data-tour="visitor-metamob">
                    <MetamobForm
                        metamobPseudo={profile.metamobPseudo}
                        hasKey={profile.hasMetamobApiKey}
                        verified={profile.metamobVerified}
                    />
                </div>
            )}

            <p className="reg-mono flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Profil mis à jour le {updatedLabel}
            </p>
        </div>
    );
}
