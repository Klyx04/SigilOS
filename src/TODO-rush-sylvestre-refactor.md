# Rush Sylvestre — Refactor TODO ✅ TERMINÉ

## ✅ FAIT (4 commits sur `feat/rush-sylvestre-refactor`)

### `isInfoSequence()` helper
- [x] Fonction ajoutée avant les contexts, résoud le crash runtime

### `showScrollBottom` — écouteur scroll complet
- [x] `getMaxY()` + setter dans `handleScroll`

### Prérequis — design ambré cliquable
- [x] Lock + "À terminer avant" + ChevronRight
- [x] 1 prérequis : bouton pleine largeur
- [x] Plusieurs prérequis : chips indépendants
- [x] `data-tour="quest-prerequisite"` + `aria-label`

### Barre d'actions — recherche + boutons
- [x] Input search avec Search icon + X bouton + placeholder exact
- [x] `data-tour="quest-search"`, `aria-label`
- [x] "Masquer les quêtes terminées" (toggle existant conservé)
- [x] "Reprendre mon étape" (nouveau bouton)
- [x] "Aide" (toggle contextual help)
- [x] Responsive (flex-col sur mobile)

### Résultats de recherche — compteur + filtrage
- [x] Compteur : "X quête(s) trouvée(s) pour « ... »"
- [x] Message : "Les résultats incluent les quêtes terminées."
- [x] Écran vide : "Aucune quête trouvée" + bouton "Effacer la recherche"
- [x] Recherche accent-insensible (normalize NFD)

### Filtrage timeline par searchResults
- [x] `searchFilter` prop dans `ChapterBlock`
- [x] `filteredMilestones` via useMemo
- [x] Séquences filtrées par milestone
- [x] Chapitres ouverts automatiquement

### Styling actif/suivant dans SequenceRow
- [x] `ActiveSeqIdCtx` / `NextSeqIdCtx` lus
- [x] Label "À FAIRE MAINTENANT" (fond ambré discret)
- [x] Label "À VENIR" (style sobre)
- [x] `data-tour="quest-completion"` + `title`/`aria-label`

### Navigation flottante
- [x] Pilule verticale : haut / reprendre / bas
- [x] `z-[999999]`, `backdrop-blur-md`
- [x] `showScrollTop` et `showScrollBottom`

### Bookmark par séquence
- [x] `handleBookmarkSequence` toggle bookmark
- [x] `BookmarkedSeqCtx` / `OnBookmarkSeqCtx`
- [x] Bouton "Rendu ici" dans chaque quête (à côté des favicons Noobs/DofusDB)
- [x] Icône `Flag`/`BookmarkCheck` + styling amber
- [x] Priorité bookmark dans `findNextActionableSequence`
- [x] `resumeRush()` : bookmark > active > toast
- [x] `resumeRush()` efface `searchQuery` si actif
- [x] Compatibilité legacy `bookmarkedMsId` conservée

### Aide contextuelle
- [x] Composant `ContextualHelp` avec hover/focus/click
- [x] `ContextualHelpCtx` + toggle localStorage
- [x] Placement sur la barre de recherche

## ❌ AUCUNE TÂCHE RESTANTE

Tout ce qui était dans le TODO initial et le safe-plan est implémenté.
Aucune modification backend, aucun import supprimé, aucune régression.