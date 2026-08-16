import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getDjPosts, getDjChannelConfigured } from "@/server/actions/dungeon-finder-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import AccessDenied from "@/components/access-denied";
import { DungeonFinderClient } from "@/components/dungeon-finder/DungeonFinderClient";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { ModuleTourReplayButton } from "@/components/tour/module-tour-replay-button";

export const metadata = {
    title: "Donjons & Quêtes | SigilOS",
    description: "Trouvez des compagnons pour vos donjons et gérez vos succès.",
};

export default async function FinderPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    // Module guard
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) {
        return <AccessDenied />;
    }

    if (!user.isAdmin && !(await isModuleEnabled(guildId, "donjons"))) {
        redirect(`/dashboard/${guildId}`);
    }

    // Fetch initial posts + DJ settings (SSR)
    const [postsResult, isDiscordConfigured] = await Promise.all([
        getDjPosts(guildId, {}),
        getDjChannelConfigured(guildId),
    ]);
    const initialPosts: DjPostWithDetails[] = postsResult.success ? (postsResult.data ?? []) : [];

    // Server Action bound to this guild (passed to client for refresh)
    async function refreshPosts(): Promise<DjPostWithDetails[]> {
        "use server";
        const res = await getDjPosts(guildId, {});
        return res.success ? (res.data ?? []) : [];
    }

    return (
        <div className="space-y-6 pb-12">
            <div data-tour="donjons-header">
                <UnifiedModuleHeader
                    title="Donjons & Quêtes"
                    description="Cherchez des coéquipiers, ciblez des succès, et suivez votre progression."
                    icon={Swords}
                    iconColor="#ffffff"
                    backHref={`/dashboard/${guildId}`}
                    actions={<ModuleTourReplayButton phase="donjons" />}
                />
            </div>

            <Suspense
                fallback={
                    <div className="h-64 flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest animate-pulse">
                        Synchronisation Tactique…
                    </div>
                }
            >
                <div data-tour="donjons-board">
                    <DungeonFinderClient
                        guildId={guildId}
                        initialPosts={JSON.parse(JSON.stringify(initialPosts))}
                        currentProfileId={user.profileId ?? undefined}
                        isAdmin={user.isAdmin}
                        refreshPosts={refreshPosts}
                        isDiscordConfigured={isDiscordConfigured}
                    />
                </div>
            </Suspense>
        </div>
    );
}

