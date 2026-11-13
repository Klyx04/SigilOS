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
  (`DocPage`). On l'écrit **en local** dans `src/temp/docs/<slug>.html` — **zone volatile, jamais
  commitée** — et le mainteneur l'uploade lui-même. Le dépôt ne porte que le **slug** et le bouton
  (`ModuleHelpActions`) : **aucun HTML de doc produit** dans `src/` ni `docs/`. Le slug se choisit avec
  le module (`commandes-discord`, `tickets-…`) et reste stable, car les liens existants pointent dessus.
- 🚫 **Public d'une doc produit = les GUILDES, jamais l'exploitation.** Elle ne parle que des pages de
  l'**espace guilde** (`/dashboard/<guildId>/…`, admin ou non). **Interdit** : l'interface
  d'exploitation de la plateforme, ses onglets et ses écrans ; ses fichiers, routes et dossiers
  (`src/app/god*`, `src/lib/god*`, `god-*`, `super-admin`, `isSuperAdmin`) ; le vocabulaire interne
  (slug, catalogue, « déployer », migration, schéma, Prisma, PR, codes d'API). Un geste qu'un admin de
  guilde ne peut pas faire s'écrit « **demandez l'activation au support** » — sans nommer l'outil.
- 📐 **Forme d'une doc produit = un drawer latéral** (540–680 px, ~340 px utiles sur mobile). Donc :
  tableau de **2 colonnes maximum**, aucune ligne de `pre` au-delà de **44 caractères**, pas d'image
  pleine largeur, un sous-titre toutes les 4–5 lignes. Les maquettes sont des **chemins de clics**
  (`Paramètres du serveur ▸ Rôles ▸ …`), pas des captures de l'écran du mainteneur.
  Ces deux règles sont verrouillées par `tests/unit/product-docs-hygiene.test.ts`.
- Dépôt public : aucun ID Discord, e-mail, chemin machine, capture ou secret.
- Après un lot : statut dans `ROADMAP.md` + bloc `activeContext.md` ; aucun nouveau fichier d'état.