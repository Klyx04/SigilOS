---
paths:
  - "docs/**"
  - "AGENTS.md"
---
# Règles documentation

- **Un sujet = un fichier** ; une doc périmée est corrigée ou supprimée, jamais dupliquée.
- **Une seule source d'ordre** : `docs/ROADMAP.md`. Ne pas recréer de `FILE-EXECUTION` ni de `BRIEF`.
- Le récit de session va dans `docs/agents/activeContext.md` (6 blocs) ; l'historique dans `docs/agents/journal-sessions-2026.md`.
- **Un chemin cité doit exister** : `git grep -n "<nom>"` avant renommage ou suppression.
- Pas de `.md` hors `docs/` (sauf `AGENTS.md` et README d'un sous-projet).
- **Documentation PRODUIT (boutons « Documentation » des modules)** : le contenu vit en **base**
  (`DocPage`, édité via **God → Docs**). On l'écrit **en local** dans `src/temp/docs/<slug>.html`
  — **zone volatile, jamais commitée** — et le mainteneur l'uploade lui-même (God → Docs) sur le
  VPS. Le dépôt ne porte que le **slug** et le bouton (`ModuleHelpActions`) : **aucun HTML de doc
  produit** dans `src/` ni `docs/`. Le slug se choisit avec le module (`commandes-discord`,
  `tickets-…`) et reste stable, car les liens existants pointent dessus.
- Dépôt public : aucun ID Discord, e-mail, chemin machine, capture ou secret.
- Après un lot : statut dans `ROADMAP.md` + bloc `activeContext.md` ; aucun nouveau fichier d'état.