export default function CGUPage() {
    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-16 px-6">
            <div className="max-w-3xl mx-auto prose prose-invert prose-lg">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-8">
                    Conditions Générales d'Utilisation (Bêta)
                </h1>

                <p className="text-xl text-zinc-400 leading-relaxed mb-8">
                    Bienvenue sur <strong>SigilOS</strong>. En participant à la Bêta Privée, vous acceptez les règles du jeu.
                </p>

                <h3>1. Accès Bêta</h3>
                <p>
                    SigilOS est en phase de développement actif ("Bêta"). L'accès est restreint aux guildes invitées via notre liste blanche.
                    Nous nous réservons le droit de révoquer un accès à tout moment si un abus est constaté.
                </p>

                <h3>2. Service "En l'état"</h3>
                <p>
                    Le service est fourni "tel quel". Des bugs peuvent survenir (c'est le principe d'une bêta).
                    Nous ne garantissons pas une disponibilité à 100%, bien que nous fassions de notre mieux.
                </p>

                <h3>3. Fair Play & Sécurité</h3>
                <p>
                    Il est strictement interdit de tenter de contourner les sécurités du site, d'injecter des données malveillantes ou de spammer les API.
                    Tout compte suspect sera immédiatement banni.
                </p>

                <h3>4. Responsabilité</h3>
                <p>
                    SigilOS n'est pas affilié à Ankama Games. Les images et noms du jeu Dofus sont la propriété d'Ankama.
                </p>
            </div>
        </div>
    );
}
