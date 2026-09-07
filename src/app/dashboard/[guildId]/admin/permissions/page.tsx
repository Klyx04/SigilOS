import { auth } from "@/auth";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { fetchGuild, fetchGuildRoles } from "@/server/discord";
import { PermissionsManager } from "@/app/dashboard/[guildId]/admin/_components/permissions-manager";
import { onboardGuild } from "@/server/actions/admin-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { getUserContext, getGuildMembers } from "@/server/actions/user-actions";
import { logAdminAccessDenied } from "@/server/actions/audit-actions";
import { type PermissionId } from "@/lib/permissions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";
import { AdminConsoleNav } from "@/components/admin/admin-console-nav";
import { Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function PermissionsPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;

    const user = await getUserContext(guildId);
    // #66bis : l'accès à la matrice est ouvert aux admins Discord natifs ET aux
    // détenteurs de la permission RBAC « Gestion des Accès » (system:rbac), ce qui
    // permet à une guilde de désigner un successeur même sans rôle Discord Admin.
    if (!user.canManageRBAC) {
        await logAdminAccessDenied(guildId, "/admin/permissions");
        return <AccessDenied />;
    }

    let config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
    });

    if (!config) {
        const res = await onboardGuild(guildId);
        if (!res.success) {
            // Détail technique loggé côté serveur uniquement — jamais renvoyé tel quel
            // (peut contenir des fragments d'erreur Discord).
            logger.error("[Permissions] Onboarding impossible", { guildId, error: res.error });
            return (
                <div className="p-6 text-danger">
                    <h2 className="text-xl font-bold">Initialisation impossible</h2>
                    <p>La configuration de la guilde n&apos;a pas pu être créée. Réessayez dans quelques instants ou contactez le staff.</p>
                </div>
            );
        }
        config = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
    }

    if (!config) return <div>Configuration introuvable après initialisation. Contactez le staff.</div>;

    let roles: any[] = [];
    let membersData: any = { members: [] };
    try {
        [roles, membersData] = await Promise.all([
            fetchGuildRoles(guildId),
            getGuildMembers(guildId)
        ]);
    } catch (e) {
        // Détail technique loggé côté serveur uniquement : l'ancien écran affichait
        // le nom du secret bot, le chemin .env et l'erreur brute (fuite d'infra).
        logger.error("[Permissions] Récupération Discord impossible", {
            guildId,
            error: e instanceof Error ? e.message : String(e),
        });
        // Serveur supprimé (ou bot expulsé) : pas de matrice à gérer — écran d'accès,
        // pas de page d'erreur technique.
        const guild = await fetchGuild(guildId).catch(() => null);
        if (!guild) {
            return <AccessDenied />;
        }
        return (
            <div className="p-6 flex flex-col gap-4">
                <h1 className="text-2xl font-bold text-danger">Connexion à Discord impossible</h1>
                <p className="text-muted-foreground">
                    Les rôles n&apos;ont pas pu être récupérés. Vérifiez que le bot est bien présent
                    sur le serveur, puis réessayez dans quelques instants. Si le problème persiste,
                    contactez le staff.
                </p>
            </div>
        );
    }

    const currentMapping = (config.rolesMapping || {}) as Record<string, PermissionId[]>;
    const currentUsersMapping = ((config as any).usersMapping || {}) as Record<string, PermissionId[]>;

    // Chantier #72 — kill-switch God « Membres Spécifiques » : quand la plateforme
    // désactive les permissions individuelles, on masque les sélecteurs par membre
    // (lecture seule) et l'écriture est rejetée côté serveur (fail-closed).
    const { getRbacUsersMappingEnabled } = await import("@/lib/platform-rbac");
    const rbacUsersMappingEnabled = await getRbacUsersMappingEnabled();

    // Refonte onboarding §9 — permissions des modules désactivés (toggle guilde
    // OFF ou verrou God) masquées de la matrice, mappings conservés en BDD.
    const { getGuildModules } = await import("@/server/actions/module-actions");
    const { getPermissionsHiddenByModules } = await import("@/lib/permissions");
    const effectiveModules = await getGuildModules(guildId);
    const hiddenPermissions = getPermissionsHiddenByModules(
        effectiveModules as unknown as Record<string, boolean | undefined>
    );

    return (
        <div className="space-y-8 pb-12">
            <div data-tour="admin-permissions-header">
                <UnifiedModuleHeader
                    title="Permissions & Commandes"
                    description={`Attribuez les droits aux rôles Discord et aux membres de ${config.name}`}
                    icon={Shield}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<ModuleHelpActions docSlug="admin-permissions" docTitle="Rôles & Permissions" tourPhase="adminPermissions" />}
                />
            </div>

            <AdminConsoleNav
                guildId={guildId}
                showModules={user.isDiscordAdmin}
                showAccess={true}
                showOnboarding={user.isAdmin}
                showPilotage={user.isDiscordAdmin}
            />
            <Alert className="bg-warning/10 border-warning/20 text-warning mb-8">
                <AlertTriangle className="h-5 w-5 !text-warning" />
                <AlertTitle className="pl-8 font-black uppercase tracking-widest text-warning">Accès restreint : qui peut gérer les permissions ?</AlertTitle>
                <AlertDescription className="pl-8 mt-2 leading-relaxed text-warning/90 font-medium">
                    Deux profils peuvent gérer cette matrice : les <strong>Administrateurs Discord</strong> (propriétaire ou permission native) et les détenteurs de la permission RBAC <strong>« Gestion des Accès »</strong> (<code>system:rbac</code>) — donnée par un administrateur pour désigner un successeur. Les permissions <strong>« Administrateur Suprême »</strong> et <strong>« Gestion des Accès »</strong> elles-mêmes restent réservées aux administrateurs Discord : un gestionnaire délégué ne peut pas les octroyer ni les révoquer (anti-escalade).
                </AlertDescription>
            </Alert>

            <div data-tour="admin-permissions-matrix">
                                <PermissionsManager
                                    guildId={guildId}
                                    roles={roles}
                                    members={membersData.members || []}
                                    currentMapping={currentMapping}
                                    currentUsersMapping={currentUsersMapping}
                                    usersMappingEnabled={rbacUsersMappingEnabled}
                                    hiddenPermissions={hiddenPermissions}
                                    moduleStates={effectiveModules as unknown as Record<string, boolean>}
                                />
            </div>

            {/* #158 — Les commandes Slash Discord se gèrent sur la page dédiée
                /admin/commandes (source unique). Ce bloc n'est qu'un raccourci
                pour éviter deux matrices divergentes. */}
            <div className="pt-8 border-t border-border">
                <Link
                    href={`/dashboard/${guildId}/admin/commandes`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                >
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">
                            Commandes Slash Discord
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Rôles et salons autorisés à exécuter les commandes du bot — gérés sur la page dédiée.
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-border px-4 py-2 text-caption font-bold uppercase tracking-wider text-foreground">
                        Gérer →
                    </span>
                </Link>
            </div>
        </div>
    );
}
