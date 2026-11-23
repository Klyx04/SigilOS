# Tokens — DA « Gouache Wakfu »

Source exécutable : `src/app/da-wakfu.css`. Ce fichier explique **pourquoi** chaque
valeur est ce qu'elle est. Toute modification se fait dans le CSS, puis ici.

## 1. Base (indépendante du bloc)

| Token | Sombre | Clair | Usage |
|---|---|---|---|
| `--da-page` | `#0c0f0d` | `#e4e3d5` | fond hors fenêtre (aperçu) |
| `--da-bg0` | `#131815` | `#f3f1e5` | fond de fenêtre (avant teinte du bloc) |
| `--da-panel0` | `#1f2822` | `#e9ecd9` | panneaux et cartes (avant teinte) |
| `--da-field` | `#0e120f` | `#fbf9ee` | champs, barre système, pastilles |
| `--da-line0` | `#364239` | `#c5cab2` | filets (avant teinte) |
| `--da-ink` | `#eceedf` | `#2a3123` | texte principal |
| `--da-muted0` | `#a3afa1` | `#54634f` | texte secondaire |
| `--da-warn` | `#ec9a85` | `#9d543a` | prérequis non rempli |
| `--da-amber` | `#e3a63c` | `#e3a63c` | fond de badge d'exigence |
| `--da-amber-ink` | `#e3a63c` | `#7a4d0c` | **texte** ambre (donjon requis) |
| `--da-ok` | `#8fbf5a` | `#3f6b1f` | **validé** — fixe, jamais l'accent du bloc |
| `--da-plank` | `#cdcbbd` | `#e7e3d1` | planches de l'écriteau |
| `--da-plank-ink` | `#2a2924` | `#2a2924` | chiffres de l'écriteau |

## 2. Accent par bloc (six combinaisons)

| Bloc | Mode | `--da-acc` | `--da-acc2` | `--da-acc-ink` | `--da-tint` | `--da-on` | `--da-outline` |
|---|---|---|---|---|---|---|---|
| `emeraude` | sombre | `#b8cf6a` | `#7f9a45` | `#b8cf6a` | `#34452f` | `#1c250d` | `#0f1410` |
| `emeraude` | clair | `#9fc43e` | `#668c20` | `#52690f` | `#d3e5ae` | `#1f2d0c` | `#3a4720` |
| `cauchemar` | sombre | `#79c7d4` | `#3a8fa0` | `#79c7d4` | `#123e4b` | `#06212a` | `#07141a` |
| `cauchemar` | clair | `#4fb6c8` | `#177a8e` | `#0d5666` | `#c2e2ea` | `#04222a` | `#224654` |
| `ocre` | sombre | `#e9a93a` | `#b97c1c` | `#e9a93a` | `#4d3826` | `#2a1a05` | `#1a1108` |
| `ocre` | clair | `#eba126` | `#b57206` | `#7a4d0c` | `#f0d9b0` | `#2a1a05` | `#59401a` |

## 3. Dérivés (calculés, jamais saisis)

```
--da-bg    = bg0    90 % + tint
--da-panel = panel0 80 % + tint
--da-card  = panel0 88 % + tint
--da-line  = line0  76 % + tint
--da-muted = muted0            (PAS de teinte : voir §4)
--da-ln    = acc2 40 % + outline
```

## 4. Écarts à la maquette — tous mesurés (WCAG AA = 4,5:1)

| Écart | Avant | Après | Mesure |
|---|---|---|---|
| `--da-muted0` clair | `#5f6e5d` teinté par l'accent | `#54634f`, **non teinté** | 3,96 → **5,26:1** sur carte |
| `--da-amber-ink` (texte) | inexistant, `--da-amber` utilisé | `#7a4d0c` en clair | 1,76 → **5,94:1** |
| `--da-acc-ink` (texte) | inexistant, `--da-acc` utilisé | `#52690f` / `#0d5666` / `#7a4d0c` en clair | 1,76 → **5,08:1** |
| `--da-ok` | l'accent du bloc peignait « validé » | vert fixe | lisibilité constante, chapitre Ocre compris |
| `--da-warn` clair | `#9d543a` | conservé | **4,57:1** — marge faible, ne pas éclaircir |

Ces quatre points sont verrouillés par `tests/unit/da-wakfu.test.ts`.

## 5. Bloc arbitraire (accent fourni par la donnée)

`GuideMilestone.accentColor` est une valeur libre du God. Le bloc porte alors
`data-block="custom"` et `style="--da-acc: <hex>"` :

- `--da-acc2`, `--da-tint`, `--da-outline` sont dérivés par `color-mix` ;
- `--da-acc-ink` **retombe sur `--da-ink`** : on ne peut pas calculer un contraste
  en CSS, et l'accent libre ne doit jamais porter du texte.

## 6. Ajouter un bloc nommé

1. Choisir une image d'ambiance (une scène, jamais un personnage en gros plan).
2. Prélever l'accent (lumière dominante) et la teinte (ombre dominante).
3. Calculer `acc2` (accent foncé), `on` (texte sur l'accent), `outline` (ton très
   sombre de la teinte), `acc-ink` (accent lisible en texte clair).
4. Ajouter **deux** déclarations dans `da-wakfu.css` (sombre, puis clair), et une
   ligne dans le tableau §2.
5. `npx vitest run tests/unit/da-wakfu.test.ts` : six combinaisons deviennent neuf.

## 7. Transition

`@property` + `transition` de 0,8 s sur `--da-acc`, `--da-acc2`, `--da-tint`,
`--da-on`, `--da-outline`. Sans `@property` (navigateur ancien), le changement est
instantané : dégradation acceptable, jamais un blocage.
