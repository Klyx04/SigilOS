"use server";

import { getUserContext } from "@/server/actions/user-actions";
import { getWelcomePosts } from "@/server/actions/onboarding-admin-actions";
import { WelcomeFeedClient } from "./_components/welcome-feed-client";
import { MessageSquare, Sparkles } from "lucide-react";
import { AccessDenied } from "@/components/layout/access-denied";

export default async function WelcomePage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    // SECURITY: RBAC guard — requires welcome:view permission
    if (!user.canViewWelcome) {
        return (
            <AccessDenied
                title="Accès Restreint"
                message="Votre rôle Discord ne vous donne pas accès à cette page. Contactez un administrateur."
                variant="lock"
            />
        );
    }

    const posts = await getWelcomePosts(guildId);


    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                        <Sparkles className="w-3 h-3" /> Accueil & Intros
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        Bienvenue !
                    </h1>
                    <p className="text-sm text-zinc-500 max-w-xl">
                        Un espace pour accueillir nos nouveaux membres et faire connaissance.
                    </p>
                </div>
            </div>

            {/* Feed Section */}
            <div className="max-w-3xl mx-auto">
                {posts.length === 0 ? (
                    <div className="p-12 rounded-2xl border border-white/5 bg-zinc-900/40 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                            <MessageSquare className="w-6 h-6 text-zinc-500" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-zinc-400 font-bold">Aucun message de bienvenue</p>
                            <p className="text-xs text-zinc-600">Les nouveaux membres s'afficheront ici quand ils rejoindront la guilde.</p>
                        </div>
                    </div>
                ) : (
                    <WelcomeFeedClient
                        initialPosts={JSON.parse(JSON.stringify(posts))}
                        currentProfileId={user.profileId || ""}
                        guildId={guildId}
                    />
                )}
            </div>
        </div>
    );
}
