# Rush Sylvestre — Plan Directeur d'Amélioration & de Refonte

> **Document de référence exhaustif** pour la refonte ergonomique, visuelle et technique du module Rush Sylvestre dans SigilOS.
> Établi après confrontation directe avec la base de code, les retours d'expérience en jeu et les 5 captures d'écran de l'overlay et du guide interne.

> **État du Lot 1 (mesuré le 08/10/2026 — livré)** : le Lot 1 a été exécuté. **Trois points du §5.1
> étaient faux au moment de coder** ; ils ont été corrigés, jamais appliqués à l'aveugle :
> 1. `tests/unit/rush-rich-text.test.ts` **existait déjà** — les cas `splitTipLines` y ont été **ajoutés**
>    (jamais un second fichier : règle « aucun doublon »).
> 2. La vraie icône Zaap était **déjà servie** (`RushCoordinateChip.tsx`) : seul le carré `Copy` restait.
>    Les pictos retenus sont ceux du **module Dofus** (`/assets/dofus/modules/{map,resources}.png`),
>    **mesurés colorés** (RGB 130/118/88 et 47/50/21) ; `copy.png` et `nav/resources.png` sont **blancs**
>    (RGB 225 / 255) et disparaîtraient sur le thème clair de l'overlay.
> 3. `scroll-padding-top` (§5.1.8) et `scroll-mt-16` (§5.1.4) auraient été des **no-ops** : le seul
>    défilement ciblé utilise `block: "center"` et **aucun** élément de l'overlay n'est `sticky`
>    (non ajoutés — pas de code mort).
>
> Le Bloc 1 a été livré en **un composant unique**, `RushOverlayChapterBar.tsx` (le fichier
> `RushOverlayChapterTree.tsx` est **supprimé**) ; l'auto-bascule de §3.4 est en place dans les **deux**
> chemins de `handleToggleSeq` (invité + connecté). Détail et preuves : bloc du 08/10/2026 du
> `docs/ROADMAP.md`.


