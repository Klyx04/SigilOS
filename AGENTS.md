# AGENTS.md — amorce des assistants IA (SigilOS)

> **À lire à chaque session, en entier.** Ce fichier est le **point d'entrée unique** des assistants
> (Cline, Cursor, Copilot, Codex, Gemini CLI…) : il dit **quoi lire, quand, et ce qui n'est jamais
> négociable** : 145 lignes, ~2 500 tokens — le minimum vital, tout le reste se lit à la demande.
> Format ouvert [AGENTS.md](https://agents.md), lu automatiquement : **il n'y a plus de « bloc à coller »**.
>
> **Il ne duplique aucune documentation.** Une information qui vit dans `docs/` est **pointée**, jamais
> recopiée : une règle modifiée ailleurs n'a rien à répercuter ici (sauf le tableau §2).
> Langue du dépôt : **français** (code, commits, docs, réponses).

---

## 1. Le projet en 6 lignes

Tableau de bord de guilde **Dofus** : site **Next 16** (React 19, App Router) + **Prisma 7 / PostgreSQL** +
Redis + **bot Discord** (`services/`, discord.js) + workers BullMQ et Workers Cloudflare.
Sites : `sigilos.fr` (prod) · `beta.sigilos.fr` (bêta). **Multi-tenant** : tout est cloisonné par `guildId`.
Branches : `main` = **prod** · **`dev` = branche par défaut** (bêta) · `feat/*`, `fix/*`, `docs/*` à la demande.
⚠️ **Dépôt PUBLIC** (vitrine technique, aucune licence) : ni donnée personnelle, ni secret, ni capture du
poste de travail, ni empreinte machine (chemin local, ID Discord, métadonnée d'image, e-mail).

## 2. Où lire quoi — le minimum suffisant

| Besoin | Source de vérité |
|---|---|
| **Quoi faire / statut des chantiers** | `docs/ROADMAP.md` (backlog canonique — **à lire en premier en mode plan**) |
| État réel entre 2 sessions | `docs/agents/activeContext.md` — **en-tête + bloc du sujet uniquement** (jamais en entier) |
| Coder aux conventions + sécurité | `docs/RULES.md` (§ Security · § fail-closed · § Code Organization · § Git Workflow) |
| Politique de sécurité publique | `docs/SECURITY.md` |
| Architecture, modules, pièges | `docs/CONTEXT.md` |
| Démarrer en local (prérequis, env, commandes) | `docs/DEVELOPPEMENT.md` |
| Ops : cron, déploiement, incidents | `docs/MAINTENANCE.md` |
| « C'est quoi ce fichier ? » | `docs/arbo/CARTE-DU-PROJET.md` |
| Procédure ciblée | `docs/agents/` : `git-push` · `prisma-schema-change` · `add-cron-task` · `discord-module` · `dev-local` · `deploy-vps` · `disaster-recovery` · `zone-volatile` |
| Amorce détaillée (sources, méthode, DoD) | `docs/agents/session-amorce.md` — **à la demande**, pas par défaut |
| Index complet de la doc | `docs/README.md` |

**Ne lis pas par défaut** : l'historique long, les rapports d'audit (`docs/audits/`, non versionnés), les
plans de module — **seulement si la tâche l'exige**. Ne déverse jamais tout le dépôt dans le contexte.

## 3. Zones de travail

- `src/temp/` = **zone volatile** (brouillons de session : mémo, `debug.md`, sonde). Elle n'existe **que si
  une session la crée**, n'est **jamais versionnée** ; règle complète : `docs/agents/zone-volatile.md`.
- **Jamais committé** : `.env*` · `docs/audits/` · `AUDIT_*.md` · `src/audit-*` · dumps `.sql`/`.xlsx` ·
  artefacts de build (`dist/`, `.next/`, `tsconfig.tsbuildinfo`) · toute capture du poste.
- **Toute documentation vit dans `docs/`** — un sujet = un fichier. Aucun `.md` ailleurs, hors `README.md`
  racine et `README.md` d'un sous-projet autonome.

## 4. Hygiène : zéro dette technique (non négociable)

> Un agent qui laisse un fichier derrière lui livre de la dette. C'est un **défaut de livraison**, pas un détail.

1. **Tout artefact créé pour la tâche est supprimé avant de rendre** : sonde `_probe-*.mjs`, script jetable,
   fichier de test hors `tests/`, fixture temporaire, dump, capture, `*.tmp`, `*.log`, `scratch-*.ts`.
   Si le résultat est utile, il devient **un test dans `tests/`** ou **une ligne de doc** — jamais un fichier orphelin.
2. **`git status --short` doit être propre** (hors chemins ignorés) **à la fin de chaque tâche** — c'est la
   preuve du point 1. Un fichier non suivi qui resterait doit être soit gitignoré (avec raison écrite), soit supprimé.
3. **Aucun doublon** : pas de deuxième doc sur un sujet existant, pas de fichier d'état parallèle, pas de
   copie d'un fichier vivant, pas de `-old`/`-new`/`-v2`/`.bak`. On **corrige** ou on **supprime** — jamais on duplique.
4. **Pas de code mort ni de workaround silencieux** : pas de test désactivé (`.skip`, `.only`), pas de
   `console.log` (→ `logger`), pas de `eslint-disable` sans justification en commentaire, pas de `TODO`
   hors `docs/ROADMAP.md`. Ne jamais verdir un test en le supprimant.
5. **Pas de scope creep** : une idée hors brief se note en « reste » (ou dans `ROADMAP`), elle ne se code pas.
6. **Les hooks et la CI ne sont pas contournables** : `--no-verify` seulement pour un cas explicitement
   documenté dans la PR.

## 5. Sécurité — invariants (détail et contre-exemples : `docs/RULES.md` § Security)

1. **Auth sur chaque action** (`await auth()` ou `getUserContext(guildId)`) ; **RBAC fail-closed**, sur la
   page **et** dans l'action ; `isSuperAdmin()` pour tout ce qui touche au cycle de vie.
2. **Isolation de guilde** : toute requête DB filtre par `guildId` **résolu côté serveur**, jamais depuis le
   client ; vérifier que la cible appartient à la guilde **avant toute écriture**.
3. **Validation Zod bornée** sur toute entrée utilisateur **et** sur les données d'API externe (longueur, plage).
4. **Fail-closed** : si Discord, Redis ou un tiers échoue, on **refuse** — jamais d'accès accordé par défaut.
5. **Aucun secret en dur, aucun fallback** : `process.env.*` avec **échec explicite** si absent.
6. **Comparaison de secrets en temps constant** (`timingSafeEqual`) · **pas de SQL brut** (Prisma) · **pas d'`eval`**.
7. **`logger`, jamais `console.log`** ; rien de sensible ne part dans les logs (token, snowflake, e-mail).
8. **Rate limit** sur les mutations (réponse `429` propre ; store Redis/DB, jamais une variable en mémoire).
9. **Garde d'état dans le `WHERE`** (mise à jour conditionnelle) pour éviter les courses.
10. **`src/proxy.ts`, jamais `src/middleware.ts`** — sur Next 16, Edge inline `process.env` au build.
11. **Zéro empreinte** : pas de chemin machine (`os.homedir()`), pas d'ID Discord/personnel en dur, pas de
    capture du poste, **zéro métadonnée** dans les images (`node scripts/check-media-metadata.mjs`).

## 6. Commandes

```bash
npm install                        # installe aussi le hook pre-commit (husky)
docker compose up -d db redis      # PostgreSQL (hôte 5433) + Redis
npx prisma generate                # après tout changement de schéma
npm run dev                        # http://localhost:3000

npm run test:run                   # Vitest complet (~1 700 tests) — obligatoire avant PR
npx tsc --noEmit                   # TypeScript (déjà joué par le hook pre-commit)
npm run lint                       # ESLint
npm run build                      # build de prod (délégué à la CI si `next dev` tourne — dis-le)
npm run seed:docs                  # si docs-catalog.ts a changé
```

Déploiement : `./scripts/deploy-cd.sh <env> [sha]` (voie normale) · repli `./scripts/deploy.sh <env>` ·
retour arrière `./scripts/rollback.sh` (détails : `docs/MAINTENANCE.md`).

## 7. Méthode et workflow (1 chantier = 1 branche = 1 PR → `dev`)

1. **Mesurer avant de corriger** : reproduire, puis établir la **cause racine mesurée** (sonde, requête SQL
   en lecture seule, `curl` d'une route, logs). On écrit la **mesure**, jamais « ça devait être ».
2. **Corriger au bon étage** : règle pure `src/lib/**` > serveur `src/server/**` > composant ; **une seule
   source de vérité** par règle — pas de correctif dupliqué dans deux écrans.
3. **Tester le comportement**, pas le rendu : test unitaire dans `tests/` + non-régression des verrous existants.
4. **Prouver** : capture avant/après ou mesure chiffrée.
5. **Push** : `git fetch origin dev && git merge origin/dev --no-edit`, puis
   `npm install --package-lock-only` **si `package.json` a bougé** (sinon la CI casse en `EUSAGE` sur le
   lockfile) — procédure : `docs/agents/git-push.md`.
6. **PR vers `dev`** (jamais pousser sur `main`/`dev`) : commits en français, `gh pr checks` jusqu'au vert,
   merge, branche supprimée, `dev` repullé.
7. **Arrêt immédiat + question** avant : migration de schéma · changement d'interface **publique** Discord ·
   action **God** · suppression de données · ou si une mesure contredit le brief.

## 8. Fin de session (Definition of Done)

- [ ] Vérifs vertes : `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · CI verte (`gh pr checks`).
- [ ] `git status --short` **propre** : aucun artefact de la tâche n'a survécu (§4).
- [ ] Docs mises à jour **là où elles vivent** : `docs/ROADMAP.md` (statut du chantier) +
      `docs/agents/activeContext.md` (**nouveau bloc EN HAUT**, les 6 dernières sessions seulement — règle de
      rotation en tête du fichier). **Aucun nouveau fichier d'état, aucun mémo dupliqué.**
- [ ] Ops côté humain listées (migration à jouer, écran à contrôler, variable d'env à poser).
- [ ] Rapport final **≤ 15 lignes** : fait · reste · côté utilisateur.

## 9. Maintenir cette amorce

Ce fichier reste **court et exact** : il *route*, il ne *documente* pas. Une nouvelle source de vérité
s'ajoute **au tableau §2** (une ligne) ; une règle nouvelle va dans `docs/RULES.md` ou `docs/SECURITY.md`
et **n'est pas recopiée ici**. Une ligne devenue fausse est corrigée **dans le même commit** que le
changement qui l'a rendue fausse — même règle que pour les chemins cités : **un chemin cité doit exister**.

### Pièges d'environnement (Windows / PowerShell)

- `[...]` est un **joker** : `[guildId]` ne matche rien, silencieusement → `-LiteralPath` (`Select-String`,
  `Get-ChildItem`, `Remove-Item`).
- **Ne jamais écrire un fichier avec `>`** sous PowerShell 5.1 (UTF-16 → fichier corrompu) : utiliser l'éditeur.
- `git grep -n "<nom-de-fichier>"` avant tout renommage ou suppression : **un renommage sans mise à jour des
  citations crée un pointeur mort** (dette immédiate).

