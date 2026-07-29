import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
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
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-8 md:p-12 md:pt-16 space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-400 uppercase tracking-widest">
                        <Database className="w-4 h-4" />
                        <span>Base de Quêtes</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        Quêtes Dofus <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-purple-400 to-purple-600">
                            Gestionnaire de Données
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Inspectez, éditez et compilez les chaînes de quêtes pour tous les Dofus.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="builder" className="w-full">
                <TabsList className="flex flex-wrap gap-2 w-full bg-transparent mb-8">
                    <TabsTrigger value="builder" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white bg-zinc-900/50 text-zinc-400 border border-white/5 rounded-xl px-6 py-3 font-black uppercase text-xs tracking-widest transition-all shadow-md">
                        <Database className="w-4 h-4 mr-2" />
                        Quest Builder
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white bg-zinc-900/50 text-zinc-400 border border-white/5 rounded-xl px-6 py-3 font-black uppercase text-xs tracking-widest transition-all shadow-md">
                        <Tag className="w-4 h-4 mr-2" />
                        Tags Dofus
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="builder" className="space-y-6 animate-in fade-in duration-500">
                    <DofusQuestGodManager />
                </TabsContent>

                <TabsContent value="tags" className="space-y-6 animate-in fade-in duration-500">
                    <div className="space-y-3">
                        <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">
                            Définissez les attributs de chaque Dofus : <strong className="text-white/70">Primordial</strong>, <strong className="text-white/70">Prérequis Sylvestre</strong>, <strong className="text-white/70">Méta</strong> et ordre d'affichage.
                            Ces tags pilotent directement l'interface utilisateur et les filtres côté membres.
                        </p>
                        <DofusTagManager />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}