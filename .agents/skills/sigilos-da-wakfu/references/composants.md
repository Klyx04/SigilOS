# Composants — correspondance avec le code réel

**Règle de ce fichier** : chaque ligne dit *où* le composant vit déjà. La DA change
son **habillement**, jamais sa place. Si un composant n'existe pas, il se crée dans le
dossier de la surface concernée.

## 1. Overlay — `src/app/overlay/guide/[guildId]/[slug]/`

Ordre vertical **inchangé** (ne pas réordonner, ne pas fusionner) :

| Ordre | Composant réel | Classes DA | Ce qui change |
|---|---|---|---|
| 1 | `RushOverlayHeader` | `.da-hero`, `.da-hero-img`, `.da-kicker`, `.da-meta`, `.da-track` | image du bloc + voiles, surtitre, jauge 9 px — **plus** de titre visible ni de frise de stade (F8, 08/11/2026) ; le `h1` est masqué (`sr-only`) |
| 2 | `RushOverlaySearch` | `.da-search` | champ « rough », touche `/` |
| 3 | `RushOverlayChapterBar` | `.da-dock`, `.da-medal`, `.da-dock-label`, `.da-plank[data-size="mini"]`, `.da-node` | médaillon 26 px, titre 13 px **jamais tronqué**, compteur 40 × 28, nœud « tout le chapitre » |
| 3b | `RushOverlayActions` | `.da-actions`, `.da-btn`, `.da-badge` | `Reprendre` (planche pleine, cible = `[data-state="next"]` de la liste) + `Ressources n/N` **du bloc affiché** — **seul** point d'entrée de la modale |
| 4 | `RushOverlayQuestFilter` | `.da-filters` | texte seul, compteurs, actif souligné |
| 5 | `RushOverlayQuestListItem` | `.da-row`, `.da-node`, `.da-card`, `.da-state`, `.da-chips`, `.da-coord`, `.da-req`, `.da-prereq` | nœud 4 états (`done` / `next` / `todo` / `locked`), carte 4/14, chips mono |
| 6 | `RushOverlayFooter` | `.da-foot` | fil de sève + compteur |

Le **fil de sève** (`.da-rail`) enveloppe la liste du chapitre dans `GuideOverlayClient` :
il ne remplace pas les cartes, il les longe à gauche (`left: 8px`). Sa longueur est
**mesurée en géométrie** (`src/lib/da-rail-geometrie.ts` + `getBoundingClientRect`,
un `DaRail` par bloc ; tout validé ⇒ `clientHeight − 48`).

⚠️ **Ne jamais mesurer avec `offsetTop`** (mesure du 05/11/2026) : dès qu'une enveloppe
est positionnée — le guide public enveloppe chaque quête dans un `div.relative` — il
ment (12 px pour 18 lignes, positions réelles de 32 à 2 666 px). Le verrou
`tests/unit/da-wakfu.test.ts` l'interdit dans `use-da-rail.ts`.

Le **conseil** dépliable (`.da-conseil`) est opt-in : seul l'overlay le demande
(`collapsible`) à `RushInfoSequenceBanner` **et** à `RushInfoBanner` — le dashboard et
le guide public gardent l'encart toujours ouvert.

Les **toasts** Sonner (`.da-toast`) sont montés sous la portée `data-da` de l'overlay :
ils héritent des jetons (un toast posé à côté retombait sur un noir en dur).

Le **thème** n'est plus passé en prop : `data-theme` sur la racine de l'overlay, et
`DaThemeProvider` (`src/components/da/da-theme.tsx`) pour les surfaces sorties de
l'arbre (portails `createPortal`).

### Densité de l'en-tête (hôte PiP)

| Hauteur de l'hôte | `data-density` | Titre |
|---|---|---|
| ≥ 900 px | `wide` | 56 px, hero `min(276px, 30vh)`, frise de stade visible |
| 640–899 px | `normal` | 44 px, hero 112 px, sans frise |
| < 640 px (ou largeur < 580) | `tight` | 34 px, hero 80 px, sans kicker ni frise |

Le palier est calculé **une fois**, par le `ResizeObserver` de la racine de l'overlay
(`GuideOverlayClient`), et passé en prop `density` — l'en-tête ne devine rien.

Budget : la frise de stade est réservée à `wide` et le hero `wide` est plafonné à
`30vh` (mesure du 05/11/2026 : 276 px sur un PiP de 870 px mangeait un tiers de la
fenêtre). Reste à contrôler sur capture qu'un hôte de 600 px laisse assez de liste.

### Qualité

`data-quality="low"` sur la racine de l'overlay : grain coupé, filtres coupés sauf
l'écriteau. `data-quality="high"` réservé au guide plein écran.

## 2. Modales — la fenêtre de la DA hors de son arbre

