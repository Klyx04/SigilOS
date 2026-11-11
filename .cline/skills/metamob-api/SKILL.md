---
name: metamob-api
description: Utiliser avant toute modification d'un appel Metamob (routes, schémas Zod, matches d'échange, propositions). Source de vérité = doc officielle /help/api + changelogs, mesurée par scripts/check-metamob-api.mjs.
---
# API Metamob

1. Lire `docs/reference/METAMOB-API.md` : routes, bornes, erreurs et pièges mesurés le 11/11/2026.
2. Vérifier la doc officielle `https://www.metamob.fr/help/api` **et** le dernier changelog
   (`https://www.metamob.fr/posts/<date>-changelog`) — jamais de mémoire, jamais d'extrapolation
   depuis un champ absent.
3. Mesurer avant d'affirmer : `node scripts/check-metamob-api.mjs` (GET seulement, 60 req/min,
   clé `METAMOB_API_KEY` **obligatoire** — l'API exige une clé sur toutes les routes).
4. Un champ absent d'une réponse n'est **pas** une impossibilité : c'est une mesure à refaire.
5. Ne jamais journaliser la clé, ni la mettre dans une URL, un cache ou un DTO. La clé ne sort
   que dans l'en-tête `Authorization: Bearer`.
6. Pas de hook : un contrôle **mensuel** suffit. Si une forme change, corriger
   `docs/reference/METAMOB-API.md` **et** `src/lib/metamob-client.ts` dans le même commit.
7. Pour explorer toutes les routes : `node src/temp/metamob-api-siphon.mjs` (volatile, non commité).
