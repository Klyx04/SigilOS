import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getStuffGalleryPage } from "@/server/actions/gallery-actions";
import { GalleryClient } from "./gallery-client";

export default async function GalleryStuffPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated) {
        redirect("/login");
    }

    if (!user.canViewStuffGallery) {
        redirect(`/dashboard/${guildId}`);
    }

    const res = await getStuffGalleryPage(guildId, 1);
    if (!res.success || !res.data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
                    Erreur: {res.error}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <GalleryClient
                initialBuilds={res.data.builds}
                initialTotal={res.data.total}
                initialHasMore={res.data.hasMore}
                guildId={guildId}
            />
        </div>
    );
}
