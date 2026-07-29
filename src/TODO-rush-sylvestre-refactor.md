# Rush Sylvestre — Refactor TODO

Ce fichier liste tout ce qui reste à implémenter dans `RushTimelineClient.tsx`.
Le commit `74e65d09` sur la branche `feat/rush-sylvestre-refactor` contient déjà les fondations suivantes :

## ✅ DÉJÀ FAIT (commité)

- [x] Contexte `ActiveSeqIdCtx` et `NextSeqIdCtx` créés et wrappés dans le JSX
- [x] Helper `findNextActionableSequence()` — bookmark puis 1ère quête non bloquée
- [x] Helper `findNextSequenceAfter()` — quête suivante après l'active
- [x] `scrollToSequence(seqId)` — focus + scroll animé + pulse ring
- [x] `scrollToActive()` — wrapper vers la séquence active
- [x] `scrollToTop()` / `scrollToBottom()` — scroll extrêmes
- [x] `resumeRush()` — reprendre l'étape ou toast si rien
- [x] `showScrollBottom` state ajouté (manque l'écouteur scroll complet)
- [x] `searchQuery` state + `normalizeSearch` (insensible accents/casse)
- [x] `searchResults` computed — recherche dans subGuideName, tips, note, dungeon, activityTags
- [x] `ContextualHelp` composant + `ContextualHelpCtx` + toggle localStorage
- [x] **Fermeture JSX corrigée** pour les nouveaux contextes

---

## ❌ RESTE À FAIRE

### 1. `showScrollBottom` — écouteur scroll complet
**Fichier :** `RushTimelineClient.tsx` — `useEffect` du scroll (~ligne 768)
**Actuel :**
```ts
const handleScroll = () => setShowScrollTop(getY() > 300);
```
**À faire :** Ajouter `getMaxY()` et setter `showScrollBottom` :
```ts
const getMaxY = () => scrollEl
  ? (scrollEl.scrollHeight - scrollEl.clientHeight)
  : (document.documentElement.scrollHeight - window.innerHeight);
const handleScroll = () => {
  const y = getY();
  const maxY = getMaxY();
  setShowScrollTop(y > 300);
  setShowScrollBottom(y < maxY - 300);
};
```

---

### 2. `isInfoSequence()` — helper manquant
**Fichier :** `RushTimelineClient.tsx`
La fonction `isInfoSequence()` est référencée dans `findNextActionableSequence()` et `findNextSequenceAfter()` mais n'existe pas. Il faut l'ajouter (elle existait dans le rollback).
```ts
function isInfoSequence(seq: Sequence): boolean {
  return Array.isArray(seq.activityTags) && seq.activityTags.some((t: any) => t.type === "info_sequence");
}
```
À placer juste avant les contexts.

---

### 3. Barre d'actions — recherche + "Reprendre mon étape"
**Emplacement :** Environ ligne 1000, après `</div></div>` (fermeture du hero) et avant `<GuildStatusPanel>`.

**À faire :**
Remplacer l'actuel :
```tsx
<div className="flex flex-wrap items-center gap-2 sticky top-20 z-30">
  <button onClick={()=>setHideDone(...)}>...Masquer le fait</button>
</div>
```
Par :
```tsx
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sticky top-20 z-30">
  {/* Recherche */}
  <div className="relative flex-1 min-w-0 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
    <input
      type="text"
      data-tour="quest-search"
      aria-label="Rechercher dans le guide"
      placeholder="Rechercher une quête, un donjon ou une zone…"
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-all"
    />
    {searchQuery && (
      <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>

  {/* Masquer les quêtes terminées */}
  <button onClick={()=>setHideDone(v=>!v)}
    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shrink-0 ${
      hideDone
        ? "bg-amber-600/25 border-amber-400/60 text-amber-300"
        : "bg-emerald-600/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-600/30"
    }`}
  >
    {hideDone ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
    {hideDone ? "Afficher tout" : "Masquer les quêtes terminées"}
  </button>

  {/* Reprendre mon étape */}
  <button onClick={resumeRush}
    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-emerald-400/50 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shrink-0"
    title="Aller à l'étape active"
  >
    <MapPin className="w-3.5 h-3.5" />
    Reprendre mon étape
  </button>

  {/* Aide contextuelle */}
  <button onClick={toggleContextualHelp}
    aria-label="Activer/désactiver les aides"
    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shrink-0 ${
      contextualHelpEnabled
        ? "bg-emerald-600/20 border-emerald-400/50 text-emerald-300"
        : "bg-zinc-900 border-white/10 text-zinc-500"
    }`}
  >
    <CircleHelp className="w-3.5 h-3.5" />
    <span className="hidden md:inline">Aide</span>
  </button>
</div>
```

---

### 4. Styling actif/suivant dans `SequenceRow`
**Emplacement :** Environ ligne 286 — le `return` de `SequenceRow`.

**À faire :**
1. Ajouter les contexts en début de composant :
```ts
const activeSeqId = React.useContext(ActiveSeqIdCtx);
const nextSeqId = React.useContext(NextSeqIdCtx);
const isActive = seq.id === activeSeqId && !isSeqCompleted;
const isNext = seq.id === nextSeqId && !isSeqCompleted && !isActive;
```

2. Modifier le className du `<div data-seq-id={seq.id}>` pour inclure :
```tsx
isActive ? "bg-amber-500/[0.04] border-amber-500/30 ring-1 ring-amber-500/20" :
isNext ? "bg-zinc-900/30 border-zinc-700/40 opacity-80" :
```

3. Ajouter les labels avant le contenu (entre `<div data-seq-id>` et le `flex items-center`) :
```tsx
{isActive && !isSeqCompleted && (
  <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/70 mb-1.5">
    À FAIRE MAINTENANT
  </span>
)}
{isNext && !isSeqCompleted && (
  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
    À VENIR
  </span>
)}
```

4. Ajouter `data-tour="quest-completion"` sur le bouton de validation.

---

### 5. Prérequis — nouveau design ambré cliquable
**Emplacement :** Environ ligne 260 — le bloc `if (prereqBlocked)`.

**Remplacer** l'actuel `bg-zinc-950/40 border-zinc-800/40 opacity-60` par :

```tsx
if (prereqBlocked) {
  const prereqTags = (Array.isArray(seq.activityTags) ? seq.activityTags.filter((x:any)=>x.type==="prereq_text") : []);
  const totalPrereqs = prereqTags.length;
  const singleName = totalPrereqs === 1 ? prereqTags[0]?.name : null;
  return (
    <div data-seq-id={seq.id} className="rounded-2xl border transition-all bg-amber-500/[0.06] border-amber-500/25 hover:border-amber-400/50">
      <div className="px-3 pt-2 pb-0">
        <p className="text-[11px] font-bold text-zinc-300 truncate">{questName}</p>
      </div>
      {totalPrereqs === 1 && singleName ? (
        <button type="button" onClick={e=>{e.stopPropagation();scrollToPrereq(singleName);}}
          className="w-full flex items-center gap-3 px-3 pb-3 pt-1.5 text-left group focus-visible:outline-2 focus-visible:outline-amber-400/50 rounded-2xl"
          aria-label={`Voir la quête requise : ${singleName}`}
          data-tour="quest-prerequisite"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/70 mb-0.5">À terminer avant</p>
            <p className="text-[11px] font-bold text-amber-200 truncate">{singleName}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-amber-400/50 group-hover:text-amber-400/80 transition-colors shrink-0" />
        </button>
      ) : (
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <Lock className="w-2.5 h-2.5 text-amber-400" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/70">{totalPrereqs} prérequis à terminer</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {prereqTags.map((t:any,i:number)=>(
              <button key={i} type="button" onClick={e=>{e.stopPropagation();scrollToPrereq(t.name||"");}}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold text-amber-300 bg-amber-500/[0.08] border border-amber-500/20 hover:bg-amber-500/[0.15] hover:border-amber-400/40 transition-all group focus-visible:outline-2 focus-visible:outline-amber-400/50"
                aria-label={`Voir la quête requise : ${t.name}`}
              >
                <span className="truncate max-w-[140px]">{t.name}</span>
                <ChevronRight className="w-2.5 h-2.5 text-amber-400/50 group-hover:text-amber-400/80 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 6. Navigation flottante — remplacer le bouton `ArrowUp`
**Emplacement :** Environ ligne 1040 — `{showScrollTop && typeof document !== 'undefined' && createPortal(...` le bouton fixe.

**Remplacer** par une pilule verticale :
```tsx
{typeof document !== 'undefined' && createPortal(
  <div className="fixed right-4 z-[999999] flex flex-col items-center gap-1 bg-zinc-950/90 border border-emerald-500/20 rounded-2xl py-2 px-1.5 shadow-2xl backdrop-blur-md"
    style={{ top: '50%', transform: 'translateY(-50%)' }}
  >
    <button onClick={scrollToTop} disabled={!showScrollTop}
      className={`p-2 rounded-xl transition-all ${showScrollTop ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
      title="Remonter en haut" aria-label="Remonter en haut"
    >
      <ChevronUp className="w-4 h-4" />
    </button>
    <button onClick={scrollToActive}
      className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
      title="Reprendre mon étape" aria-label="Reprendre mon étape"
    >
      <MapPin className="w-4 h-4" />
    </button>
    <button onClick={scrollToBottom} disabled={!showScrollBottom}
      className={`p-2 rounded-xl transition-all ${showScrollBottom ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer' : 'text-zinc-700 cursor-not-allowed'}`}
      title="Aller en bas" aria-label="Aller en bas"
    >
      <ChevronDown className="w-4 h-4" />
    </button>
  </div>,
  document.body
)}
```

---

### 7. Résultats de recherche — compteur + filtrage
**Emplacement :** Dans le JSX juste après la barre d'actions, avant la timeline.

```tsx
{searchResults !== null && (
  <div className="flex items-center justify-between px-1">
    <p className="text-[10px] text-zinc-500 font-mono">
      {searchResults.size} quête(s) trouvée(s) pour « {searchQuery} »
    </p>
    <button onClick={() => setSearchQuery("")}
      className="text-[9px] text-zinc-600 hover:text-white transition-colors underline underline-offset-2"
    >
      Effacer la recherche
    </button>
  </div>
)}
{searchResults !== null && searchResults.size > 0 && (
  <p className="text-[9px] text-zinc-600 italic px-1">Les résultats incluent les quêtes terminées.</p>
)}
{searchResults !== null && searchResults.size === 0 && (
  <div className="py-16 text-center">
    <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
    <p className="text-zinc-600 font-black uppercase text-xs tracking-widest mb-1">Aucune quête trouvée</p>
    <p className="text-[10px] text-zinc-500 mb-4">Essaie un autre nom de quête, donjon ou zone.</p>
    <button onClick={() => setSearchQuery("")}
      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs transition-colors"
    >
      Effacer la recherche
    </button>
  </div>
)}
```

---

### 8. Filtrage des `timelineItems` par `searchResults`
**Emplacement :** Dans le rendu des `ChapterBlock`.

**Logique :** Si `searchResults` est non-null, passer `searchResults` aux `ChapterBlock` pour qu'ils n'affichent que les milestones/sequences matchantes. Le plus simple : ajouter une prop `searchFilter` optionnelle à `ChapterBlock`.

```tsx
// Dans ChapterBlock — filtrer les milestones si searchFilter actif
if (searchFilter) {
  filteredMilestones = milestones.filter(ms =>
    ms.sequences.some(s => searchFilter.has(s.id))
  );
}
// Filtrer les sequences dans chaque MilestoneRow de la même façon
```
Ou alternative : créer un `filteredTimelineItems` via useMemo qui intègre déjà le searchResults, évitant de propager la prop.

---

## Ordre d'implémentation recommandé

1. `isInfoSequence()` — 2 lignes, prérequis pour les helpers
2. `showScrollBottom` complétion — 5 lignes
3. Prérequis (étape 5) — bloc indépendant, pas de dépendances
4. Barre d'actions (étape 3) + résultats recherche (étape 7)
5. Styling actif/suivant (étape 4) — dépend des contexts déjà en place
6. Navigation flottante (étape 6) — remplacement direct
7. Filtrage timeline par recherche (étape 8) — dernier, dépend du reste

## Tests manuels à effectuer après implémentation

- [ ] Pas de bookmark : la 1ère quête non terminée est "À FAIRE MAINTENANT"
- [ ] Bookmark de milestone : la quête associée devient active
- [ ] Toutes les quêtes terminées : plus rien en "À FAIRE MAINTENANT"
- [ ] Quête avec un prérequis : le nom reste visible + carte "À terminer avant"
- [ ] Plusieurs prérequis : "X prérequis à terminer" + chips cliquables
- [ ] Recherche avec accents : "éon" trouve "Ébène"
- [ ] Recherche de donjon : "incarnam" trouve les quêtes liées
- [ ] Recherche sans résultat : message + bouton effacer
- [ ] Filtre Dofus actif + recherche combinés
- [ ] Navigation flottante : haut/milieu/bas fonctionnent
- [ ] "Reprendre mon étape" scroll vers la bonne quête
- [ ] "Masquer les quêtes terminées" fonctionne
- [ ] Desktop et mobile (responsive)
- [ ] SSR sans `window` / `document`