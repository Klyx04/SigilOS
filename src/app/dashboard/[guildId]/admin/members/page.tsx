import { Suspense } from "react";
import { getUserContext, getGuildMemberStats } from "@/server/actions/user-actions";
import { getGuildLifecycleData, getMemberRegistryDiscordIndex } from "@/server/actions/member-lifecycle-actions";
import { redirect } from "next/navigation";
import MemberManagement from "@/components/admin/members/member-management";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildMemberRoster, DEFAULT_TRIAL_DURATION_DAYS, mergeExclusions, rosterCounts, type RosterExclusion } from "@/lib/member-roster";
import { getGuildMemberBans } from "@/server/actions/lifecycle-actions";
import { roleHasDashboardAccess } from "@/lib/permissions";

export const metadata = {
    title: "Membres & Recrutement | SigilOS",
    description: "Audit, registre du staff, essais, mules et gestion des profils membres.",
};

interface AdminMembersPageProps {
    params: Promise<{
        guildId: string;
    }>;
    searchParams: Promise<{ tab?: string }>;
}

export default async function AdminMembersPage({ params, searchParams }: AdminMembersPageProps) {
    const { guildId } = await params;
    const { tab } = await searchParams;

    // 🔒 RBAC **avant** toute lecture. Mesure du 01/11/2026 (`JAVASCRIPT-NEXTJS-2B`,
    // `GET /dashboard/<guildId>/admin/members`) : `getGuildMemberStats` levait
    // `Unauthorized` quand la session manquait, et comme elle partait dans le même
    // `Promise.all` que `getUserContext`, la redirection n'avait pas le temps de
    // s'appliquer ⇒ **500** au lieu d'un retour au dashboard. Le contexte est donc
    // résolu **seul**, la garde s'applique, et les lectures ne partent qu'après.
    const ctx = await getUserContext(guildId);

    // RBAC : Admin, Gestion des membres ou Relances.
    if (!ctx.isAdmin && !ctx.canManageMembers && !ctx.canManageRelance) {
        redirect(`/dashboard/${guildId}`);
    }

    const [stats, lifecycle, discordIndex, guildConfig, memberBans] = await Promise.all([
        getGuildMemberStats(guildId),
        getGuildLifecycleData(guildId),
        getMemberRegistryDiscordIndex(guildId),
        db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { welcomeBadgeName: true, ownerId: true, rolesMapping: true, inGameGuildRoleIds: true },
        }),
        // F-01 — exclusions (tombstones). Fail-closed : une permission absente renvoie
        // `success: false`, on affiche alors la liste sans les exclusions plutôt que de mentir.
        getGuildMemberBans(guildId),
    ]);

    const lifecycleData = lifecycle.success ? lifecycle.data : null;
    const indexData = discordIndex.success ? discordIndex.data : null;

    // Fusion des trois vues : une ligne par personne (profil dashboard **ou** hors dashboard).
    const profileById = new Map<string, NonNullable<typeof lifecycleData>["members"][number]>();
    for (const member of [
        ...(lifecycleData?.members ?? []),
        ...(lifecycleData?.trialMembers ?? []),
        ...(lifecycleData?.departedMembers ?? []),
    ]) {
        profileById.set(member.id, member);
    }

    const rows = buildMemberRoster({
        profiles: [...profileById.values()].map((member) => ({
            profileId: member.id,
            userId: member.userId,
            discordId: member.discordId || null,
            displayName: member.displayName,
            avatar: member.avatar,
            status: member.status,
            pseudoDofus: member.pseudoDofus,
            discordNickname: member.discordNickname,
            ankamaId: member.ankamaId,
            joinedAt: member.joinedAt,
            seniorityDays: member.seniorityDays,
            trialValidated: member.trialValidated,
            trialEndsAt: member.trialEndsAt,
            trialRemainingDays: member.trialRemainingDays,
            recruitedById: member.recruitedById,
            recruiterName: member.recruiterName,
            recruiterAvatar: member.recruiterAvatar,
            mules: member.mules,
            comments: member.comments,
            vacationStart: member.vacationStart,
            vacationEnd: member.vacationEnd,
        })),
        discordOnly: (indexData?.discordOnly ?? []).map((member) => ({
            discordId: member.discordId,
            displayName: member.displayName,
            username: member.username,
            avatar: member.avatar,
            joinedAt: member.joinedAt,
            roles: member.roles,
            entry: member.entry
                ? {
                      pseudoDofus: member.entry.pseudoDofus,
                      ankamaId: member.entry.ankamaId,
                      guildJoinedAt: member.entry.guildJoinedAt,
                      trialValidated: member.entry.trialValidated,
                      trialEndsAt: member.entry.trialEndsAt,
                      mules: member.entry.mules,
                      comments: member.entry.comments,
                  }
                : null,
            recruiterId: member.entry?.recruitedById ?? null,
            recruiterName: member.recruiterName,
            recruiterAvatar: member.recruiterAvatar,
            seniorityDays: member.seniorityDays,
        })),
        rolesByProfileId: indexData?.rolesByProfileId ?? {},
        trialDurationDays: lifecycleData?.config.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS,
    });

    // ── Exclusions actives (F-01) — source `GuildMemberBan` ─────────────────────────────────
    // Un exclu dont le profil a été purgé n'existait dans **aucune** ligne : le compteur
    // affichait 0 et seul le panneau God pouvait lever l'exclusion (mesure du 25/10/2026).
    // Pure règle testée : `mergeExclusions` (src/lib/member-roster.ts).
    const exclusions: RosterExclusion[] = memberBans.success
        ? (
              memberBans.data as {
                  discordId: string;
                  memberName: string | null;
                  reason: string;
                  createdAt: Date | string;
                  liftedAt: Date | string | null;
              }[]
          )
              .filter((ban) => !ban.liftedAt)
              .map((ban) => ({
                  discordId: ban.discordId,
                  memberName: ban.memberName ?? null,
                  reason: ban.reason,
                  createdAt: new Date(ban.createdAt).toISOString(),
              }))
        : [];
    const rosterRows = mergeExclusions(rows, exclusions);

    if (lifecycleData === null || indexData === null) {
        logger.warn("[admin/members] Données partielles chargées", {
            lifecycle: lifecycle.success,
            discord: discordIndex.success,
        });
    }

    // Filtre de rôles : seuls les rôles **autorisés dashboard** (mappés dans le RBAC) sont proposés.
    // Un rôle sans permission n'ouvre aucune page : il ne filtre rien d'utile (mesure bêta du 14/10).
    // `rolesMapping` vide (RBAC non configuré) ⇒ aucune restriction — on n'invente pas une règle que
    // la guilde n'a pas posée. Les lignes « hors dashboard » ne sont pas concernées : elles restent
    // affichées et restent filtrables (statut, inscription, recherche, facette « Hors dashboard »).
    const rolesMapping = (guildConfig?.rolesMapping as Record<string, string[]> | null | undefined) ?? null;
    const dashboardRoleIds = (indexData?.roles ?? [])
        .map((role) => role.id)
        .filter((roleId) => roleHasDashboardAccess(rolesMapping, roleId));

    return (
        <div className="container mx-auto max-w-7xl px-4 py-6 lg:py-10">
            <div className="mb-6 flex items-start justify-between gap-4" data-tour="admin-members-header">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Membres &amp; Recrutement</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Une seule liste : audit Discord, registre du staff, essais, mules, archivage et relances.
                    </p>
                </div>
                <ModuleHelpActions
                    docSlug="admin-members"
                    docTitle="Audit & Gestion des Membres"
                    tourPhase="adminMembers"
                />
            </div>
            <Suspense fallback={<AdminMembersSkeleton />}>
                <div data-tour="admin-members-table">
                    <MemberManagement
                        guildId={guildId}
                        rows={rosterRows}
                        roles={indexData?.roles ?? []}
                        dashboardRoleIds={dashboardRoleIds}
                        inGameGuildRoleIds={guildConfig?.inGameGuildRoleIds ?? []}
                        stats={stats}
                        excludedCount={rosterCounts(rosterRows).banned}
                        discordAvailable={indexData?.discordAvailable ?? false}
                        welcomeBadgeName={guildConfig?.welcomeBadgeName || "Nouveau"}
                        isSuperAdmin={ctx.isSuperAdmin}
                        canManageMembers={!!(ctx.canManageMembers || ctx.isAdmin)}
                        canDeleteMembers={!!ctx.canDeleteMembers}
                        currentUserId={ctx.id || ""}
                        ownerId={guildConfig?.ownerId ?? null}
                        initialTab={tab === "anciennete" ? "anciennete" : tab === "registre" ? "registre" : undefined}
                    />
                </div>
            </Suspense>
        </div>
    );
}

function AdminMembersSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-10 w-full max-w-md rounded-lg bg-surface/50" />
            <div className="h-24 w-full rounded-lg border border-border bg-surface/40" />
            <div className="h-[420px] w-full rounded-lg border border-border bg-surface/20" />
        </div>
    );
}
