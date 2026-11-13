/**
 * Kill-switch God `PlatformConfig.autoOnboardingEnabled` — **une seule formulation** pour toutes
 * les portes d'entrée (landing, portail, modale).
 *
 * 📌 Mesure du 01/11/2026 : le switch ne masquait que le bloc « En autonomie » de la modale. Les
 * boutons « Inviter le bot » / « Configurer ma guilde » restaient actifs, et un compte de test
 * pouvait lancer l'ouverture autonome alors que le réglage était sur INACTIF. Le texte est donc
 * centralisé ici : quand le serveur refuse, l'écran doit employer **les mêmes mots**.
 */
export const AUTONOMY_SUSPENDED_SHORT =
    "Ouverture autonome suspendue — l'équipe peut l'ouvrir avec toi.";

export const AUTONOMY_SUSPENDED_MESSAGE =
    "L'ouverture autonome est momentanément suspendue. Demande l'accompagnement : l'équipe ouvre ton espace avec toi.";
