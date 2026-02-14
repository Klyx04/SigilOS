export default function MentionsPage() {
    return (
        <div className="space-y-8">
            <div className="text-center space-y-4 mb-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                    Mentions <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Légales</span>
                </h1>
            </div>

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
        </div>
    );
}
