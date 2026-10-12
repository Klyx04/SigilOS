/**
 * Source unique de la FAQ de la page publique `/almanax`.
 *
 * La même liste alimente l'affichage (section « Questions fréquentes », `.reg-faq`)
 * et le JSON-LD `FAQPage` de la page : un contenu balisé mais invisible est une
 * erreur de référencement, donc les deux doivent rester strictement alignés.
 */
export interface AlmanaxFaqItem {
    q: string;
    a: string;
}

export const ALMANAX_FAQ: AlmanaxFaqItem[] = [
    {
        q: "Qu'est-ce que l'Almanax dans Dofus ?",
        a: "L'Almanax est une quête journalière répétable située au Sanctuaire de l'Almanax [-4,-24]. Chaque jour, un Méryde offre un bonus unique en jeu et demande une offrande d'objets en échange d'expérience, de kamas et d'une page de calendrier pour le Dofus Dolmanax.",
    },
    {
        q: "Combien de jours faut-il pour obtenir le Dolmanax ?",
        a: "Il faut accomplir 365 quêtes journalières de l'Almanax (non consécutives) pour réunir les 365 pages de calendrier et valider la quête finale du Dolmanax.",
    },
];

export function getAlmanaxFaq(locale: string = "fr"): AlmanaxFaqItem[] {
    if (locale === "en") {
        return [
            {
                q: "What is the Almanax in Dofus?",
                a: "The Almanax is a daily repeatable quest located at the Almanax Sanctuary [-4,-24]. Each day, a Meridia grants a unique in-game blessing and asks for an item tribute in exchange for experience, kamas, and a calendar page toward the Dolmanax Dofus.",
            },
            {
                q: "How many days are needed to obtain the Dolmanax?",
                a: "You need to complete 365 daily Almanax quests (non-consecutive) to gather the 365 calendar pages and complete the final Dolmanax quest.",
            },
        ];
    }
    return ALMANAX_FAQ;
}
