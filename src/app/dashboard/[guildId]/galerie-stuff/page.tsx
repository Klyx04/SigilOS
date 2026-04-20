import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getStuffGalleryPage, getSkinGalleryPage } from "@/server/actions/gallery-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { GalleryClient } from "./gallery-client";

export default async function GalleryStuffPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated) {
        redirect("/login");
    }

    if (!user.canViewStuffGallery || !await isModuleEnabled(guildId, "gallery")) {
        redirect(`/dashboard/${guildId}`);
    }

    const [stuffRes, skinRes] = await Promise.all([
        getStuffGalleryPage(guildId, 1),
        getSkinGalleryPage(guildId, 1) // Just to get the total and first batch (not used yet but total is)
    ]);

    if (!stuffRes.success || !stuffRes.data || !skinRes.success || !skinRes.data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
                    Erreur lors du chargement de la galerie.
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <GalleryClient
                initialBuilds={stuffRes.data.builds}
                initialTotal={stuffRes.data.total}
                initialHasMore={stuffRes.data.hasMore}
                initialStuffShareConfigured={stuffRes.data.isDiscordShareConfigured}
                initialSkinTotal={skinRes.data.total}
                guildId={guildId}
                currentProfileId={user.profileId}
            />
        </div>
    );
}
