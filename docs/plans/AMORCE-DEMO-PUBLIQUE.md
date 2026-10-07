---
description: Amorce de session — chantier S (démo publique) : état livré, prochains lots S-2a → S-5, méthode, pièges, et bloc à coller
---

# 🚀 Amorce — chantier `S` : démo publique (reprise)

> **À lire par la nouvelle session** avec `AGENTS.md` (lu automatiquement) et le dossier
> `docs/plans/PLAN-DEMO-PUBLIQUE.md` (contenu complet). Cette page ne duplique **rien** : elle dit
> **où on en est**, **ce qu'on fait ensuite** et **comment on prouve**.
> File d'exécution : `docs/plans/FILE-EXECUTION.md` (§1 ligne `S`, §2 étapes **33 → 38**).

---

## 1. Où on en est (05/10/2026 · `dev` = `042de5ee`)

| Lot | État | Détail |
|---|---|---|
| **S-0** | ✅ fait (02/10) | Mesure du couplage : **annuaire et songes sont prop-driven** ; **sorties** (`CalendarDashboard`) et **succès** (`SuccesTracker`) **fetchent par `guildId`** |
| **S-1** | ✅ **livré** (02/10, **PR #830**) | `src/lib/demo/**` (source statique) + route `/demo` + bandeau « Démonstration » + annuaire **réel** en `readOnly` + `noindex` + `PUBLIC_PREFIXES` |
| **S-2a → S-5** | à faire | ci-dessous |

**Sur la même session** (pour ne pas refaire) : le **deslop de l'annuaire** est livré (PR #834, `docs/plans/PLAN-DESLOP-ANNUAIRE.md`), les **avatars Discord par défaut** aussi (PR #835), et la **porte de sécurité** avant push (PR #836 → `scripts/security-gate.mjs`, hook `pre-push`).

**Ce qui existe déjà et sur quoi s'appuyer** (vérifié, pas supposé) :
- la **source de démo** : `src/lib/demo/source.ts` (guilde fictive, 8 membres, avatars `embed/avatars/{0-5}`, déterministe, **aucun** identifiant Discord) ; gardes : `tests/unit/demo-publique.test.ts` (13 cas) ;
- la page : `src/app/demo/page.tsx` (aucun `auth()`/`cookies()`/`db`, `noindex`) ;
- le composant d'annuaire : `MemberDirectory` + prop **`readOnly`** (rétrocompatible) ;
- la **visite guidée in-app** : `src/components/tour/` (**19 phases**, 26 pages) — **à réutiliser comme vocabulaire, jamais à dupliquer**.

---

## 2. Prochain lot — **S-2a : les Songes en lecture seule**

**Ce que dit la mesure S-0** : `RunCardGrid` (`src/components/songes/RunCardGrid.tsx:17-23`) reçoit ses
runs **en props** (`RunWithRelations` = `DreamRun & { members, waitlist, _joinRequests, _count }`) et
n'importe **aucune** action serveur. En revanche son enfant **`RunCard`** importe
`@/server/actions/songes/dream-run-actions` (`RunCard.tsx:46`), et `canJoinSonges={false}` neutralise
l'inscription (`canApply = canApplyConditions && canJoinSonges`, `RunCard.tsx:121`).

**À faire, dans l'ordre :**
1. **Mesurer d'abord** : lister dans `RunCard.tsx` **tous** les chemins cliquables et vérifier qu'aucun
   n'appelle une action quand `canJoinSonges === false` et `isAdmin === false` (boutons de ligne 366/375
   `disabled`, bouton d'inscription ligne 516). Si un chemin reste atteignable → **vue de démo dédiée**
   (données de `src/lib/demo/`, markup réel), comme prévu pour les sorties/succès.
2. Étendre `src/lib/demo/source.ts` avec 1-3 runs conformes au type attendu (**déterminisme** : dates
   ISO fixes, aucun `Date.now()`).
3. Rendre la section dans `/demo` avec `canJoinSonges={false}` + `isAdmin={false}`.
4. **Garde** à ajouter dans `tests/unit/demo-publique.test.ts` : les runs de la source respectent le
   schéma attendu (champs requis, `_count` cohérent) et la page passe bien `canJoinSonges={false}`.

---

## 3. Les lots suivants (chacun 1 branche = 1 PR → `dev`)

| Lot | Contenu | Point de vigilance |
|---|---|---|
| **S-2b** | **Sorties** et **succès** en **vues de démo dédiées** (ils fetchent par `guildId` : on ne les branche pas tels quels) | Réutiliser le **markup réel** (`calendar/*`, `succes/SuccesTracker.tsx`) sans jamais appeler d'action ; ne pas créer un second calendrier |
| **S-3** | **Interactions locales non persistées** : s'inscrire à une sortie, filtrer, publier « sur Discord » (scène Discord existante) | **Aucune** écriture atteignable ; garde : aucun `@/server/actions` dans `src/app/demo/**` et `src/lib/demo/**` |
| **S-4** | La **landing autour** : CTA « Essayer la démo » (FR+EN), hero sur l'écran réel, et 2 fuites produit (`tools.tsx:72` FR en dur ; `proof.tsx:76-88` qui masque un état faible) | i18n **FR + EN** (le type `Translations` est dérivé de `fr`) ; le CTA reste **secondaire** |
| **S-5** | **Perf mesurée** : pages publiques prérendables, **une seule** langue au client, `framer-motion` hors du graphe public | Mesures déjà prises (§5 de `PLAN-DEMO-PUBLIQUE.md`) — c'est la référence **avant/après** |

---

## 4. Méthode (non négociable, rappel court)

1. **Mesurer avant de corriger**, et écrire la **mesure** (§/fichier/ligne) — jamais « ça devait être ».
2. **Une source de vérité par règle** : la règle va dans `src/lib/**` si elle est pure, jamais dupliquée
   dans deux écrans.
3. **Gardes de test** : ce qui est interdit doit échouer si quelqu'un le réintroduit (classes, imports
   d'action, assets manquants → `existsSync`).
4. **Zéro dépendance neuve** sans une mesure qui la justifie.
5. **Vérifs** avant PR : `npx tsc --noEmit` (0) · `npm run lint` (0 erreur) · `npm run test:run` ✓ ·
   `git status --short` **propre** (aucun artefact laissé).
6. **Push** : `git fetch origin dev && git merge origin/dev --no-edit` — la **porte de sécurité** tourne
   automatiquement (`pre-push`), donc pas de PR rouge par surprise. Puis PR → `gh pr checks` jusqu'au vert.

---

## 5. Pièges déjà rencontrés (ne pas les rejouer)

1. **`tsc` incrémental** : `npx tsc --noEmit` peut passer **en silence** sur une erreur neuve (cache
   `tsconfig.tsbuildinfo`). En cas de doute : supprimer le cache et relancer. Le hook `pre-commit`, lui,
   l'attrape — c'est lui qui a rattrapé un cast sur `ORDERS` (`as const`).
2. **Commandes dépendantes en parallèle** : lancer `git commit` **et** `git push` dans la même salve a
   créé la branche distante **au commit précédent** (idem pour `gh pr create` et la suppression de son
   corps). ⇒ **une salve = des commandes indépendantes** ; les dépendantes s'enchaînent dans **une** chaîne.
3. **`temp/` cassait `tsc`** : les brouillons volatils (`.ts`/`.tsx` non versionnés) étaient inclus par
   `**/*.ts` ⇒ `temp` est désormais **exclu** du `tsconfig`. Ne pas y remettre du code destiné à être testé.
4. **`git add -A`** : le dépôt est parfois édité par le propriétaire **en parallèle** ⇒ stager fichier par
   fichier (leçon du 01/10, conservée).
5. **PowerShell** : `[...]` est un joker (`[guildId]` ne matche rien, silencieusement) ⇒ `-LiteralPath` ;
   ne jamais écrire un fichier avec `>` (UTF-16) ⇒ passer par l'éditeur ; les messages longs (commits, PR)
   passent par un **fichier** lu en `-Encoding UTF8`, jamais en argument.
6. **Encodage des commandes** : les sorties `gh`/`git` s'affichent mojibake en console (`├®`) — c'est
   l'affichage, **pas** le contenu : vérifier via `--jq`/fichier avant de conclure à une corruption.

---

## 6. Bloc à coller (en tête de la nouvelle session)

```text
Chantier S — démo publique (reprise). Lis : AGENTS.md, docs/plans/AMORCE-DEMO-PUBLIQUE.md,
docs/plans/PLAN-DEMO-PUBLIQUE.md (dossier complet) et docs/plans/FILE-EXECUTION.md (§1 ligne S, §2 étapes 33→38).
État : S-0 ✅ (mesure) et S-1 ✅ livré (PR #830, mergée) — dev = 042de5ee. L'annuaire (deslop + assets réels, PR #834),
les avatars Discord par défaut (PR #835) et la porte de sécurité avant push (PR #836) sont livrés sur la même base :
ne pas les refaire, s'appuyer dessus.

On attaque S-2a — les Songes en lecture seule dans /demo :
1. MESURER d'abord RunCard.tsx : lister tous les chemins cliquables et prouver qu'aucun n'appelle une action
   serveur quand canJoinSonges=false et isAdmin=false (ancre : canApply = canApplyConditions && canJoinSonges, l.121).
   Si un chemin reste atteignable → vue de démo dédiée (markup réel + données de src/lib/demo/), pas le composant tel quel.
2. Étendre src/lib/demo/source.ts (1-3 runs conformes au type RunWithRelations, dates ISO fixes, aucun Date.now()).
3. Rendre la section dans /demo avec canJoinSonges={false} et isAdmin={false}.
4. Ajouter la garde dans tests/unit/demo-publique.test.ts.
Méthode : 1 lot = 1 branche = 1 PR → dev ; mesure avant/après écrite ; gardes de test ; 0 dépendance neuve.
Vérifs avant PR : npx tsc --noEmit (0), npm run lint (0 erreur), npm run test:run (vert), git status --short propre.
Push : git fetch origin dev && git merge origin/dev --no-edit (la porte de sécurité tourne en pre-push).
Fin de session : bloc EN HAUT de docs/agents/activeContext.md (rotation du 7e) + docs/ROADMAP.md + statut des lots.
```