Radix porte ses `DialogContent` dans `document.body`, et trois modales du Rush
sont des portails maison : **ni `data-da`, ni `.rush-guide` ne les atteint**.
La portée se repose sur le nœud portailé, avec **deux** choses et pas trois :

| Pièce | Où | Rôle |
|---|---|---|
| `daScopeProps(useDaTheme())` | `src/lib/da-scope.ts` | rend `data-da` / `data-theme` / `data-block` / `style --da-acc` ; rend `{}` **hors** fournisseur |
| `.da-portal` | `src/app/globals.css` | ajoute le nœud à la passerelle : les 21 jetons produit empruntent `--da-*` |
| `.da-modal` | `src/app/da-wakfu.css` | la matière : `--da-card`, filet `--da-ln` 1,5 px, rayon **12 px**, liseré `--da-outline` |

```jsx
const daScope = daScopeProps(useDaTheme());
<DialogContent {...daScope} overlayClassName="da-modal-scrim"
  className="da-modal da-portal sm:max-w-lg gap-0 p-0">
  <DialogHeader className="da-modal-head">
    <DialogTitle className="da-modal-title">…</DialogTitle>
    <DialogDescription className="da-modal-sub">…</DialogDescription>
  </DialogHeader>
  <div className="da-modal-body">…</div>
  <DialogFooter className="da-modal-foot">…</DialogFooter>
</DialogContent>
```

**Ce que ça change, et ce que ça ne change pas.** Le contenu intérieur n'est pas
réécrit : il garde ses `bg-surface` / `border-border` / `text-foreground` /
`text-warning` et suit la DA par la passerelle. Un geste d'habillage ne déplace
aucun bouton, ne change aucun libellé, ne remplace pas les `<Button>` produit.

**Deux gardes-fous mesurés (05/11/2026).**
- `useDaTheme()` rend **`null`** hors portée : les modales partagées avec un écran
  non migré (`OcreProgressModal` est aussi montée par le module Quêtes Dofus, la
  fiche de quête par le studio God) gardent leur habillage produit. Ne jamais
  remettre un défaut « sombre + Émeraude ».
- `.da-modal` emploie `var(--da-card, var(--surface))` : hors portée les `--da-*`
  ne sont pas définis et la modale serait **transparente**.

Le voile est `.da-modal-scrim` (`backdrop-filter: none`) : la DA refuse le flou
d'arrière-plan.

### Les modales du Rush (état livré le 05/11/2026)

| Modale | Fichier | Enveloppe |
|---|---|---|
| Alignement de la guilde | `dofus-quests/rush/GuildAlignmentModal.tsx` | Radix |
| Alignement & Ordre | `dofus-quests/AlignmentModal.tsx` | Radix |
| Progression par Dofus (interne **et** public) | `dofus-quests/rush/RushDofusDetailModal.tsx` | Radix (fiche partagée) |
| Mon Ocre | `dofus-quests/OcreProgressModal.tsx` | Radix (3 écrans) |
| Pense-bête | `dofus-quests/rush/RushPenseBeteModal.tsx` | Radix (public + interne) |
| Rush Live · Membres · Metamob | `quetes-dofus/guide/[slug]/RushTimelineClient.tsx` | Radix |
| « Reprendre ? » | même fichier (inline) | maison |
| Réinitialiser | `dofus-quests/ResetConfirmModal.tsx` | maison |
| Accueil du Rush | `dofus-quests/RushOnboardingWizardModal.tsx` | maison |
| Détail de la quête | `overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx` | maison (3 écrans) |

## 3. Guide plein écran — `src/app/guides/rush-sylvestre/`

| Élément | Composant réel | Spécification |
|---|---|---|
| Bandeau + panneau de contrôle | `PublicRushGuideClient` (rendu client) | **une seule carte** `.da-guide-hero` : titre **centré** `clamp(44px, 8.6vw, 92px)`, image du bloc en `cover` + voile `::after`, puis `.da-guide-controls` (barre du haut, tuiles, progression) — voir §2 bis |
| Sommaire | `RushChapterSidebar` | langage du dock, compteur sur mini-écriteau |
| Cartes de quête | mêmes composants que l'overlay | **largeur identique**, jamais agrandies, max 760 px |
| Bannière de bloc | `RushSeparatorBanner` | 140 px (96 px en overlay), écriteau ×1,25 ; l'image du bloc **remplit** le cadre (`cover`) |
| Colonne droite | réutiliser l'existant | inventaire, présence, progression — **aucune requête neuve** |
| Modales | `RushOverlay*Modal` | 520 px centrées ; tiroir 420 px ≥ 1280 |

### 3 bis. Le panneau de contrôle — même anatomie que le guide interne

