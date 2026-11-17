import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { Database, Tag } from "lucide-react";
import DofusQuestGodManager from "@/components/admin/DofusQuestGodManager";
import { DofusTagManager } from "@/components/admin/DofusTagManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = {
    title: "GOD | Quêtes Dofus — Gestionnaire de Données",
    description: "Interface super-admin pour gérer les chaînes de quêtes de chaque Dofus",
};

export default async function QuestsDofusGodPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    // P2 — un sous-god avec la brique "game-data-quetes" accède aussi (sinon super-admin).
    const isAdmin = await isSuperAdmin() || await canAccessBrick("game-data-quetes");
    if (!isAdmin) redirect("/");

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-border pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs font-semibold text-accent uppercase tracking-wide">
                        <Database className="w-4 h-4" />
                        <span>Base de Quêtes</span>
                    </div>
                    <h1 className="text-display-xl md:text-[32px] font-bold text-foreground font-heading tracking-tight leading-tight">
                        Quêtes Dofus · Gestionnaire de Données
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
                        Inspectez, éditez et compilez les chaînes de quêtes pour tous les Dofus.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="builder" className="w-full">
                <TabsList className="flex flex-wrap gap-2 w-full bg-transparent mb-8">
                    <TabsTrigger value="builder" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground bg-surface/50 text-muted-foreground border border-border rounded-lg px-5 py-2.5 font-medium text-sm transition-colors">
                        <Database className="w-4 h-4 mr-2" />
                        Quest Builder
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="data-[state=active]:bg-warning data-[state=active]:text-warning-foreground bg-surface/50 text-muted-foreground border border-border rounded-lg px-5 py-2.5 font-medium text-sm transition-colors">
                        <Tag className="w-4 h-4 mr-2" />
                        Tags Dofus
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="builder" className="space-y-6 animate-in fade-in duration-200">
                    <DofusQuestGodManager />
                </TabsContent>

                <TabsContent value="tags" className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-3">
                        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
                            Définissez les attributs de chaque Dofus : <strong className="text-foreground">Primordial</strong>, <strong className="text-foreground">Prérequis Sylvestre</strong>, <strong className="text-foreground">Méta</strong> et ordre d'affichage.
                            Ces tags pilotent directement l'interface utilisateur et les filtres côté membres.
                        </p>
                        <DofusTagManager />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}