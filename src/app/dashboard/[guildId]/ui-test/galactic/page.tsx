import { GalacticHeader } from "@/components/layout/ui-test/galactic-header";
import { getUserContext } from "@/server/actions/user-actions";
import { Card } from "@/components/ui/card";

export default async function GalacticTestPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const user = await getUserContext(guildId);

    return (
        <div className="min-h-screen bg-[#020202] text-white">
            <GalacticHeader guildId={guildId} user={user} />

            <main className="pt-24 px-6 max-w-7xl mx-auto">
                <div className="mb-12">
                    <h2 className="text-4xl font-black italic tracking-tighter mb-2">GALACTIC HEADER</h2>
                    <p className="text-zinc-500">Concept de navigation supérieure inspiré des interfaces de jeux FPS modernes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 bg-zinc-900/50 border-white/5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 text-primary">
                            <span className="text-xl font-bold">1</span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">Zéro Encombrement</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">Libère les côtés de l'écran pour une immersion maximale dans les données de guilde.</p>
                    </Card>

                    <Card className="p-6 bg-zinc-900/50 border-white/5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
                            <span className="text-xl font-bold">2</span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">Visibilité Immédiate</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">Les statistiques clés (XP, Missions) sont toujours visibles dans le HUD supérieur.</p>
                    </Card>

                    <Card className="p-6 bg-zinc-900/50 border-white/5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4 text-purple-500">
                            <span className="text-xl font-bold">3</span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">Focus Contenu</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">Idéal pour les pages complexes comme la Bourse aux Archis ou le Ladder.</p>
                    </Card>
                </div>

                {/* Section "Demo Content" */}
                <div className="mt-12 p-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center animate-pulse mb-4">
                        <div className="h-4 w-4 bg-primary rounded-full" />
                    </div>
                    <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Zone de contenu 100% Largeur</span>
                </div>
            </main>
        </div>
    );
}
