export default function CGUPage() {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                    Conditions Générales <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">d'Utilisation</span>
                </h1>
                <p className="text-lg text-zinc-400">Version Bêta Privée</p>
            </div>

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
        </div>
    );
}