Demande user du 05/11/2026 : « pk on propose pas le même que l'interne ? ».
Il n'y a **qu'un** panneau, pas une variante publique :

| Rangée | Contenu |
|---|---|
| barre du haut | **Ressources** · **Pense-bête** (les deux outils de contenu ; ni conseil ni cité depuis V2a-5) |
| tuiles | **Personnage actif** (classe, serveur, pseudo **cliquable** pour changer — les mules déclarées sont proposées, chiffres **à droite**) · **Alignement** (blason, tranche — **cliquable** : modale cité → Ordre) · **Metamob** (pseudo + état, lien vers l'espace visiteur) · **Rush Live** (état réel, connectés seulement) · **Ouvrir Overlay** (seule action mise en avant, picto réel `modules/guide.png`) |
| recherche + réglages | champ « Rechercher une quête » + menu **Options** (densité · **Ma cité** en sous-menu radio) |
| progression | **une** barre pleine largeur + « Réinitialiser la progression » |

Le bandeau du titre (V2a-5) : **« Aventure Rush Sylvestre »** + le **Dofus Sylvestre** posé NU à
côté, **aucune image de fond** (le flou venait de l'agrandissement d'une source basse résolution),
et la porte **« Mon espace visiteur »** sous le titre, pour un compte connecté.

Un **anonyme** ne voit ni Metamob ni Rush Live : pas de source, pas de tuile.

Depuis V2a-3 (07/11/2026), la tuile **Personnage actif** porte aussi l'identité du compte :
le bandeau séparé de V2a-1 a été fusionné (deux blocs annonçaient « Personnage actif » pour
la même intention, l'interne n'a qu'une tuile). `visitor` est le seul garde.

⚠️ **Metamob** a une source publique depuis V2a-3 (`metamobPseudo` + `metamobVerified` du
profil visiteur ; la clé d'API n'a aucun chemin). **Rush Live** a la sienne depuis **V2c**
(11/11/2026) : room **SSE par serveur**, consentement `showPresence` **fermé par défaut**
(bouton « Afficher ma présence » dans la modale), et un état **mesuré** — « N en ligne »,
« personne en ligne », « connexion… » ou « présence indisponible » — **jamais un compteur
fabriqué**. Les toasts (bloc validé / Dofus obtenu) suivent la **PiP**. Verrou
`tests/unit/public-rush-live.test.ts`.

Le bandeau a quitté `page.tsx` : il est rendu par le client, qui reçoit
`heroArt` en prop. Un `children` serveur ne pourrait pas héberger les contrôles.

### Grille

- ≥ 1 440 px : 260 | 720–760 | 300, gouttière 32, coque 1 360 px
- 1 280–1 439 px : 240 | 1fr (≥ 680) | 280
- 1 024–1 279 px : contenu + colonne ; sommaire en tiroir 320
- 900–1 023 px : sommaire + contenu ; colonne en fin de page
- < 900 px : disposition de l'overlay

`reg-shell` fait 1 120 px : **ne pas le modifier** (almanax, bestiaire, marché).
La route guide reçoit sa propre coque.

## 4. Écriteau en planches — signature, usage unique

`.da-plank` : deux planches inclinées (−5° / +3°), rayures de bois, chiffres 24 px
avec `#da-brush`. **Uniquement pour le compteur d'un bloc.** Jamais dans une carte,
jamais répété, jamais agrandi au-delà de ×1,25.

## 5. Nœud et états

| État | `data-state` | Rendu | Libellé |
|---|---|---|---|
| Validée | `done` | `--da-ok` plein + coche | « Validée » |
| À faire maintenant | `next` | `--da-acc` + halo 4 px à 26 % | « Faire maintenant » |
| À faire | `todo` | vide | « À faire » |
| Verrouillée | `locked` | pointillé + cadenas, carte à 78 % | « Verrouillée » |

Le **texte** de l'état est toujours affiché : la couleur ne porte jamais seule
l'information.

## 6. Ce qu'un lot d'habillage n'a pas le droit de toucher

- `page.tsx` : auth, `getUserContext`, `getOptimizedGuideDetail`, `resolveRushRoute`,
  panneau Ocre.
- Les server actions de coche et la règle `rush-quest-filter.ts`.
- Les clés de progression locale de l'invité.
- Les ancres `#bloc-<id>`, la pagination « une vue = un chapitre », le JSON-LD.
- L'ordre et le libellé des boutons existants.

## 7. Verrous de tests à réécrire, jamais à supprimer

`tests/unit/rush-guide-ui-polish.test.ts` fige des chaînes de classes
(`mx-3 mt-3 mb-2.5`, `px-3 py-2.5 border-b`). Un passage à la DA **réécrit** ces
verrous avec les nouvelles classes : les supprimer serait verdir en retirant un test.
