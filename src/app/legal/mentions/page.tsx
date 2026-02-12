import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function MentionsPage() {
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
                            Mentions <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Légales</span>
                        </h1>
                    </div>

                    <GlassPanel className="p-8 md:p-12 border-white/5 bg-zinc-900/40 backdrop-blur-xl">
                        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-zinc-300 prose-strong:text-white">

                            <h3>1. Éditeur</h3>
                            <p>
                                Le site <strong>SigilOS</strong> est édité par l'équipe de développement SigilOS (Projet communautaire).<br />
                                <strong>Contact :</strong> Via le serveur Discord officiel uniquement.
                            </p>

                            <h3>2. Hébergement</h3>
                            <p>
                                <strong>OVH SAS</strong><br />
                                2 rue Kellermann<br />
                                59100 Roubaix - France<br />
                                <a href="https://www.ovhcloud.com" target="_blank" className="text-indigo-400 hover:text-indigo-300 no-underline">www.ovhcloud.com</a>
                            </p>

                            <h3>3. Propriété Intellectuelle</h3>
                            <p>
                                Le code source de SigilOS est privé (sauf mention contraire). Toute reproduction, modification ou distribution non autorisée est interdite.
                                Les assets graphiques, logos et noms issus de l'univers <strong>Dofus</strong> sont la propriété exclusive d'<strong>Ankama Games</strong>.
                            </p>
                        </div>
                    </GlassPanel>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
