import { GalacticFooter } from "@/components/layout/galactic-footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
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

            <main className="flex-1 relative z-10 pt-32 pb-24 px-6 md:px-8">
                <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-30" />

                <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                    <div className="text-center space-y-4 mb-12">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                            Politique de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Confidentialité</span>
                        </h1>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-md flex gap-4 items-start">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-emerald-400 font-bold mb-1">En bref</h3>
                            <p className="text-emerald-200/80 text-sm leading-relaxed">
                                Nous ne vendons pas vos données. Nous ne stockons que le strict nécessaire pour gérer votre guilde et valider vos missions.
                                Votre vie privée est notre priorité.
                            </p>
                        </div>
                    </div>

                    <GlassPanel className="p-8 md:p-12 border-white/5 bg-zinc-900/40 backdrop-blur-xl">
                        <div className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:text-white prose-p:text-zinc-300 prose-ul:text-zinc-300">

                            <h3>1. Données Collectées</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Identifiant Discord :</strong> Utilisé uniquement pour l'authentification (via Auth.js) et la gestion de vos permissions.</li>
                                <li><strong>Pseudo & Avatar :</strong> Affichés sur votre profil de guilde public et privé.</li>
                                <li><strong>Screenshots de jeu :</strong> Uploadés temporairement pour la validation des missions. Ils peuvent être supprimés après traitement.</li>
                            </ul>

                            <h3>2. Cookies & Traceurs</h3>
                            <p>
                                Nous utilisons uniquement des cookies de session <strong>essentiels</strong> pour maintenir votre connexion sécurisée.
                                <br />
                                <span className="text-emerald-400 font-bold block mt-2">
                                    0 traceur publicitaire. 0 pixel Facebook/Google. 0 revente.
                                </span>
                            </p>

                            <h3>3. Vos Droits (RGPD)</h3>
                            <p>
                                Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et d'effacement de vos données ("Droit à l'oubli").
                                Vous pouvez exercer ce droit directement via les paramètres de votre compte (bouton "Supprimer mon compte") ou en contactant un administrateur sur Discord.
                            </p>

                            <h3>4. Hébergement & Sécurité</h3>
                            <p>
                                Vos données sont hébergées en <strong>France</strong> (OVHcloud) et protégées selon les standards de l'industrie (HTTPS, chiffrement, isolation).
                            </p>
                        </div>
                    </GlassPanel>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
