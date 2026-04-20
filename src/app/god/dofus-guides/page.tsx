import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { db } from "@/lib/prisma";
import { Route, Navigation } from "lucide-react";
import OptimizedGuideAdminClient from "./OptimizedGuideAdminClient";

export const metadata = {
    title: "GOD | Guides Optimisés — Constructeur de Routes",
    description: "Interface super-admin pour construire les routes optimisées Dofus",
};

export default async function DofusGuidesGodPage() {
    const session = await auth();
    

    if (!session?.user?.id) redirect("/");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    // Load existing guides
    const guides = await db.optimizedGuide.findMany({
        include: {
            steps: {
                orderBy: { order: "asc" },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    // Load available Dofus items and their quests (for the drawer)
    const dofusItems = await db.dofusItem.findMany({
        include: {
            questChains: {
                include: {
                    entries: {
                        select: {
                            id: true,
                            name: true,
                            level: true,
                            zone: true,
                            stepOrder: true,
                            localImageUrl: true,
                        },
                        orderBy: { stepOrder: "asc" },
                    },
                },
                orderBy: { chainOrder: "asc" },
            },
        },
        orderBy: { displayOrder: "asc" },
    });

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-400 uppercase tracking-widest">
                        <Navigation className="w-4 h-4" />
                        <span>Routes Planifiées</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        Guides Optimisés <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-600">
                            Constructeur de Routes
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Créez des itinéraires parfaits pour les joueurs. Regroupez les quêtes de différents Dofus dans des Étapes logiques et ordonnées.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-black text-emerald-400 tabular-nums">{guides.length}</div>
                        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Guides</div>
                    </div>
                </div>
            </div>

            <div className="min-h-[600px]">
                <OptimizedGuideAdminClient initialGuides={guides} dofusItems={dofusItems} />
            </div>
        </div>
    );
}
