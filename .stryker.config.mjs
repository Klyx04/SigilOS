/**
 * Mutation testing — pilote sur une règle pure.
 *
 * La question posée n'est pas « les tests passent-ils ? » (Vitest le dit déjà) mais
 * « si je casse cette règle, un test le voit-il ? ». Un mutant qui survit est un test
 * décoratif. Voir docs/agents/mutation-testing.md.
 *
 * Volontairement limité à UN fichier : ce n'est pas une porte de CI, c'est une mesure
 * qu'on relance quand on doute d'un test.
 */
export default {
    testRunner: "vitest",
    mutate: ["src/lib/rush-overlay-layout.ts"],
    reporters: ["clear-text", "progress"],
    thresholds: { high: 90, low: 80, break: null },
    timeoutMS: 30_000,
    concurrency: 2,
    /* Les images de jeu (2 Go : hd_maps 2 028 Mo + tiles 61 Mo) n'ont rien à faire
       dans la copie de travail. `.claude` contient une jonction (copie impossible). */
    ignorePatterns: [
        "/.claude/**",
        "/.next/**",
        "/coverage/**",
        "/docs/audits/**",
        "/private_uploads/**",
        "/public/assets/**",
        "/public/game-data/hd_maps/**",
        "/public/game-data/tiles/**",
        "/public/uploads/**",
        "/src/temp/**",
    ],
};
