> # ⚠️ STATUT À JOUR (02/09) — ce fichier était la liste de correction « first-pass » DeepSeek.
> **📌 03/09 — Chantier Rush Sylvestre** (branche `feat/rush-sylvestre-refonte` → PR `dev`) : positions GPS copiables (overlay + dashboard via `getSequenceCoord`), dashboard aligné overlay (modale Ressources globale Restantes/Toutes, badge Main/Mule, fix `/travel` 2D, sidebar chapitre), synchro clic chapitre → sidebar, copie du nom de ressource (helper `copyToClipboard`), fix clipboard overlay (fallback `execCommand`), **ressources 200 → 515** (séquence « Ressources à prévoir » ajoutée en base + seed idempotent), item tags unresolved 38→15. **Vérifs** : tsc 0 · eslint 0 · vitest 474/474. **Reste à faire** : voir `activeContext.md` NEXT (migrate deploy alignmentBefore · ménage Songes · 15 unresolved · quêtes Apprentissage · liens → modale · badges pack dashboard · perf getSequenceHelpers · nettoyage `as any`).
> **📌 03/09 (session UX/sync) — branche `feat/rush-sylvestre-ux-v2` → PR `dev`** : images ressources **local-first** (`resolveItemImage`/`getItemImageFallback`/`ResourceImage`, 0 dépendance DofusDB + fallback proxy), **fix décompte ressources « Restantes »** (dashboard passait `completedIds`=chapitres → utilisé `allCompletedSeqIds`=séquences ; overlay `gateAllCompleted` inclut les chapitres validés d'un coup), **overlay responsive** (scroll quêtes `min-h-0`+`custom-scrollbar`, objectif repliable/auto-repli + chips rangée unique, header compact + menu ⋯ via ResizeObserver). **Vérifs** : tsc 0 · eslint 0 · vitest **484/484**. **Reste** : voir `activeContext.md` NEXT.
> **📌 04/09 — refonte visuelle anti-slop + fil conducteur** (branche `feat/chantier-2026-09-04-cyber-rescan`, **non committé**) : bug header ressources sidebar (2 lignes, toggle compact, Total/Encore, `×`) · ancres œufs 40px + vignettes chapitres · strip retiré (doublon, `dofusId` faible) · panneau guilde clic=filtre + membres top 8, modale vide supprimée, fix `%` · hero diet + boutons ghost + Overlay primaire + Signaler icône · ambiance + particules teintées (toggle Options) · feedback overlay natif. **Vérifs** : tsc 0 · eslint 0 · 64/64 tests rush. **Reste n°1 : backfill `dofusId` en God** (détail : `src/temp/memo-2026-09-04-rush-refonte-visuelle.md`).

> **Résolu en session 30/08** (voir `src/temp/chantier-actif.md`) :
> - ✅ **Info sequences non-cochables** (item 8) : `info_sequence` ne se coche pas, ne compte pas, n'est jamais candidate.
> - ✅ **Actionnable = pas bloquée** (item 2, partiel) : `getNextObjective` + bloc objectif skippent les séquences bloquées par prérequis réels (`isSequenceBlockedByPrereqs`).
> **Restant (à traiter si pertinent, cf. roadmap S4/S6/S5/S7)** : recherche + `hideDone` sur milestones entièrement terminés (item 3) · bookmark strictement par quête (item 4) · modale de reprise (item 5) · navigation flottante via `resumeRush()` (item 6) · cibles de clic de validation (item 7) · data-tour (item 9).
> **Nouvelle road map** : S4 (« qui peut aider », audit données d'abord) → S6 (moments premium) → S5 (éditeur GOD) → S7 (contexte chapitre).
> **📌 30/08 (suite) — détour alignement livré** (commit `9926947c7`) : quête d'alignement `alignment_set` (marquage GOD « Alignement », coche écrase / décoche restaure la dernière encore cochée, reset démarrage, cascade décoche) + badge par quête (dashboard+overlay) + visibilité niveau des rushers (Rush Live + panneau Dofus, alignement par personnage actif principal/mule) + nettoyage icônes (section GOD, admin texte-seul, rendu membre) + migration `alignmentBefore`. Vérifs : tsc 0 · eslint 0 · 424 tests.
> **✅ S4 « qui peut aider » métier/donjon : FAIT (31/08)** — `getSequenceHelpers` (garde guilde + Zod + rate-limit), badge « X peut aider » (dashboard + overlay), [Inviter/Partager] (`inviteHelperForSequence` + `listRushTextChannels`). **Gap A métier+niveau FAIT** (`metiers` enrichi `[{id,name,level}]`, `src/lib/metiers.ts`). L'éditeur « Métier requis » a été ré-ajouté dans GOD (Section 4). Vérifs : tsc 0 · eslint 0 · vitest 465/465 · build OK. => Commit `33255b723` + correctifs CodeQL (PR #571).

---

Ce qui est bien implémenté

Le fichier contient réellement les éléments annoncés :

Recherche accent-insensible sur quêtes, références, tips, notes, donjons et tags, avec compteur, état vide et effacement.

Barre d’actions avec recherche, masquage des terminées, reprise d’étape et toggle d’aide.

Pré-requis transformés en blocs ambre cliquables, avec une présentation distincte pour un ou plusieurs prérequis.

Marqueur “Rendu ici” au niveau de la quête, à côté de Noobs/DofusDB, et non plus comme CTA de bookmark du bloc.

Mise en avant “À FAIRE MAINTENANT” / “À VENIR”, navigation flottante haut/reprise/bas et compatibilité de lecture avec l’ancien bookmark de milestone.

Donc sur l’intention principale, c’est bon : tu as bien obtenu le passage de “j’en suis là par bloc” à “Rendu ici par quête”, ce qui correspond mieux à ta logique de progression multi-blocs.

Problèmes à corriger
1. Violation des règles de Hooks React
Dans SequenceRow, React.useContext(AllCompletedSeqIdsCtx) et React.useContext(AllMilestonesCtx) sont appelés dans une fonction IIFE utilisée pour calculer prereqBlocked. C’est contraire aux règles des Hooks : un hook doit être appelé directement au niveau supérieur du composant, pas dans une fonction imbriquée. Cela peut déclencher une erreur ESLint react-hooks/rules-of-hooks, et rend le “lint silencieux” douteux.

Correction : remonter ces deux contexts en haut du composant, comme les autres :

tsx
const allCompletedSeqIds = React.useContext(AllCompletedSeqIdsCtx);
const allMilestones = React.useContext(AllMilestonesCtx);

const prereqBlocked = !isSeqCompleted && (() => {
  const prereqNames = Array.isArray(seq.activityTags)
    ? seq.activityTags
        .filter((tag) => tag.type === "prereq_text")
        .map((tag) => tag.name?.toLowerCase())
        .filter(Boolean)
    : [];

  if (!prereqNames.length) return false;

  return allMilestones.some((candidateMs) =>
    candidateMs.type !== "SEPARATEUR" &&
    candidateMs.type !== "INFO" &&
    candidateMs.sequences.some((candidateSeq) => {
      if (candidateSeq.id === seq.id) return false;
      const candidateName = (
        candidateSeq.subGuideName ||
        candidateSeq.subGuideRef ||
        ""
      ).toLowerCase();

      return (
        prereqNames.includes(candidateName) &&
        !allCompletedSeqIds.has(candidateSeq.id)
      );
    })
  );
})();
2. L’algorithme “actionnable” est faux
findNextActionableSequence() écarte une quête dès qu’elle a un tag prérequis, même si le prérequis est déjà terminé. Donc une quête avec prérequis validé ne deviendra jamais “À FAIRE MAINTENANT”. Il faut tester si les prérequis sont réellement non terminés, pas simplement s’ils existent.

Même erreur dans findNextSequenceAfter() : il trouve simplement la prochaine quête non terminée, sans vérifier qu’elle n’est pas bloquée.

Conséquences possibles :

le label “À FAIRE MAINTENANT” saute certaines quêtes valides ;

“Reprendre mon étape” peut ramener vers une étape bloquée ;

“À VENIR” peut désigner une quête non jouable.

3. La recherche ne respecte pas complètement hideDone
La recherche force bien l’affichage des séquences terminées, ce qui est souhaité. Mais MilestoneRow contient encore :

tsx
if (hideDone && isCompleted) return null;
Donc un milestone entièrement terminé, mais contenant un résultat, reste caché lorsque hideDone est actif. C’est incohérent avec le texte affiché : « Les résultats incluent les quêtes terminées. »

Correction : transmettre isSearching à MilestoneRow, puis appliquer :

tsx
if (hideDone && isCompleted && !isSearching) return null;
ou forcer hideDone={false} dans le rendu des résultats de recherche.

4. Le marqueur de bloc n’a pas totalement disparu
Il n’y a plus de bouton “J’en suis là” sur le milestone, ce qui est bien. Mais le milestone continue de recevoir isBookmarked, affiche un badge “Rendu ici” dans son header et une bordure ambre. Cela donne encore visuellement l’impression que le bloc est bookmarké.

C’est acceptable uniquement comme compatibilité legacy temporaire, mais côté UX membre il faut supprimer :

tsx
{isBookmarked && <span>… Rendu ici</span>}
et ne garder le bloc ambre/ouvert automatiquement que lorsqu’il contient la quête bookmarkée actuelle — sans afficher de badge “Rendu ici” sur le bloc.

5. La modale de reprise utilise encore le bloc
La modale continueModalOpen est déclenchée sur bookmarkedMsId, puis affiche :

“Tu étais à {ms.title}.”

Elle ne reprend pas réellement vers bookmarkedSeqId : elle scroll vers [data-ms-id]. Cela contredit la décision produit “repère uniquement par quête”.

Elle doit plutôt :

se déclencher avec effectiveBookmarkSeqId;

retrouver la quête et son milestone ;

afficher le nom de la quête ;

appeler scrollToSequence(bookmarkedSeqId).

Exemple :

tsx
const bookmarkedSequence = useMemo(() => {
  if (!effectiveBookmarkSeqId) return null;

  for (const milestone of milestones) {
    const sequence = milestone.sequences.find(
      (item) => item.id === effectiveBookmarkSeqId
    );

    if (sequence) return { milestone, sequence };
  }

  return null;
}, [milestones, effectiveBookmarkSeqId]);
Puis dans la modale :

tsx
<p>
  Tu étais sur{" "}
  <strong>{bookmarkedSequence.sequence.subGuideName}</strong>.
</p>

<button
  onClick={() => {
    scrollToSequence(bookmarkedSequence.sequence.id);
    setContinueModalOpen(false);
  }}
>
  Reprendre
</button>
6. La navigation flottante contourne la logique de reprise
Le bouton central de la pilule appelle scrollToActive, pas resumeRush. Or scrollToActive ne vide pas la recherche et n’applique pas explicitement la priorité/feedback de resumeRush.

Il doit simplement faire :

tsx
<button onClick={resumeRush} ...>
Ainsi, la barre d’actions et le widget flottant ont strictement le même comportement.

7. data-tour est répété
data-tour="quest-completion" est appliqué à chaque bouton de validation, et data-tour="quest-prerequisite" à chaque prérequis unique. Or le cahier des charges demandait le premier élément visible seulement.

Ce n’est pas bloquant tant qu’aucun tour guidé ne cible ces sélecteurs, mais cela doit être corrigé avant d’étendre l’onboarding : il faut calculer quel élément est le premier ou réserver ce sélecteur à une prop isFirstVisible....

8. L’aide contextuelle est incomplète
DeepSeek annonce l’aide contextuelle “terminée”, mais elle est actuellement placée seulement près de la recherche. Les aides prévues pour :

validation ;

Rendu ici ;

prérequis ;

toggle terminées ;

avatars de membres ;

bouton “Reprendre” flottant ;

ne sont pas présentes.

Ce n’est pas grave, et je te conseille même de ne pas les ajouter maintenant. L’aide actuelle suffit comme preuve du mécanisme ; l’UX principale doit rester compréhensible sans tooltip.

9. Validation de quête encore trop petite
La cible du bouton de validation est actuellement p-0.5 avec une icône w-4 h-4. Elle est loin de l’objectif de 36 px desktop / 44 px mobile demandé.

Correction minimale :

tsx
className="
  flex h-9 w-9 sm:h-10 sm:w-10
  items-center justify-center
  rounded-xl
  text-zinc-500
  hover:bg-emerald-500/10
  hover:text-emerald-400
  transition-colors
"
Et icon :

tsx
<Circle className="h-5 w-5" />
10. Risque fonctionnel sur les séquences INFO
Le fichier introduit isInfoSequence, mais MilestoneRow affiche ensuite chaque séquence avec SequenceRow, sans branche dédiée pour rendre les info_sequence comme bandeaux non cochables. Cela peut faire apparaître une info comme une quête à valider ou perturber le calcul des compteurs.

Il faut restaurer une logique nette :

tsx
if (isInfoSequence(sequence)) {
  return <InfoSequenceRow key={sequence.id} seq={sequence} />;
}

return <SequenceRow ... />;
Verdict
Le travail est à environ 80–85% “fonctionnellement aligné” avec ton prompt, pas 100%. La structure visuelle est dans la bonne direction, et aucune refonte destructrice n’apparaît. Mais DeepSeek doit encore corriger l’algorithme des quêtes actionnables, finir la migration UX du bookmark bloc vers quête, corriger le filtrage recherche + quêtes terminées, et grossir la cible de validation.

Prompt de correction à DeepSeek
text
Tu as terminé une première implémentation de RushTimelineClient.tsx.

Ne refais rien, ne change aucun backend, aucune server action, aucun schéma Prisma, aucune route, aucun composant externe.

Corrige uniquement les problèmes ci-dessous dans ce même fichier.
Avant de modifier : confirme chaque emplacement concerné et donne un mini-plan.
Après : donne le diff précis, lance TypeScript et ESLint.

1. RULES OF HOOKS
Dans SequenceRow, AllCompletedSeqIdsCtx et AllMilestonesCtx ne doivent pas être lus dans une IIFE ou une fonction imbriquée.
Remonter les deux useContext au niveau supérieur de SequenceRow.

2. ACTIONNABLE = NON TERMINÉE ET NON BLOQUÉE
Créer un helper pur commun, sans hook, pour déterminer si une sequence a au moins un prérequis réellement non terminé.
Une quête avec un tag prereq_text dont tous les prérequis sont terminés doit être considérée actionnable.
Utiliser exactement ce helper dans :
- findNextActionableSequence
- findNextSequenceAfter
- SequenceRow
Ne pas simplement ignorer les quêtes qui possèdent un tag prereq_text.

3. RECHERCHE + HIDE DONE
Lorsque searchResults est actif, les milestones entièrement terminés qui contiennent une séquence trouvée doivent rester visibles.
Le texte « Les résultats incluent les quêtes terminées » doit correspondre au comportement réel.
Ne pas modifier hideDone hors recherche.

4. BOOKMARK UNIQUEMENT PAR QUÊTE
Le bouton bookmark reste uniquement dans SequenceRow et son libellé reste « Rendu ici ».
Supprimer dans MilestoneRow :
- le badge « Rendu ici » du header ;
- le style visuel qui suggère qu’un bloc est le point de reprise.
Conserver bookmarkedMsId uniquement pour compatibilité legacy et ouverture automatique éventuelle.
Le bloc doit pouvoir s’ouvrir quand il contient bookmarkedSeqId, mais ne doit pas porter de libellé de bookmark.

5. MODALE DE REPRISE
La modale de reprise doit prioriser bookmarkedSeqId.
Elle doit afficher le nom de la quête bookmarkée, pas seulement le titre du bloc.
Le CTA Reprendre doit appeler scrollToSequence(bookmarkedSeqId).
bookmarkedMsId reste seulement en fallback legacy.

6. NAVIGATION FLOTTANTE
Le bouton central de la pilule doit appeler resumeRush(), pas scrollToActive(), afin d’avoir exactement le même comportement que le bouton de barre d’action : bookmark prioritaire, effacement de recherche, toast si aucune étape.

7. BOUTON DE VALIDATION
Agrandir la zone cliquable de validation :
- minimum 36 x 36 px desktop ;
- minimum 44 x 44 px mobile ;
- conserver la logique et les icônes actuelles ;
- ne pas modifier la densité de toute la carte.

8. INFO SEQUENCES
Les sequences avec activityTags.type === "info_sequence" ne doivent jamais :
- être cochables ;
- compter dans la progression ;
- être candidates à la quête active/suivante.
Elles doivent être rendues avec le composant bandeau informatif déjà prévu ou un rendu non interactif équivalent.

9. DATA-TOUR
quest-completion et quest-prerequisite doivent être posés sur le premier contrôle pertinent rendu, jamais sur tous les contrôles.
Ne crée pas de nouveau tour guidé.

Ne modifie aucun autre comportement.
C’est ce prompt de correction ciblé que je donnerais maintenant, pas un nouveau full prompt.