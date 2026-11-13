# API Tougli — référence des sources externes

> **Rôle unique.** Ce fichier documente l'API de **Tougli** (`api.tougli.barbofus.com`), ses
> endpoints, les **formes réelles** mesurées et le modèle d'embranchement qu'elle utilise.
> Il ne duplique ni `docs/reference/METAMOB-API.md` (autre fournisseur), ni
> `docs/plans/MAPPING-RUSH-SYLvestre.md` (le mapping déjà importé dans le dépôt).
> **Dernière mesure : 12/11/2026** (réponses réelles, aucune supposition).

## 1. Accès

| Élément | Valeur mesurée |
|---|---|
| Base | `https://api.tougli.barbofus.com` — préfixe `/api/` |
| Format | `application/json; charset=utf-8` |
| Auth | publique pour la lecture des guides ; les ressources **personnelles** passent par `https://barbofus.com/api/whoami` (cookies du domaine parent `barbofus.com`) |
| CORS | non mesuré (les appels du navigateur Tougli partent du même domaine) |

## 2. Endpoints

| Endpoint | Méthode | Contenu | État mesuré le 12/11/2026 |
|---|---|---|---|
| `/api/guide/list` | GET | tous les guides publics | ✅ **88 Ko**, `{ data: { guides: [...] } }` |
| `/api/guide/details/:slug` | GET | un guide complet | ✅ **1,2 Mo** (brut 2,6 Mo) pour `rsa-rush-sylvestre-accelere` |
| `/api/guide/details-batch` | POST | plusieurs guides + **contraintes par quête** | ✅ **530 quêtes / 1 085 contraintes** pour le RSA (12/11/2026) |
| `/api/character/active` | GET | personnage actif (classe, serveur, alignement, ordre) | **auth requise** (non mesuré) |
| `/api/characters` | GET | liste des personnages | **auth requise** |
| `/api/archidex` · `/api/avisdex` | GET | bases Archimonstres / Avis de recherche | non mesuré |
| `/api/tougli/skins` | GET | skins d'interface | non mesuré |
| `/api/auth/check` | GET | validité de la session | non mesuré |
| `/api/locale` | GET | locales | ⚠️ **404 le 12/11/2026** (endpoint listé par le mainteneur, non trouvé) |

## 3. Formes réelles

### 3.1 `/api/guide/list`

```jsonc
{ "data": { "guides": [{
  "id": "1755940142219368848",
  "title": "Dofawa",
  "url": "dofawa",                       // ← le slug
  "optimalLevel": 15,
  "kamasGainQuest": 454, "kamasGainAch": 0,
  "imagePath": "/uploads/guides/1756752295546546401.png",
  "sortOrder": 1, "isDraft": false,
  "category": { "fr": "LES DOFUS", "en": "THE DOFUS", "es": "LOS DOFUS", "pt": "OS DOFUS" },
  "allQuestIds": [1959, 1958],           // ids DofusDB
  "allAchievementIds": [5220, 1048],     // parfois présent
  "colors": ["#643607", "#c86c15", "#ffaf47", "#fcf6d9"],
  "startQuestIds": [1958],
  "keySteps": [{ "objectiveId": "quest:2004", "label": { "fr": "La cité de Brutas", "…": "…" } }]
}]}}
```

### 3.2 `/api/guide/details/:slug`

```jsonc
{ "data": { "guide": {
  "id": "1777403305753203644",
  "title": "RSA - Rush Sylvestre Acceleré",
  "url": "rsa-rush-sylvestre-accelere",
  "description": "<p>…</p>",              // HTML
  "objectives": [ /* la trame, dans l'ordre */ ]
}}}
```

Chaque `objective` = `{ id, type, payload }`, `type` ∈ :

| `type` | `payload` | Sens |
|---|---|---|
| `quest` | **nombre** (id DofusDB) | une quête |
| `title` | `{ fr, en, es, pt }` | un titre de section |
| `note` | `{ fr, en, es, pt }` | un encart de texte |
| `take_quests` | `{ quests: [ids] }` | « prends ces quêtes » |
| `choice` | `[{ condition, objectives: [...] }]` | **embranchement conditionnel** |
| `group` | `[objectives]` | **quêtes parallèles** (2 à 6) — l'ordre interne n'a pas de sens |
| `achievement` | **nombre** (id de succès) | prérequis de succès |

### 3.3 Le modèle d'embranchement (le point important)

Tougli ne stocke **pas** une route par quête : il stocke une **liste linéaire** avec, aux
endroits qui bifurquent, un `choice` dont chaque branche porte une **condition en texte** :

```jsonc
{ "id": 16, "type": "choice", "payload": [
  { "condition": "Classe=Feca", "objectives": [{ "id": 17, "type": "quest", "payload": 1963 }] },
  { "condition": "Classe=Osa",  "objectives": [{ "id": 18, "type": "quest", "payload": 1964 }] }
]}
```

