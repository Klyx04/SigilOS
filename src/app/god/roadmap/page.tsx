import { ScrollArea } from "@/components/ui/scroll-area";
import { Rocket } from "lucide-react";
import { RoadmapClient } from "./roadmap-client";
import { getRoadmapItems, getPlatformConfig } from "@/server/actions/god-roadmap-actions";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";

export default async function RoadmapGodPage() {
    // Fail-closed : réservé aux super-admins (le layout accepte désormais les sub-gods)
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");
    const [itemsRes, configRes] = await Promise.all([
        getRoadmapItems(),
        getPlatformConfig()
    ]);
    
    const items = itemsRes.success ? itemsRes.data : [];
    const isEnabled = configRes.success && configRes.data ? configRes.data.roadmapEnabled : false;

    return (
        <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto space-y-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <header className="space-y-4">
                    <h1 className="text-4xl font-black text-white flex items-center gap-3 tracking-tight">
                        <Rocket className="h-10 w-10 text-amber-500" />
                        ROADMAP <span className="text-amber-500">PRO</span>
                    </h1>
                    <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
                        Gestionnaire de Roadmap SigilOS. Vous pouvez configurer ici les priorités et rendre la roadmap publique pour les guildes.
                    </p>
                </header>

                <RoadmapClient initialItems={items as any} initialEnabled={isEnabled} />
            </div>
        </ScrollArea>
    );
}
