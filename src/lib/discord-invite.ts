/**
 * Invitation du Discord SigilOS — source unique des liens membres.
 *
 * Mesure du 16/11/2026 (API Discord, lecture seule, sans jeton) :
 * - `discord.gg/uX7G6SUDgN` → guilde **« SigilOS »** ;
 * - `discord.gg/BMVvXpYHEt` (route `/discord`) → guilde **« STELLIUM »**, nom interne.
 *
 * Le point d'entrée côté membre pointe donc l'invitation publique SigilOS, jamais
 * `/discord`. La variable d'environnement reste la seule source ; le repli est
 * l'invitation déjà utilisée par la landing, le header public et le footer.
 */
export const DISCORD_INVITE_URL =
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

/** Nom affiché côté membre — jamais le nom interne du serveur. */
export const DISCORD_INVITE_LABEL = "Discord SigilOS";
