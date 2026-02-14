import { DocContent } from "@/components/doc/doc-content";
import Link from "next/link";

const INTRO_CONTENT = `
# Introduction à SigilOS

<p class="lead">Bienvenue dans la documentation officielle de SigilOS, le système d'exploitation pour guildes Dofus.</p>

SigilOS est une plateforme conçue pour simplifier la gestion de votre guilde, le suivi de vos membres et l'organisation de vos activités en jeu (Missions, Songes Infinis, Quête de l'Ocre).

## Pour qui est cette documentation ?
- **Nouveaux Membres** : Apprenez à rejoindre votre guilde et configurer votre profil.
- **Meneurs & Officiers** : Découvrez les outils d'administration et de gestion.
- **Développeurs** : Comprenez l'architecture si vous souhaitez contribuer.

<div class="callout callout-info">
<strong>🛡️ Gouvernance</strong>
Cette documentation est "Open Source" au sein de la guilde. Si vous trouvez une erreur ou souhaitez ajouter un guide, contactez l'équipe de développement sur Discord.
</div>
`;

export default function IntroPage() {
    return (
        <div className="max-w-4xl">
            <DocContent content={INTRO_CONTENT} />

            <div className="not-prose mt-12 p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex flex-col md:flex-row items-center gap-8 backdrop-blur-3xl shadow-2xl transition-all hover:bg-indigo-500/10 group">
                <div className="h-16 w-16 rounded-full bg-indigo-500/20 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                    🚀
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-black text-white mb-2">Prêt à démarrer l'aventure ?</h3>
                    <p className="text-zinc-400 mb-4 max-w-md">Passez à l'étape suivante pour rejoindre votre première guilde et configurer votre profil SigilOS.</p>
                    <Link
                        href="/docs/guilds/join"
                        className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        Rejoindre une Guilde →
                    </Link>
                </div>
            </div>
        </div>
    );
}
