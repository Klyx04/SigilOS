import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { LandingScreensClient } from "./LandingScreensClient";
import { Image as ImageIcon } from "lucide-react";

export const metadata = {
    title: "GOD | Landing Screens",
    description: "Interface super-admin pour piloter les captures d'écran de la landing",
};

export default async function GodLandingPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                        <ImageIcon className="w-4 h-4" />
                        <span>Landing</span>
                    </div>
                    <h1 className="text-display-xl md:text-[32px] font-bold text-white font-heading tracking-tight leading-tight">
                        Screens de la landing
                    </h1>
                    <p className="text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed">
                        Upload, masquage et ordre des captures affichées sur sigilos.fr — sans toucher au code.
                    </p>
                </div>
            </div>

            <LandingScreensClient />
        </div>
    );
}
