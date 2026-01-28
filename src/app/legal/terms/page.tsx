export default function TermsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-4">Conditions Générales d'Utilisation</h1>
            <p className="text-sm italic opacity-50">Dernière mise à jour : Janvier 2026</p>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">1. Acceptation</h2>
                <p>
                    L'utilisation de SigilOS implique l'acceptation pleine et entière des présentes conditions.
                    SigilOS est un outil de gestion pour la guilde Stellium sur le jeu Dofus.
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">2. Compte Utilisateur</h2>
                <p>
                    L'accès nécessite un compte Discord. Vous êtes responsable du maintien de la sécurité de votre compte Discord.
                    L'accès à l'outil est soumis à l'appartenance à la guilde ou à une invitation explicite.
                </p>
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold text-zinc-200">3. Utilisation des Services</h2>
                <p>
                    Tout comportement abusif, tentative de piratage, ou utilisation détournée des outils (Songes, Métiers) pourra entraîner une suspension de l'accès.
                </p>
            </section>
        </div>
    );
}
