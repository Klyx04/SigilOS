import Link from "next/link";
// import { AuroraBackground } from "@/components/ui/aurora-background";

export default function IntroPage() {
    return (
        <div className="relative">
            {/* <AuroraBackground className="absolute -inset-10 opacity-20 pointer-events-none" /> */}

            <div className="relative z-10">
                <h1 className="text-4xl font-bold mb-6 text-white">Introduction à SigilOS</h1>
                <p className="lead text-xl text-zinc-200 mb-8">
                    Bienvenue dans la documentation officielle de SigilOS, le système d'exploitation pour guildes Dofus.
                </p>

                <div className="space-y-6 text-zinc-300">
                    <p>
                        SigilOS est une plateforme conçue pour simplifier la gestion de votre guilde, le suivi de vos membres et l'organisation de vos activités en jeu (Missions, Songes Infinis, Quête de l'Ocre).
                    </p>

                    <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Pour qui est cette documentation ?</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong className="text-white">Nouveaux Membres :</strong> Apprenez à rejoindre votre guilde et configurer votre profil.</li>
                        <li><strong className="text-white">Meneurs & Officiers :</strong> Découvrez les outils d'administration et de gestion.</li>
                        <li><strong className="text-white">Développeurs :</strong> Comprenez l'architecture si vous souhaitez contribuer.</li>
                    </ul>

                    <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Comment contribuer ?</h2>
                    <p>
                        Cette documentation est "Open Source" au sein de la guilde. Si vous trouvez une erreur ou souhaitez ajouter un guide, contactez l'équipe de développement sur Discord.
                    </p>
                </div>

                <div className="not-prose mt-12 p-6 rounded-2xl bg-zinc-900 border border-white/10 flex items-center gap-6">
                    <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <span className="text-2xl">🚀</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Prêt à démarrer ?</h3>
                        <p className="text-sm text-zinc-400 mb-3">Passez à l'étape suivante pour rejoindre votre première guilde.</p>
                        <Link href="/docs/guilds/join" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                            Lire le guide →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
