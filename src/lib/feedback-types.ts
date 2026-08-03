// Constantes partagées des feedbacks Dofus (utilisées côté client ET serveur)

export const FEEDBACK_TYPES = [
  "BUG_TECHNIQUE",
  "ERREUR_DONNEES",
  "AMELIORATION",
  "NOUVELLE_FONCTIONNALITE",
  "COQUILLE",
  "AFFICHAGE",
  "AUTRE",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

// Les 8 choix demandés : 7 catégories + « Autre / Question »
export const FEEDBACK_LABELS: Record<FeedbackType, { emoji: string; label: string }> = {
  BUG_TECHNIQUE: { emoji: "🐛", label: "Bug technique (Bouton cassé, erreur 404…)" },
  ERREUR_DONNEES: { emoji: "📜", label: "Erreur de données / quête" },
  AMELIORATION: { emoji: "⚡", label: "Amélioration / Confort (QoL)" },
  NOUVELLE_FONCTIONNALITE: { emoji: "➕", label: "Nouvelle fonctionnalité (Idée d'ajout)" },
  COQUILLE: { emoji: "✍️", label: "Coquille / Faute de texte" },
  AFFICHAGE: { emoji: "🎨", label: "Affichage / Visuel (Souci de design)" },
  AUTRE: { emoji: "💬", label: "Autre / Question" },
};