> ## État des lots — 08/10/2026 (vivant)
>
> | Lot | État | Livré | Reste |
> |---|---|---|---|
> | **1 — correctifs ergonomiques** | ✅ **PR #851** | O1, O2, O4, O8, G1, T4 · **partiels** : O5 (masquage « Chapitre 1/1 »), O6 (Échap PiP), G2 (puces seulement) | O3 **écarté par la mesure** : `scroll-padding-top`/`scroll-mt` étaient des no-ops (le seul défilement ciblé utilise `block: "center"` et aucun élément de l'overlay n'est `sticky`) |
> | **2 — temps réel** | ✅ **PR #853** + **T-2b** (#856) | fil d'activité à avatar Discord, `RushOverlayLiveToast`, **présence honnête** (§3.5/§3.6), O12 partiel, O6 (Échap PiP de la modale membres) · **T-2b** : **G3/G4** (prérequis résolus au **nom exact** — `resolvePrereqTarget` ; surbrillance 1,2 s) et **G10** (page serveur à **deux lectures parallèles**) | l'**id** dans le tag `prereq_text` (God + backfill) → **T-2c** |
> | **3 — robustesse éditeur GOD** | ✅ **PR #857** | **E4** suppression d'un bloc par `Dialog` Radix (plus de `confirm()` — et le `Dialog` n'était **pas** « déjà importé ») · **E6** conteneur de défilement **déclaré** par le layout (`data-god-scroll-container`, helper unique pour les **2 sites**) · **E3** `order` **ouvert dans la transaction** de création (plus de second appel `reorderRushMilestones` ; `order` est un `Int`, d'où le shift) · **E1** conseils « une ligne = une puce » (`TipsLinesEditor` + aperçu `RushTipLines`, « Ajouter position » sur une **nouvelle** ligne) et aide de syntaxe **sourcée sur le rendu** (`RUSH_RICH_TEXT_SYNTAX` : le `/w` manquait) · **E5** aperçu live = les composants du **membre** (`RushOverlayQuestListItem` + `RushOverlayQuestDetailModal`, thème reposé sur le seul cadre d'aperçu) | 4 `prompt()` natifs (lien, position) — **hors périmètre E4** · **E2** (`achievements?: string[]`) reste à part (**migration Prisma** ⇒ accord explicite) |
> | **4 — habillage Dofus** | ⬜ à faire | *rien* (le lot 1 a **retiré** du slop, il n'a rien ajouté) | **O14** accents par Dofus, **O15** motion sobre, **G7** hero, **G8** dépli `grid-template-rows`, **G9** célébration (arbitrer — `MilestoneCelebration` existe), **T2** accessibilité |
> | **5 — overlay avancé** | ⬜ à faire | O12 partiel (toast de validation) | **O9** carte « Maintenant », **O10** 3 densités (container queries), **O11** jauges/anneaux, **O13** mini-carte, O12 (coéquipier sur la même quête, prérequis débloqué) |
> | **6 — perf & architecture** | ⬜ à faire | *rien* | **G6** contextes `SequenceRow` → Zustand (profiler avant/après), `useOptimistic` handler par handler |
>
> **Transverses restants** : **O5** (bouton « Aller à la suite » + défilement auto vers la 1ʳᵉ quête non cochée), **O6** (`autoFocus` sur Fermer + verrou de scroll), **O7** (callout `touglibox` dans la modale de l'overlay), **G2** (succès en badges), **G5** (`ContextualHelp` au clic/clavier), **T1** (parsing des succès, résolution des prérequis par id), **T5** (`useQuestGroups` : collisions d'id de groupe).
>
> 🔭 **Session du 08/10/2026 « one shot »** (branche `feat/rush-one-shot`, 3 commits) — livré **hors lots** : pictos **réels**
> (source unique `RUSH_RESOURCES_PICTO` ; mesure `sharp` : `nav/resources.png` est **blanc pur** ⇒ écarté), rail de droite
> **défilant** (le dashboard n'avait pas le correctif du public du 22/09), **alignement & ordre en LECTURE SEULE** (modale de
> choix **supprimée** ; source = profil du personnage, mise à jour par quête conservée), **table Dofus unique**
> (`src/lib/rush-dofus-meta.ts` — **cinq** copies divergentes supprimées, cf. mesure ci-dessus), bruit **Sentry** filtré/annoté.
> Les lots **4** (reste : O15, G7, G8, G9, T2), **5** (O9, O10, O11, O13, O12) et **6** (perf) restent **ouverts**.
> Détail et preuves : bloc du 08/10/2026 du `docs/ROADMAP.md` · arbitrage **O13** tranché : mini-carte = **composant dédié**
> (pas `MapDetailsPanel` : *dark-locked* et Leaflet ⇒ contraire à T2, et portail hors fenêtre PiP).
>
> ⚠️ **E2** (`achievements?: string[]`) **n'est pas un « lot 3 » ordinaire** : il demande une **migration Prisma** ⇒ arrêt et accord explicite avant de coder.
> 🧭 **Hors de ce plan** : le **chantier « données »** (branches Tougli Bonta/Brâkmar, prérequis structurés, registre auditable) vit dans la note de recherche `temp/…Dofusdb…` et doit être cadré comme un chantier séparé.
> 🚫 **Chantier U — « zéro dépendance DofusDB »** (règle du propriétaire, mesurée le 08/10/2026) : cadré dans `docs/plans/FILE-EXECUTION.md` §1 — **5 points de contact** (repli image, recherches, proxy image, health check, crons) + **~1 626 URL DofusDB** dans les 28 `*-compiled.json`, lots **U-1 → U-5**.

## Sommaire

1. [Périmètre & Invariants d'Architecture](#1-périmètre--invariants-darchitecture)
2. [Résolution des 6 Questions Ouvertes du Plan Initial](#2-résolution-des-6-questions-ouvertes-du-plan-initial)
3. [Traitement des Retours Utilisateur & Captures d'Écran](#3-traitement-des-retours-utilisateur--captures-décran)
4. [Feuille de Route Détaillée par Lots](#4-feuille-de-route-détaillée-par-lots)
5. [Spécifications Techniques du Lot 1 (Exécution Immédiate)](#5-spécifications-techniques-du-lot-1-exécution-immédiate)
6. [Critères d'Acceptation & Definition of Done](#6-critères-dacceptation--definition-of-done)

---

## 1. Périmètre & Invariants d'Architecture

### 1.1 Stack Technique Réelle
* **Framework** : Next.js 16.3.8 (App Router, Turbopack, Server Actions).
* **React** : 19.3.0.
* **Styles & Thème** : Tailwind CSS v4 avec `@theme inline` et tokens OKLCH dans `src/app/globals.css`.
* **Overlay** : Fenêtre Document Picture-in-Picture (`documentPictureInPicture`) avec repli popup (`window.open` vierge `about:blank` + styles injectés).
* **État & Synchro** : Zustand (`rush-overlay-store`), Socket.IO / Redis pub/sub (`useGuidePresence`), BroadcastChannel (`useGuideProgressSync`).

### 1.2 Invariants de Design (Anti-Slop & Accessibilité)
1. **Tokens stricts** : Toutes les couleurs s'appuient sur les tokens sémantiques (`bg-surface`, `bg-elevated`, `border-border`, `text-foreground`, `text-muted-foreground`, `text-accent`, `text-success`, `text-warning`, `text-danger`).
2. **Zéro effet slop** : Aucune ombre portée diffuse, aucun flou d'arrière-plan (`backdrop-blur`), aucun halo glow. L'immersion découle de la donnée du jeu Dofus (illustrations officielles, icônes réelles, coordonnées, boss).
3. **Zéro requête externe d'icônes** : Les icônes de marques (DPLN, DofusDB, etc.) sont servies en local (`/assets/source-icons/...` via `brandIconForUrl`).
4. **Bithématisme strict** : L'ensemble des composants doit être parfaitement contrasté et lisible en `.dark` et en `.light` (l'overlay pose `.light` sur sa racine en thème clair).
5. **Stabilité des signatures** : Les composants partagés entre le dashboard membre, le guide public et l'overlay conservent leurs signatures publiques sans régression.

---

## 2. Résolution des 6 Questions Ouvertes du Plan Initial

| # | Question initiale | Analyse & Réponse Code |
|---|---|---|
| **Q1** | **Composant de la ligne de quête overlay ?** | `src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx`, orchestré par `GuideOverlayClient.tsx`. |
| **Q2** | **Version exacte de React / Next / Tailwind ?** | React **19.3.0**, Next.js **16.3.8**, Tailwind CSS **v4** (avec utilitaire `--text-caption: 11px;` configuré sous `@theme inline`). |
| **Q3** | **Transmission du CSS à la fenêtre PiP ?** | Géré par `preparePipDocument(win)` dans `src/hooks/use-guide-pip.ts` : copie des `sheet.cssRules` dans des balises `<style>` injectées dans le `<head>` de la PiP + clonage des balises `<link rel="stylesheet">`. |
| **Q4** | **`RushCoordinateChip` & `MapPositionPopover` ?** | • `RushCoordinateChip` : gère la copie `/travel` et `/zaap` via presse-papier.<br>• `MapPositionPopover` : utilise Leaflet et un `createPortal`. **Attention** : son portail vise `document.body` par défaut ; dans une fenêtre PiP, il doit viser `ownerDocument.body` pour ne pas projeter la carte sur la fenêtre parente. |
| **Q5** | **Fiabilité des coordonnées de quêtes ?** | `getSequenceCoord` résout dans l'ordre : `pos_tags` (God) > titre > `tips` > `note`. Majoritairement fiables mais pas universelles (quêtes de dialogues). Une mini-carte globale sera réservée aux séquences ayant des coordonnées valides. |
| **Q6** | **Politique Ankama sur les outils tiers ?** | **Interdiction stricte des CGU** concernant la lecture de paquets réseau ou le scan mémoire. SigilOS reste exclusivement passif (overlay web navigateur + copie dans le presse-papier). Aucun outil type Overwolf. |

---

## 3. Traitement des Retours Utilisateur & Captures d'Écran

### 3.1 Unification des 3 Blocs de Chapitre Superposés (Capture 1)
* **Problème identifié** : L'overlay empilait consécutivement :
  1. Le sélecteur dropdown (`RushOverlayChapterTree` : `Quêtes Incarnam... 0/18 ˅`).
  2. La barre de progression (`CHAPITRE 1 / 1 ──── 0/18 · 0%`).
  3. La barre du jalon courant (`○ 1. Quêtes Incarnam... 0%` avec case à cocher pour tout le chapitre).
  Cet empilement consommait ~120 px de hauteur utile dans la fenêtre PiP.
* **Solution retenue** : Création d'un **bloc chapitre unique et compact** (`RushOverlayChapterBar`) :
  * Case à cocher discrète à gauche (pour valider tout le chapitre).
  * Titre avec chevron déroulant (clic = sélection rapide / recherche parmi les chapitres).
  * Jauge compacte et progression à droite (`0/18 · 0%`).
  * Masquage automatique de la mention redondante « Chapitre 1/1 » quand le guide n'a qu'un chapitre.

### 3.2 Vraies Icônes Position & Zaap (Captures 2 & 3)
* **Problème identifié** : `RushCoordinateChip` et `RushOverlayQuestDetailModal` utilisaient le carré générique `Copy` ❐ de Lucide.
* **Solution retenue** :
  * Remplacement du carré `Copy` par un picto repère position Dofus sobre ou `MapPin` stylisé.
  * Si la position comporte un détour Zaap (`isZaapCopyEnabled`), affichage prioritaire de la **vraie icône de Zaap Dofus** (`/assets/dofus/icons/zaap.png`).

### 3.3 Vraie Icône « Ressources à prévoir »
* **Problème identifié** : Le bouton de ressources dans `RushOverlayHeader` utilisait l'icône de carton `Package`.
* **Solution retenue** : Utilisation de l'icône officielle de SigilOS présente dans la barre de navigation : `/assets/nav/resources.png` en 16x16 px.

### 3.4 Auto-Bascule au Chapitre Suivant lors de la Complétion Progressive
* **Problème identifié** : Cocher le chapitre en un clic via `handleToggleMs` appelait bien `goToNextMs()`. En revanche, cocher les quêtes une à une dans `handleToggleSeq` recalculait `allChecked = true` mais **omettait d'appeler `goToNextMs()`**, laissant l'utilisateur bloqué sur un chapitre vide à 100%.
* **Solution retenue** : Dans `handleToggleSeq`, déclencher automatiquement `goToNextMs()` dès que la dernière quête du chapitre est validée (`!was && allChecked`).

### 3.5 Clarification du « Rush Live » (Capture 4)
* **Problème identifié** : Quand le WebSocket était inactif, `livePresenceMembers` affichait tous les membres de la base de données ayant un jour touché le guide comme étant « X en ligne ».
* **Solution retenue** :
  * Le badge « Rush Live » n'affiche que les personnes **réellement connectées** à l'instant T au WebSocket (`guideLive.presence`).
  * La modale détail liste l'ensemble des membres du rush avec une séparation claire :
    * 🟢 **En ligne maintenant** (connectés en direct sur le rush).
    * ⚪ **Hors ligne** (avec leur dernière quête validée pour savoir où ils en sont).

### 3.6 Dé-Slopage du Ticker de Notification (Capture 5) & Toasts Overlay
* **Problème identifié** : `LiveActivityTicker` affichait un encart doré flottant au milieu de l'écran avec du texte brut sans photo de profil.
* **Solution retenue** :
  * Refonte de `LiveActivityTicker` : intégration de l'**avatar Discord** du joueur (`userAvatar`), typographie fine, carte sombre élégante alignée sur les tokens.
  * Ajout dans l'overlay PiP d'un toast discret (3s auto-dismiss) quand un coéquipier valide une étape : `[Avatar Discord] Pseudo a validé « Nom de la quête »`.

---

## 4. Feuille de Route Détaillée par Lots

```
┌────────────────────────────────────────────────────────────────────────┐
│ LOT 1 : Correctifs Ergonomiques & Visuels Majeurs (Overlay & Guide)   │
│ ➔ Bloc chapitre unifié, Auto-next, Vraies icônes Zaap/Ressources,     │
│    Layout ligne quête, Puces conseils, Ordre modale, Bug <button>      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LOT 2 : Temps Réel, Ticker Dé-slopé & Présence Honnête                 │
│ ➔ Ticker avec avatar Discord, Toasts overlay, Refonte modale Rush Live,│
│    Prérequis par ID (G3/G4), Parallélisation Promise.all serveur (G10) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LOT 3 : Robustesse de l'Éditeur GOD & Aide Syntaxe                    │
│ ➔ Dialog au lieu de confirm(), Ref scroll layout, Rappel syntaxe      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LOT 4 : Habillage Visuel & Identité Dofus                              │
│ ➔ Accents par Dofus (--accent), Titres cinzel, Puces or, Rail coloré   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LOT 5 : Nouveautés Overlay Avancées                                    │
│ ➔ Carte « Maintenant », 3 densités Container Queries, Jauges anneaux   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ LOT 6 : Performance & Architecture                                     │
│ ➔ Migration contextes SequenceRow vers Zustand avec sélecteurs fins    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Spécifications Techniques du Lot 1 (Exécution Immédiate)

### 5.1 Fichiers Modifiés & Rôles
1. `src/components/dofus-quests/rush/RushRichText.tsx`
   * Export de la fonction pure `splitTipLines(rawText: string): string[]` (découpage par `\n` puis ` + ` ou ` · `).
   * Rendu des puces enveloppées dans `<span className="min-w-0"><RushRichText text={...} /></span>` (car `RushRichText` est un `span.contents`).
2. `tests/unit/rush-rich-text.test.ts`
   * Tests unitaires automatisés pour `splitTipLines` (préservation des liens `[Nom](url)` et des commandes `/travel x,y`).
3. `src/components/dofus-quests/rush/RushCoordinateChip.tsx`
   * Remplacement de l'icône `Copy` Lucide par un picto position Dofus.
   * Affichage prioritaire de `/assets/dofus/icons/zaap.png` lorsque `showZaap` ou `manualZaap` est actif.
4. `src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx`
   * Refonte de la hiérarchie flex : conteneur vertical `flex flex-col min-w-0 flex-1` (titre sur toute la largeur avec `line-clamp-2`, badges en dessous en `flex-wrap gap-1`).
   * Ajout de `scroll-mt-16` sur la ligne de quête.
5. `src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterTree.tsx`
   * Remplacement des 2 barres redondantes par le composant unifié `RushOverlayChapterBar`.
   * Masquage de `Chapitre 1/1` si total = 1.
   * Intégration de la case à cocher tout le chapitre et de la jauge compacte.
6. `src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx`
   * Remplacement du picto `<Package />` par `/assets/nav/resources.png`.
7. `src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx`
   * Rendu des `tips` et `note` via `RushRichText` dans un conteneur `whitespace-pre-line` avec puces `splitTipLines`.
   * Suppression de l'intitulé redondant « Position de lancement ».
   * Affichage de l'icône Zaap si zaap disponible.
   * Réorganisation de l'ordre des sections : Position → Donjon → **Conseils** → Succès → Ressources → Badges → Helpers → Liens.
   * Fermeture Échap écoutée sur `ownerDocument.defaultView` (PiP compliant).
8. `src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx`
   * Intégration de `goToNextMs()` dans `handleToggleSeq` dès que `!was && allChecked`.
   * Ajout de `scroll-padding-top` sur le conteneur principal `<main>`.
   * Nettoyage de l'ancienne barre de chapitre superposée.
9. `src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx`
   * Nom de quête rendu en texte simple (suppression du lien doublon avec les icônes DPLN/DB).
   * Refonte de `CollapsibleHints` pour utiliser les mêmes puces que l'overlay.
10. `src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/QuestGroup.tsx`
    * Correction du `<button>` imbriqué dans l'en-tête de `QuestGroupRenderer`.
    * Proposition de « Tout cocher » et « Tout décocher » selon l'état.

---

## 6. Critères d'Acceptation & Definition of Done

* [ ] **Compilation & Tests** : `npm run test:run`, `npx tsc --noEmit` et `npm run lint` passent à 100% sans warning ni régression.
* [ ] **Overlay Compact** : Une seule barre de chapitre propre dans l'overlay ; gain de plus de 80 px de hauteur utile.
* [ ] **Auto-Bascule Chapitre** : Valider la dernière quête d'un chapitre fait avancer l'overlay au chapitre suivant sans intervention manuelle.
* [ ] **Identité Visuelle** : Vraie icône de Zaap et vraie icône de Ressources visibles dans l'overlay ; fin des carrés de copie génériques.
* [ ] **PiP Escape** : Appuyer sur Échap dans la fenêtre PiP ferme instantanément la modale détail.
* [ ] **Hygiène Git** : `git status --short` impeccable, zéro artefact temporaire, commits atomiques et clairs en français.
