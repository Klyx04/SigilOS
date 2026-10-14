/**
 * Règlement intérieur de guilde — règle pure (présentation).
 *
 * Stocké en HTML (sortie TipTap `AdvancedEditor`), rendu côté interne uniquement
 * via `DocContent` (sanitize au rendu). Jamais servi au public :
 * `getGuildPresentation(checkEnabled=true)` renvoie `internalRules: null`.
 *
 * Borne : 20 000 caractères (HTML compris) — même ordre de grandeur que les docs
 * God, assez pour 8 sections + emoji, sans exploser la ligne `GuildConfig`.
 */

/** Borne HTML du règlement intérieur (balises comprises). */
export const PRESENTATION_INTERNAL_RULES_MAX_LENGTH = 20_000;

/**
 * Modèle pré-rempli d'office (choix user) : 8 sections Dofus, ton ferme mais
 * accueillant, phrases courtes, emoji de repère, aucune donnée de guilde en dur
 * (pas de nom, pas de niveau, pas de serveur — l'admin adapte).
 */
export const PRESENTATION_INTERNAL_RULES_TEMPLATE = `<h2>🤝 1. Esprit de la guilde</h2><p>Ici on joue ensemble, pas côte à côte. Respect, entraide et bonne humeur priment sur la performance. Aucune insulte, aucun règlement de compte public — en cas de tension, on en parle calmement avec l'état-major.</p><h2>🌱 2. Recrutement et période d'essai</h2><ul><li>Toute candidature passe par une présentation et une période d'essai.</li><li>L'essai sert à découvrir la guilde des deux côtés : sorties, Discord, ambiance.</li><li>À la fin de l'essai, l'état-major valide ou non l'intégration.</li></ul><h2>🕰️ 3. Activité et absences</h2><ul><li>On ne demande pas une connexion quotidienne, juste de la régularité.</li><li>Absence prévue ? Prévenez sur Discord, ça prend 30 secondes.</li><li>Sans nouvelles prolongées, le compte peut être mis en retrait pour libérer la place.</li></ul><h2>⚔️ 4. Sorties, entraide et percepteurs</h2><ul><li>Les sorties proposées sont ouvertes à tous les niveaux concernés — n'hésitez pas à vous inscrire.</li><li>On aide les plus petits comme les plus gros : donjons, quêtes, succès.</li><li>Les percepteurs appartiennent à la guilde : on les défend ensemble quand c'est possible.</li></ul><h2>🐴 5. Mules et rerolls</h2><ul><li>Les mules sont acceptées dans la limite des places disponibles.</li><li>Le personnage principal reste la référence pour l'activité et les droits.</li><li>Prévenez l'état-major avant d'ajouter un reroll.</li></ul><h2>💬 6. Discord et communication</h2><ul><li>Discord est notre QG : annonces, sorties et entraide s'y passent.</li><li>Guettez les annonces et indiquez vos dispos quand une sortie vous intéresse.</li><li>Le vocal est vivant pendant les sorties, écrit pour le reste — chacun son rythme.</li></ul><h2>🛠️ 7. Artisanat et commerce interne</h2><ul><li>Privilégiez l'entraide artisanale entre membres avant le marché public.</li><li>Les prix internes restent justes : on ne plume pas un camarade.</li><li>Les ressources de guilde servent à la guilde.</li></ul><h2>⚖️ 8. Manquements et sanctions</h2><ul><li>En cas de problème : rappel en privé, puis avertissement, puis exclusion — toujours expliqué.</li><li>Vol, arnaque ou comportement toxique = exclusion directe.</li><li>Toute décision peut être discutée calmement avec l'état-major.</li></ul><p>Bienvenue parmi nous — ce règlement vit avec la guilde, proposez vos ajustements !</p>`;

/** Vrai si le HTML ne porte aucun texte (balises vides, espaces, `<p></p>`). */
export function isInternalRulesEmpty(html: string | null | undefined): boolean {
    if (!html) return true;
    const text = html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim();
    return text.length === 0;
}
