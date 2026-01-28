import { SpatialCard } from "@/components/layout/spatial-card";
import { NebulaClientWrapper } from "@/components/layout/nebula-client-wrapper";
import {
    Zap,
    Shapes,
    Sparkles,
    Layers,
    Move3d,
    Dna
} from "lucide-react";

export default async function NebulaTestPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    return (
        <NebulaClientWrapper>
            <div className="min-h-screen bg-[#020202] text-white selection:bg-primary/30 font-sans overflow-x-hidden">
                {/* Background 2026 Effects */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[160px] animate-pulse-slow" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[160px]" />
                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
                </div>

                {/* Simple test header (GalacticHeader requires more data) */}
                <header className="fixed top-0 left-0 right-0 z-50 p-6 bg-transparent">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <span className="text-xl font-bold text-white">Nebula Test Page</span>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto pt-48 pb-24 px-6 relative z-10">
                    <div className="flex flex-col items-center text-center mb-24">
                        <div className="px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            État de l'Art - Janvier 2026
                        </div>

                        <h1 className="text-8xl font-black italic tracking-tighter mb-8 leading-[0.8] animate-in fade-in slide-in-from-bottom-8 duration-700">
                            NEBULA <br />
                            <span className="text-zinc-800 outline-glow">SPATIAL HUD</span>
                        </h1>

                        <p className="max-w-2xl text-xl text-zinc-500 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-12 duration-1000">
                            Le futur de SigilOS est spatial. Une interface vivante qui s'adapte à votre contexte, propulsée par le verre Onyx et le chrome liquide.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <SpatialCard
                            title="DYNAMIC ISLAND"
                            desc="La barre de navigation n'est plus statique. Elle respire, s'étend et se contracte selon vos besoins."
                            icon={Shapes}
                            colorClass="text-primary"
                        />
                        <SpatialCard
                            title="Z-AXIS DEPTH"
                            desc="Les interfaces 2D sont mortes. Chaque élément possède une profondeur physique et réagit au mouvement."
                            icon={Move3d}
                            colorClass="text-purple-500"
                        />
                        <SpatialCard
                            title="ONYX GLASS"
                            desc="Un matériau premium développé pour 2026. Sombre, brillant et parfaitement translucide."
                            icon={Layers}
                            colorClass="text-zinc-100"
                        />
                        <SpatialCard
                            title="LIQUID CHROME"
                            desc="Des micro-interactions fluides comme du mercure sous vos doigts. Tactile Maximalism à l'état pur."
                            icon={Sparkles}
                            colorClass="text-amber-500"
                        />
                        <SpatialCard
                            title="AI CONTEXT"
                            desc="L'interface sait ce que vous voulez faire avant même que vous ne cliquiez. Expérience prédictive."
                            icon={Dna}
                            colorClass="text-emerald-500"
                        />
                        <SpatialCard
                            title="NEXT-GEN"
                            desc="Le standard de performance ultime pour les guildes les plus ambitieuses de Dofus."
                            icon={Zap}
                            colorClass="text-blue-500"
                        />
                    </div>

                    <div className="mt-32 p-20 rounded-[60px] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 backdrop-blur-3xl text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Zap className="h-64 w-64 text-primary" />
                        </div>

                        <h2 className="text-5xl font-black italic tracking-tighter mb-6">PRÊT POUR LE FUTUR ?</h2>
                        <p className="text-zinc-500 max-w-xl mx-auto mb-10 text-lg">
                            Ce concept représente l'apogée de notre vision pour SigilOS. Une interface qui ne se contente pas d'afficher des données, mais qui crée une expérience.
                        </p>
                        <button className="h-16 px-12 rounded-full bg-white text-black font-black italic text-lg hover:scale-105 transition-transform">
                            ADOPTER NEBULA
                        </button>
                    </div>
                </main>
            </div>
        </NebulaClientWrapper>
    );
}
