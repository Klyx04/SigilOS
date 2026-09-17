/**
 * Source unique de la FAQ de la landing.
 *
 * La même liste alimente l'affichage (bloc « Mise en route ») et le JSON-LD
 * `FAQPage` de la page d'accueil : un contenu balisé mais invisible est une
 * erreur de référencement, donc les deux doivent rester strictement alignés.
 *
 * Les questions techniques détaillées (Metamob, permissions Discord, salons)
 * vivent dans l'aide complète `/legal/faq`, pas ici.
 */
export interface LandingFaqItem {
    q: string;
    a: string;
}

export const LANDING_FAQ: LandingFaqItem[] = [
    {
        q: "Combien coûte SigilOS ?",
        a: "Rien. SigilOS est gratuit et sans publicité pour les guildes Dofus. Le soutien au projet reste volontaire et n'ouvre aucun avantage.",
    },
    {
        q: "Demandez-vous mon mot de passe Ankama ?",
        a: "Non, jamais. La connexion se fait via Discord : SigilOS n'a pas besoin d'un accès à ton compte de jeu et ne demande aucun identifiant Ankama.",
    },
    {
        q: "Faut-il créer un compte SigilOS ?",
        a: "Non. L'accès membre comme l'accès administrateur passe par ton compte Discord : il n'existe ni compte ni mot de passe SigilOS.",
    },
    {
        q: "Les outils de jeu sont-ils ouverts ?",
        a: "Oui. Le Rush Sylvestre, les fiches de boss et l'Almanax se consultent sans compte et sans rejoindre une guilde. Seules les fonctions collectives demandent une guilde connectée.",
    },
    {
        q: "Comment intégrer les archimonstres (Dofus Ocre) ?",
        a: "Chaque membre ajoute son pseudo Dofus et sa clé API Metamob en lecture seule. SigilOS synchronise les captures pour que la guilde s'entraide sur la quête de l'Ocre.",
    },
];
