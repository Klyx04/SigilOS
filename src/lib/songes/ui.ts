/**
 * Styles de boutons du module Songes — SOURCE UNIQUE.
 *
 * Le module était le plus hétérogène du dashboard (or plein, violet plein, bleu
 * plein, `bg-white/3`, liens nus…) : on garde trois intentions, et on les applique
 * partout (cartes, modales, en-têtes). Le module étant **dark-locked**, on
 * n'utilise que les tokens neutres + UN accent (info), jamais de couleur
 * décorative : c'est l'action qui porte la couleur, pas la carte.
 */
export const SONGES_BUTTON = {
    /** Action principale (créer, enregistrer, avancer). */
    primary: "bg-info/15 text-info border border-info/30 hover:bg-info hover:text-info-foreground font-black",
    /** Action secondaire (modifier, télécharger, annuler à côté d'une principale). */
    secondary: "border border-border bg-surface text-foreground hover:bg-elevated font-bold",
    /** Action de clôture (fin de run : bilan). */
    close: "bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 font-black",
    /** Action destructrice (quitter, refuser). */
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger hover:text-danger-foreground font-bold",
    /** Action tertiaire (annuler seul, lien discret). */
    ghost: "border border-transparent text-muted-foreground hover:text-foreground hover:bg-surface",
} as const;

export type SongesButtonVariant = keyof typeof SONGES_BUTTON;
