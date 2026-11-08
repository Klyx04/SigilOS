---
description: Profil dashboard — audit mesuré (couleurs de palette, rayons, marqueurs slop), cliquet de non-régression, une seule teinte d'accent, regroupement des 13 onglets, en-tête ; P1/P2 livrés le 08/11/2026
---

# 🎨 Refonte du profil dashboard

> **Rôle unique.** Ce fichier porte le **quoi** et les **décisions** de la refonte de l'écran
> `Mon Profil` (`/dashboard/<guildId>/profile`). Il ne duplique pas l'ordre d'exécution
> (rang **59** de `docs/ROADMAP.md`) ni les règles générales d'UI (`docs/RULES.md` § UI).
>
> **Dernière MAJ : 08/11/2026** — **P1** (cliquet) et **P2** (tokens du bento) livrés.

## 1. Périmètre mesuré (08/11/2026)

| Élément | Mesure |
|---|---|
| Page serveur | `src/app/dashboard/[guildId]/profile/page.tsx` — **8,7 Ko** |
| Composant client | `src/components/profile/profile-bento-grid.tsx` — **44,9 Ko** |
| Onglets | **13** clés : `overview` · `intro` · `dofus` · `services` · `activity` · `combat` · `skins` · `mules` · `planning` · `achievements` · `metiers` · `artisanat` · `settings` |
| Voisins les plus gros | `skin-library` 60 Ko · `user-request-modal` 46 Ko · `alt-pseudos` 42 Ko |

### Audit chiffré — 28 fichiers `.tsx` de l'écran, commentaires retirés

| Défaut | Compte | Répartition |
|---|---|---|
| **Classes de palette en dur** | **81** | bento **50** (9 familles pour 12 onglets) · `availability-heatmap` 13 · `achievement-validation-queue` 11 · `hero-header` 3 · `success-sync` 2 · `add-build-modal` 1 · `class-display` 1 |
| **Marqueurs « slop »** (`font-black`, `backdrop-blur`, `bg-gradient-to-`, `glass-premium`) | **~100** | `class-display` 11 · `success-sync` 11 · `skin-library` 9 · `alignment-section` 9 · `add-build-modal` 8 · `profile-services-tab` 8 · `builds-card` 7 · `introduction-card` 7 · `metamob-link` 7 · bento **1** |
| **Rayons > 12 px** | **56** | **50** `rounded-2xl` (16 px) + **6** `rounded-3xl` (24 px) · **aucun** `rounded-[Npx]` au-delà de 12 (un cliquet sur cette seule forme ne mesurerait rien) |

**Deux constats qui ont changé le plan :**

1. Le bento n'était **pas** le foyer du slop : **1** marqueur sur ~100. Une refonte qui ne touche
   que lui laisse l'essentiel chez ses voisins.
2. Le bento n'est **pas** monolithique : les 13 onglets délèguent à des composants séparés
   (`profile-dofus-tab`, `profile-services-tab`, `profile-activity-tab`, `skin-library`,
   `jobs-grid`…). P3 est donc un travail de **coquille**, pas de réécriture.

## 2. Les lots

### P1 — le cliquet (livré le 08/11/2026)

`tests/unit/profil-deslop-cliquet.test.ts` transforme l'audit en **plafond vérifiable**, avec la
même discipline que `responsive-guard.test.ts` :

- **par fichier** (pas de total global : un fichier ne peut pas compenser un autre) ;
- **dans les deux sens** : dépassement interdit, et plus d'**une** occurrence corrigée sans baisser
  le budget échoue aussi — un plafond large ne protège plus rien ;
- **tout fichier neuf du profil doit être déclaré**, sinon un composant ajouté échapperait au
  cliquet (`readdirSync` des deux racines, comparaison stricte des clés).

