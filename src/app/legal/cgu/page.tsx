import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function CGUPage() {
    return (
        <div className="relative min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30 flex flex-col">

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-8 h-8 transition-transform group-hover:scale-110 duration-300">
                        <Image src="/assets/ui/logo_sigilos_v2.png" alt="SigilOS" width={32} height={32} className="object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                    </div>
                    <span className="text-xl font-black tracking-widest text-white font-heading">
                        SIGIL<span className="text-purple-400">OS</span>
                    </span>
                </Link>
                <Link href="/" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour
                </Link>
            </header>

            <main className="flex-1 relative z-10 pt-32 pb-24 px-6">
                <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-30" />

                <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-4 mb-12">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                            Conditions Générales <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">d'Utilisation</span>
                        </h1>
                        <p className="text-lg text-zinc-400">Version Bêta Privée</p>
                    </div>

                    <GlassPanel className="p-8 md:p-12 border-white/5 bg-zinc-900/40 backdrop-blur-xl">
                        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-zinc-300 prose-strong:text-white prose-ul:text-zinc-300">
                            <p className="lead text-xl text-zinc-200">
                                Bienvenue sur <strong>SigilOS</strong>. En participant à la Bêta Privée, vous acceptez les règles du jeu suivantes.
                            </p>

                            <h3>1. Accès Bêta</h3>
                            <p>
                                SigilOS est en phase de développement actif ("Bêta"). L'accès est restreint aux guildes invitées via notre liste blanche.
                                Nous nous réservons le droit de révoquer un accès à tout moment si un abus est constaté ou pour des raisons techniques.
                            </p>

                            <h3>2. Service "En l'état"</h3>
                            <p>
                                Le service est fourni "tel quel". Des bugs peuvent survenir (c'est le principe d'une bêta).
                                Nous ne garantissons pas une disponibilité à 100%, bien que nous fassions de notre mieux pour maintenir la plateforme opérationnelle.
                            </p>

                            <h3>3. Fair Play & Sécurité</h3>
                            <p>
                                Il est strictement interdit de tenter de contourner les sécurités du site, d'injecter des données malveillantes ou de spammer les API.
                                Tout compte suspect sera immédiatement banni et signalé aux plateformes concernées (Discord).
                            </p>

                            <h3>4. Responsabilité</h3>
                            <p>
                                SigilOS n'est pas affilié à Ankama Games. Les images et noms du jeu Dofus sont la propriété d'Ankama Games.
                                SigilOS est un outil communautaire développé par des passionnés pour des passionnés.
                            </p>
                        </div>
                    </GlassPanel>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
