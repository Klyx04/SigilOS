export default function MentionsPage() {
    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-16 px-6">
            <div className="max-w-3xl mx-auto prose prose-invert prose-lg">
                <h1 className="text-4xl font-bold text-white mb-8">
                    Mentions Légales
                </h1>

                <h3>1. Éditeur</h3>
                <p>
                    Le site <strong>SigilOS</strong> est édité par l'équipe développement de la guilde [Nom Guilde].<br />
                    Contact : Via le serveur Discord officiel.
                </p>

                <h3>2. Hébergement</h3>
                <p>
                    <strong>OVH SAS</strong><br />
                    2 rue Kellermann<br />
                    59100 Roubaix - France
                </p>

                <h3>3. Propriété Intellectuelle</h3>
                <p>
                    Le code source de SigilOS est privé. Toute reproduction non autorisée est interdite.
                    Les assets graphiques issus du jeu Dofus appartiennent à Ankama Games.
                </p>
            </div>
        </div>
    );
}