**Hors périmètre, volontairement** : les **couleurs de donnée** (hex dans `style`, ex.
`getClassColor`, couleur d'un rôle Discord) ne sont pas du slop — les compter pousserait à une
« correction » qui effacerait du sens. On ne compte que les classes de palette Tailwind.

### P2 — une seule teinte d'accent (livré le 08/11/2026)

Le bento portait une **couleur par domaine** : `emerald`, `sky`, `amber`, `rose`, `yellow`,
`fuchsia`, `orange`, `indigo`, `teal` — neuf familles pour un seul écran, chacune déclinée en
`text-*-400`, `bg-*-500/20`, `border-*-500/40`, `text-*-300`, `shadow-*-500/15`.

Livré : les deux champs `activeColor` / `bgActive` ont quitté la définition `TabDef`, l'actif passe
par deux constantes de fichier (`ACTIVE_TAB_CLASSES`, `ACTIVE_TAB_ICON_CLASSES`) construites sur le
token `accent` du kit. **50 → 0** classe de palette, et le budget du cliquet est déjà baissé.

### P2-bis — les trois cartes de l'onglet Général (livré le 08/11/2026)

Suite directe d'un constat à l'écran (« ya rien de fait ») : le lot P2 ne touchait que la barre
d'onglets, invisible sur la capture. Mesure des trois cartes (`class-display`, `metamob-link`,
`alignment-section`) : **0** couleur de palette — l'ambre visible est `--accent`, un token. Le slop
était ailleurs :

| Défaut mesuré | Correction |
|---|---|
| `font-black` (24 occurrences) | `font-semibold` (titres) / `font-medium` (valeurs) |
| `italic` décoratif (7) | retiré |
| `rounded-3xl` 24 px + `rounded-2xl` 16 px | `rounded-xl` 12 px |
| **boîte dans la boîte** : carte `border` > carte `border` + `bg-gradient-to-br` + `backdrop-blur-md` | surface **unique** (ni dégradé, ni verre, ni seconde carte) |
| `scrollbar-thumb-zinc-700`, `drop-shadow-[…#f59e0b]` | retirés (couleur en dur) |
| majuscules sur les **valeurs** (badge d'alignement, ordre, pseudo) | retirées — les **libellés** sont inchangés |

Compteurs du cliquet : palette **81 → 30**, slop **~100 → 65**, rayons **56 → 48**.

### P3 — onglets 13 → 6 (à cadrer)

Proposition **à confirmer**, pas une évidence :

| Nouvel onglet | Absorbe |
|---|---|
| Synthèse | `overview` + `activity` |
| Identité & combat | `intro` + `combat` + `achievements` |
| Équipement | `dofus` + `skins` |
| Personnages | `mules` + `metiers` + `artisanat` |
| Planning & services | `planning` + `services` |
| Réglages | `settings` |

**Coût mesuré, à traiter dans le lot :**

- les onglets sont **deep-linkables** (`page.tsx:23` lit `searchParams.tab`) ⇒ table
  **ancien → nouveau** obligatoire, sinon les liens en circulation meurent ;
- le **tutoriel** pilote les onglets par clé (`profile-bento-grid.tsx`, mapping étape → `setActiveTab`) ;
- `tests/unit/tour-overlay-viewport.test.ts` verrouille la barre (`overflow-x-auto`, `min-w-max`,
  préfixe `profile-tab-`, `tabsScrollRef`, bornes, `scrollTo`) : verrou à **préserver**.

### P4 — l'en-tête (à faire)

`page.tsx` utilise `imageSrc="/assets/ui/icons/profile.png"` : l'asset **existe**, ce n'est pas un
fichier manquant mais un **choix** d'icône UI là où la DA attend un asset Dofus. Candidat cohérent :
`public/assets/dofus/modules/character.png` (déjà utilisé par le menu compte depuis F12).

## 3. Verrous à ne pas casser

| Verrou | Ce qu'il protège |
|---|---|
| `tests/unit/profil-deslop-cliquet.test.ts` | plafonds par fichier, dans les deux sens |
| `tests/unit/tour-overlay-viewport.test.ts` | barre d'onglets défilable + bulle du tutoriel dans la fenêtre |
| `tests/unit/profile-identite-honnete.test.ts` | un refus d'enregistrement ne ressemble jamais à un succès (chaînes exactes dans `class-display` **et** le bento) |

## 4. Reste après ce lot

- **P3** puis **P4** (ordre libre, P3 est le seul lot structurel).
- **5 fichiers** portent encore une palette en dur (**30** classes) : `availability-heatmap` 13,
  `achievement-validation-queue` 11, `hero-header` 3, `success-sync` 2, `add-build-modal` 1.
- **~65** marqueurs slop, menés par `success-sync` 11, `skin-library` 9, `add-build-modal` 8,
  `profile-services-tab` 8, `builds-card` 7, `introduction-card` 7.
- Les **48 rayons** > 12 px restants (`rounded-2xl`/`rounded-3xl`), dont **1** dans le bento (la barre
  d'onglets, `backdrop-blur-2xl` sur la même ligne) — laissés hors P2 pour garder un diff relisible.
