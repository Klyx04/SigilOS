# Mutation testing — mesurer un test, pas du code

> **La question** : « si je casse la règle, un test le voit-il ? » Un test qui reste vert quand le
> code est cassé est un test **décoratif** : il rassure, il ne protège pas.

Vitest répond à « le code fait ce que le test dit ». Stryker répond à « le test dit-il quelque
chose ». Les deux ne mesurent pas la même chose.

## Commande

```bash
npm run test:mutate
```

## Périmètre — un pilote, pas une porte de CI

- **un seul fichier** : `src/lib/rush-overlay-layout.ts` (18 mutants) ;
- **pas en CI** : une mesure locale, relancée quand on doute d'un test ;
- seuils `high: 90` / `low: 80`, `break: null` : le run informe, il ne fait pas échouer la CI.

## Résultat du pilote (23/11/2026)

**18 mutants / 18 tués = 100 %.** Les cas de paliers (PiP 400 × 1000, 579/580, 639/640, 819/820)
protègent réellement la règle. C'est une **mesure**, pas une impression : le doute « ces tests
sont peut-être décoratifs » est levé pour ce fichier.

## Lire le rapport

| Résultat | Sens |
|---|---|
| **tué** | un test a échoué → il protège ce comportement |
| **survécu** | tout est resté vert → aucun test ne vérifie ce comportement |
| **timeout** | le mutant boucle → compté comme détecté |
| **no cov** | aucun test ne charge la ligne → trou de couverture |

Le seul chiffre qui compte est **survécu**. Un score de 100 % ne dit pas que les cas sont les bons :
il dit que les cas écrits sont réellement testés.

## Limites

- **Coût** : ~25 s pour un fichier de 25 lignes (mesure du 23/11/2026). Ne jamais lancer sur tout `src/`.
- **Windows** : `.claude/skills` est une jonction (copie impossible) et `public/game-data/hd_maps`
  (2 Go) + `tiles` (61 Mo) pèsent trop lourd — exclus dans `ignorePatterns`. Un reliquat `.cline/skills`
  sur un vieux clone est à supprimer (il n'est plus créé).
- **Version** : Stryker **9.6**, pas 10.x — la 10 déclare Babel 8 alors que le dépôt épingle Babel 7.
  Le pilote reste donc sur une combinaison supportée.
- **Pas un juge produit** : un mutant tué prouve une assertion, pas que le besoin est couvert.

## Étendre

1. ajouter un fichier à `mutate` (commencer par `src/lib/**`, jamais un écran) ;
2. lancer, lire les **survivants** ;
3. écrire le test qui les tue — ou supprimer le code mort.
