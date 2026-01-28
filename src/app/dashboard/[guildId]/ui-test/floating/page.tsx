import { FloatingHUD } from "@/components/layout/ui-test/floating-hud";
import { Card } from "@/components/ui/card";

export default async function FloatingTestPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
            {/* Background Atmosphere */}
            <div className="fixed inset-0 pointer-events-none opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 text-center">
                <h2 className="text-6xl font-black italic tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-600">
                    FLOATING HUD
                </h2>

                <p className="text-zinc-400 max-w-xl text-lg mb-12 leading-relaxed">
                    Une interface libérée de toute contrainte latérale ou supérieure. La navigation flotte doucement en bas de l'écran, accessible uniquement quand vous en avez besoin.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl text-left">
                    <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 backdrop-blur-3xl hover:border-primary/20 transition-colors">
                        <span className="text-primary font-mono text-xs tracking-widest uppercase mb-4 block">Avantage Unique</span>
                        <h3 className="text-2xl font-bold mb-3 italic">Immersion Absolue</h3>
                        <p className="text-zinc-500 leading-relaxed font-medium">
                            Parfait pour les interfaces visuelles riches ou les listes denses. Rien ne vient interrompre le regard.
                        </p>
                    </div>

                    <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 backdrop-blur-3xl hover:border-amber-500/20 transition-colors">
                        <span className="text-amber-500 font-mono text-xs tracking-widest uppercase mb-4 block">Expérience Mobile</span>
                        <h3 className="text-2xl font-bold mb-3 italic">Thumb-Friendly</h3>
                        <p className="text-zinc-500 leading-relaxed font-medium">
                            La navigation en bas est le standard ergonomique moderne. Idéal pour naviguer d'une seule main.
                        </p>
                    </div>
                </div>
            </main>

            <FloatingHUD guildId={guildId} />
        </div>
    );
}
