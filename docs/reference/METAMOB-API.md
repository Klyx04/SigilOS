---
description: API Metamob — routes, auth, erreurs, pagination, matches et veille (mesuré le 11/11/2026)
---

# 🔗 API Metamob — référence mesurée

> **Rôle unique.** Ce fichier dit ce que l'API Metamob expose **aujourd'hui** et comment le
> vérifier. Source de vérité amont : `https://www.metamob.fr/help/api` et les changelogs
> `https://www.metamob.fr/posts/<date>-changelog`. **Ne jamais coder de mémoire** : une route,
> un champ ou une borne se mesure avant d'être affirmé.
>
> Dernière mesure : **11/11/2026** (doc officielle + changelogs 04/11 et 09/11).

## 1. Base, auth, erreurs

- Base : `https://www.metamob.fr/api`
- Auth : `Authorization: Bearer <clé>` sur **toutes** les requêtes.
- Clé : `Settings → API Key` (`https://www.metamob.fr/settings#api`), opaque, jamais loguée.
- Erreurs (format unifié depuis le 04/11/2026) :
  `{ "status": 404, "error": 404, "messages": { "error": "..." } }`
  400 · 401 · 403 · 404 · 429 · 500 · 503.
- Limite : **60 requêtes/minute par clé** ; `Retry-After` sur 429.
- Pagination : `limit` (défaut 50, max 200 selon la route), `offset` ; un `limit` hors bornes
  est ramené dans les bornes **sans erreur**. Les dates sont ISO 8601 UTC (`Z`).

## 2. Routes utilisées par SigilOS

| Besoin | Route | Notes |
|---|---|---|
| Compte de la clé | `GET /v1/me` | `username`, avatar, `last_active` |
| Ses quêtes | `GET /v1/quests` | **toutes** (masquées comprises), favorites d'abord |
| Réglages d'une quête | `GET /v1/quests/{slug}` | `show_trades`, `trade_mode`, seuils |
| Monstres d'une quête | `GET /v1/quests/{slug}/monsters` | privé |
| Partenaires d'échange | `GET /v1/quests/{slug}/matches` | **privé**, doc §3 |
| Progression par zones | `GET /v1/quests/{slug}/zones` | privé |
| Quête publique | `GET /v1/users/{username}/quests/{slug}` | lecture publique |
| Référentiels | `/v1/quest-types`, `/v1/quest-templates`, `/v1/zones` | lecture publique |

Les routes `/v1/quests…` ne fonctionnent que pour **ses propres** quêtes ; le slug d'un autre
utilisateur renvoie 404. Le slug se trouve dans `GET /v1/quests` (la route publique ne liste
que les quêtes visibles).

## 3. Matches — `GET /v1/quests/{slug}/matches`

Paramètres mesurés le 11/11/2026 :

| Paramètre | Valeur |
|---|---|
| `limit` | défaut 20, **max 50** |
| `offset` | défaut 0 |
| `min_parallel_quests` | défaut 1 (pas de filtre) |
| `only_possible_trades` | `1` = exclut les échanges à sens unique ; défaut 0 |

⚠️ **`direction` et `active_within_days` sont acceptés mais ignorés.** Ne plus les envoyer :
ils donnent une fausse impression de filtre.

Filtres appliqués **par l'API** (identiques à la page Communauté) :
- même serveur que **votre** quête ;
- `show_trades` activé chez le partenaire ;
- comptes non bannis, profil non masqué, actifs sous 2 mois ;
- blocages exclus dans les deux sens ;
- pool plafonné à **500** candidats (les plus récemment actifs).

Tri : `min(donner, recevoir)` décroissant, puis somme décroissante. `match_score` est la
somme des types de monstres échangeables dans les deux sens — il ne pilote pas le tri.

Réponse (forme) :
```json
{ "data": [ { "user": { "username": "trader42", "avatar": {}, "last_active": "..." },
  "quest": { "slug": "...", "character_name": "...", "parallel_quests": 8 },
  "matches": { "they_have_you_want": [ { "id": 123, "name": {}, "available": 3, "needed": 2, "covers_need": true } ],
               "you_have_they_want": [] },
  "match_score": 2 } ],
  "pagination": { "total": 15, "limit": 20, "offset": 0 } }
```

## 4. Quêtes — `GET /v1/quests`

- Liste **toutes** les quêtes du compte (y compris masquées et privées).
- Champs utiles : `slug`, `character_name`, `current_step`, `parallel_quests`, `show_trades`,
  `server { id, name }`, `quest_template { id, monster_count, step_count, quest_type { slug } }`.
- `quest_type.slug` (`ocre`, `eternelle-moisson`…) est le moyen le plus fiable d'identifier
  la quête d'échange ; les heuristiques historiques (`monster_count > 200`, template 1/2)
  restent en repli.
- `show_trades: false` = quête non visible sur le profil public ; les autres joueurs ne
  peuvent pas proposer d'échange dessus.

## 5. Changements récents à connaître

- **04/11/2026** : envoi de messages et de propositions d'échange possible **sur demande**
  (activation du compte), sinon 403 ; format d'erreur unifié ; recherche < 3 caractères = 400.
- **09/11/2026** : acceptation/annulation/refus d'une proposition par l'API ; le détail d'une
  proposition expose le stock dans un bloc `viewer` (changement de format pour les outils).
  **SigilOS n'envoie aucune proposition dans le chantier « Échanges »** : lecture seule.

## 6. Veille (une fois par mois, sans hook)

```powershell
# Clé obligatoire : l'API Metamob exige une clé sur toutes les routes.
$env:METAMOB_API_KEY = "..."
node scripts/check-metamob-api.mjs
```

Le script est **GET seulement**, attend 1,1 s entre deux appels (60/min) et ne journalise
jamais la clé. Il sort en erreur si une forme attendue a changé. Pour explorer toutes les
routes : `node src/temp/metamob-api-siphon.mjs` (fichier volatile, non commité).

**Procédure** : lire `https://www.metamob.fr/help/api`, comparer avec ce fichier, lancer le
contrôle, puis corriger **ici** et dans le client (`src/lib/metamob-client.ts`) le même jour.

