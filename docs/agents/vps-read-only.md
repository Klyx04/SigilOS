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
| `items [id Ankama \| nom]` | 10 items (20 sans argument) — `GameItem` |
| `monsters [nom]` | 10 monstres (20 sans argument) — `Monster` + famille |
| `quests [dofusDbId \| nom]` | 10 quêtes (20 sans argument) — `GameQuest` |
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
-- Lecture seule, même si un GRANT d'écriture arrivait par erreur.
ALTER ROLE sigil_ro SET default_transaction_read_only = on;
```

> **Périmètre de lecture** — **données de jeu + guides**, jamais l'authentification
> (`Account`, `Session`, `User`, `VerificationToken`, `UserProfile`, `AuditLog`,
> `GuildConfig`). Le bloc ci-dessous ne grant que les tables **existantes** :
>
> ```sql
> REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM sigil_ro;
> ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM sigil_ro;
> DO $$
> DECLARE t text;
> BEGIN
>   FOREACH t IN ARRAY ARRAY[
>     '_prisma_migrations',
>     'GameItem', 'GameItemSet', 'GameQuest', 'GameEffect', 'GameCharacteristic',
>     'GameDataMonster', 'GameDataChangeLog', 'Monster', 'MonsterFamily', 'MonsterStat',
>     'Dungeon', 'DungeonAchievement', 'DofensiveDungeon', 'DofensiveMap',
>     'DofusItem', 'DofusQuestChain', 'DofusQuestEntry', 'DofusQuestPrerequisite', 'DofusRequirement',
>     'ClassSpellbook', 'LegendaryItem', 'OcreMonsterTemplate', 'Archimonstre', 'Challenge',
>     'DreamBonus', 'DreamFloor', 'Titan', 'Zone', 'ResourceCategory', 'ResourceLink',
>     'OptimizedGuide', 'OptimizedGuideStep', 'GuideMilestone', 'GuideSequence', 'SubGuideData'
>   ] LOOP
>     IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
>       EXECUTE format('GRANT SELECT ON %I TO sigil_ro', t);
>     END IF;
>   END LOOP;
> END
> $$;
> ```
>
> **Pourquoi pas `ALL TABLES`** : `Account` contient les jetons OAuth, `User` les
> e-mails, `Session` les sessions, `UserProfile` les identifiants Discord. Les
> items/monstres/quêtes sont des **données de jeu** : aucun secret. La liste s'élargit
> quand un besoin réel apparaît, pas « au cas où ».
>
> Le rôle ne peut **pas** écrire : `SELECT` + `default_transaction_read_only`.

## 4. Installation (mainteneur)

1. Copier `scripts/agent-ro.sh` vers `/home/sigiladmin/.sigilos-agent/agent-ro.sh`
   (hors dépôt : un `git pull` ne peut pas le réécrire) et `chmod 700`.
   **Après chaque mise à jour du script** : `cp ~/SigilOS/scripts/agent-ro.sh ~/.sigilos-agent/agent-ro.sh && chmod 700 ~/.sigilos-agent/agent-ro.sh` (le dépôt du VPS doit être à jour).
2. Générer le mot de passe et le fichier `.sigilos-ro.pgpass` (600).
3. Créer le rôle `sigil_ro` + appliquer le **périmètre** (SQL ci-dessus).
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
ssh -i ~/.ssh/sigilos-agent-ro2 myvps items 123
ssh -i ~/.ssh/sigilos-agent-ro2 myvps monsters Bouftou
ssh -i ~/.ssh/sigilos-agent-ro2 myvps quests 438
ssh -i ~/.ssh/sigilos-agent-ro2 myvps whoami   # doit être refusé
```

## 6. Règles de changement

- **Aucune nouvelle capacité** (`deploy`, redémarrage, SQL d'écriture) sans revue, mise à
  jour de ce document et test de la matrice ci-dessus.
- La **liste de lecture** est fermée : ajouter une table = revue + ce document. Ne
  **jamais** grant `Account`, `Session`, `User`, `UserProfile`, `AuditLog`, `GuildConfig`.
- Le script ne doit **jamais** transmettre `SSH_ORIGINAL_COMMAND` à `eval`/`sh -c`, ni
  accepter un nom de conteneur, de service ou de table libre.
- Un déploiement (même bêta) reste une **action humaine** ou un lot séparé, avec smoke
  test et rollback : ce dispositif ne le couvre pas.
- La clé privée ne quitte pas le poste du mainteneur ; aucune copie dans le dépôt, un
  gestionnaire de secrets ou une capture.