La condition est résolue côté client à partir du **personnage actif** (classe, serveur,
alignement, ordre — ce que montre le panneau « Henriette »). Les formes relevées le 12/11/2026
sont `Classe=Feca`, `Ali=Bonta|Brak|Neutre` et `Ordre=CV|OA|ES|CS|OP|EM` (6 Ordres). Ne jamais
les deviner : relire une réponse réelle avant de parser.

**Correspondance avec SigilOS** — même intention, deux écritures :

| Tougli | SigilOS |
|---|---|
| `choice` + `condition: "Classe=Feca"` | `GuideSequence.classReq = "feca"` |
| `choice` + condition d'alignement | `alignReq = "bontarien" \| "brakmarien"` |
| `choice` + condition d'Ordre | `alignOrderCode` + `alignLevelReq` (palier 20…100) |
| `objectives` linéaires | blocs + quêtes, filtrés **avant** la vue par `resolveRushRoute` |
| `title` / `note` | blocs `SEPARATEUR` / `INFO` |

SigilOS est **plus plat** (la condition est portée par la quête, pas par un nœud parent) :
c'est ce qui permet de déplacer une quête sans casser la trame, et de filtrer en une passe.

### 3.4 Contraintes par quête (`/api/guide/details-batch`)

`details-batch?slugs=…` renvoie `data[slug] = { guide, quests, items, dungeons, achievements, monsters }`.
`quests` est une **carte id DofusDB → quête** ; chaque quête porte des `objectives[]` typés.
Mesure du 12/11/2026 sur le RSA : **530 quêtes**, **1 085 contraintes** ; le guide lui-même
compte **383 objectifs** (35 titres, 238 quêtes, 74 `take_quests`, 16 `group`, 8 `choice`,
2 `achievement`, 10 `note`).

| Type | n | Payload | Sens |
|---|---:|---|---|
| `combat` | 726 | `{ combat: { type, payload[{count, monster}] }, detail }` | 5 modes (solo, groupe, tactique, soloV, groupeV) |
| `dungeon` | 168 | donjon + boss | donjon requis |
| `bashMobs` | 81 | `[{monster}]` | espèces à tuer (pas une quantité) |
| `needPlayer` | 38 | **texte libre** | effectif / rôles / dalles |
| `job` | 37 | `{ job: { id, name, iconId }, detail }` | métier **structuré**, niveau en texte |
| `url` | 9 | `{ url, text }` | outil externe |
| `hours` | 7 | **texte** | 4 fenêtres + 3 attentes |
| `dungeonChoice` | 7 | `{ dungeons[], note }` | donjon au choix selon le niveau |
| `note` | 4 | i18n | condition libre |
| `songe` | 3 | texte | palier de Rêve |
| `spell` | 3 | texte | sort requis |
| `achievement` | 2 | succès | prérequis |

⚠️ `needPlayer` n'est **pas normalisable** (« 3 x Alchimiste >80 + 3 x Paysan >40 »,
« 12 classes ou 120 000 kamas ») : l'afficher en texte, jamais comme règle de blocage.
`hours` mélange **fenêtres** (« entre 20h00 et 08h00 ») et **attentes** (« attendre 3 minutes »).

**Formes mesurées le 12/11/2026** (utiles au backfill et à l'éditeur) :

- `dungeonChoice` : `{ dungeons: [{ id, level, name: {fr}, bosses: [{ id, level, health, name: {fr} }] }], note }`.
- `combat` : `{ combat: { type: "solo" | "groupe" | "tactique" | "soloV" | "groupeV",
  payload: [{ count, monster: { id, level, health, name: {fr} } }] }, detail }`.
- `bashMobs` : `[{ monster: { id, level, health, name: {fr} } }]` — des **espèces**, pas des quantités.

## 4. Règles d'usage dans SigilOS

1. **Jamais d'appel à l'exécution** : 88 Ko pour la liste, **1,2 Mo** pour un seul guide.
   Tougli sert à la **veille** et à un **import ponctuel**, jamais au rendu d'une page.
2. **Aucune donnée Tougli dans le HTML servi** : on importe, on mappe, on stocke en base.
3. **Pas de secret** : les endpoints publics se lisent sans clé ; les endpoints personnels
   exigent une session `barbofus.com` qu'on **ne stocke pas**.
4. **Mesurer avant de parser** : un champ absent n'est pas une impossibilité — relire une
   réponse réelle (`curl`) avant d'ajouter un type.

## 5. Re-sonder (lecture seule)

```bash
curl -s https://api.tougli.barbofus.com/api/guide/list | head -c 400
curl -s https://api.tougli.barbofus.com/api/guide/details/rsa-rush-sylvestre-accelere \
  | python -c "import json,sys; d=json.load(sys.stdin)['data']['guide']; print(d['title'], len(d['objectives']))"
```

Le mapping déjà importé (100/102 cités, 30 quêtes d'Ordre, 19 classes) vit dans
`docs/plans/MAPPING-RUSH-SYLvestre.md` et `src/lib/rush-class-quests.ts` — ce fichier ne le
remplace pas, il documente **la source**.
