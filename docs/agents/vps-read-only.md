---
description: Accès agent au VPS — clé SSH en commande forcée, lecture seule (bêta)
---

# 🔒 Accès agent au VPS — lecture seule

> **But.** Donner à un agent (Cline) la capacité de **vérifier** la bêta (conteneurs,
> logs, migrations, compteurs, crons, CSP) sans pouvoir déployer, redémarrer, écrire en
> base ou ouvrir un shell. La restriction est **imposée par SSH**, pas par la discipline
> de l'agent.

## 1. Le modèle

| Élément | Valeur |
|---|---|
| Clé privée | `~/.ssh/sigilos-agent-ro2` (poste du mainteneur, **jamais** dans le dépôt) |
| Clé publique | commentaire `cline-ro-v2 (lecture seule)` |
| Compte VPS | `sigiladmin` (la clé **ne peut pas** obtenir de shell) |
| Commande forcée | `/home/sigiladmin/.sigilos-agent/agent-ro.sh` |
| Rôle SQL | `sigil_ro` — `SELECT` seulement |
| Périmètre | **bêta** (`sigilos-*-beta`) ; la prod est hors de ce dispositif |

La ligne `authorized_keys` :

```text
restrict,command="/home/sigiladmin/.sigilos-agent/agent-ro.sh" ssh-ed25519 AAAA… cline-ro-v2 (lecture seule)
```

`restrict` coupe le terminal, les tunnels, l'agent SSH et le X11. `command=` remplace
**toute** commande demandée par le script.

## 2. Ce que la clé peut faire

| Verbe | Effet |
|---|---|
| `status` | `git log -1` du dépôt + conteneurs bêta |
| `ps` | conteneurs bêta (état, image) |
| `logs <app\|worker\|ws\|bot\|db\|redis\|caddy>` | 200 dernières lignes (30 min) |
| `migrations` | 10 dernières lignes de `_prisma_migrations` |
| `counts` | compteurs du guide `rush-sylvestre` |
| `crons` | lignes de crontab surveillées (sondages, ancienneté, rappels, `live-watch`) |
| `csp` | valeur de `CSP_ENFORCE` |

Tout le reste (`bash`, `whoami`, `deploy`, `sudo`, `docker run`, un argument libre…)
répond `Commande non autorisée` (code 2) et est journalisé (`logger -t sigilos-agent-ro`).

## 3. Le rôle `sigil_ro` (une fois, sur la bêta)

À exécuter **sur la bêta**, avec un mot de passe généré localement et stocké dans
`/home/sigiladmin/.sigilos-ro.pgpass` (`chmod 600`) — jamais dans le dépôt :

```sql
CREATE ROLE sigil_ro LOGIN PASSWORD '<mot-de-passe>';
GRANT CONNECT ON DATABASE sigilos TO sigil_ro;
GRANT USAGE ON SCHEMA public TO sigil_ro;
-- Uniquement les tables lues par le script : jamais Account/User (jetons OAuth).
GRANT SELECT ON "_prisma_migrations", "GuideSequence", "GuideMilestone", "OptimizedGuide" TO sigil_ro;
```

> **Durcissement d'un rôle déjà créé avec `ALL TABLES`** (bêta, 02/11/2026) :
>
> ```sql
> REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM sigil_ro;
> ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM sigil_ro;
> GRANT SELECT ON "_prisma_migrations", "GuideSequence", "GuideMilestone", "OptimizedGuide" TO sigil_ro;
> ```

> Le rôle ne peut **pas** écrire : même un bug du script ne peut pas modifier la base.

## 4. Installation (mainteneur)

1. Copier `scripts/agent-ro.sh` vers `/home/sigiladmin/.sigilos-agent/agent-ro.sh`
   (hors dépôt : un `git pull` ne peut pas le réécrire) et `chmod 700`.
2. Générer le mot de passe et le fichier `.sigilos-ro.pgpass` (600).
3. Créer le rôle `sigil_ro` (SQL ci-dessus).
4. **Tester le script avec l'ancienne clé** : `SSH_ORIGINAL_COMMAND=status bash ~/.sigilos-agent/agent-ro.sh`.
5. Ajouter la nouvelle clé avec `restrict,command="…"` dans `authorized_keys`
   (**sauvegarde** de `authorized_keys` avant).
6. Tester la nouvelle clé (`status`, `whoami` refusé), puis **retirer** l'ancienne
   ligne non restreinte.

## 5. Vérification (agent)

```bash
ssh -i ~/.ssh/sigilos-agent-ro2 myvps status
ssh -i ~/.ssh/sigilos-agent-ro2 myvps migrations
ssh -i ~/.ssh/sigilos-agent-ro2 myvps counts
ssh -i ~/.ssh/sigilos-agent-ro2 myvps whoami   # doit être refusé
```

## 6. Règles de changement

- **Aucune nouvelle capacité** (`deploy`, redémarrage, SQL d'écriture) sans revue, mise à
  jour de ce document et test de la matrice ci-dessus.
- Le script ne doit **jamais** transmettre `SSH_ORIGINAL_COMMAND` à `eval`/`sh -c`, ni
  accepter un nom de conteneur, de service ou de table libre.
- Un déploiement (même bêta) reste une **action humaine** ou un lot séparé, avec smoke
  test et rollback : ce dispositif ne le couvre pas.
- La clé privée ne quitte pas le poste du mainteneur ; aucune copie dans le dépôt, un
  gestionnaire de secrets ou une capture.
