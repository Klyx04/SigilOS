# 🚀 PROMPT_START — Démarrage de chaque session (à coller au début du prompt)

> **Ce fichier = le réflexe à avoir à chaque nouvelle session.** Il oriente l'IA (Cline ou autre) vers les bonnes références selon le type de travail, pour garantir que tout soit fait **à l'état de l'art** (sécurité, qualité, infra, SEO).
>
> **Méthode** : colle le bloc ci-dessous, puis remplace `[TYPE]` et ajoute ta tâche.

---

## 📋 BLOC À COLLER (commun à toutes les sessions)

```
Réfère-toi à @/CONTEXT.md pour le contexte complet.

🔒 Exigences systématiques (état de l'art) :
- Sécurité : respecter RULES.md + SECURITY.md (fail-closed, auth sur chaque action,
  guild isolation multi-tenant, pas de secret en dur, validation Zod, jamais de console.log en prod → logger).
- Qualité : avant tout commit → pas de secret, pas de rapport d'audit, lancer
  `npm run test:run` + `npm run build` (ou au minimum tsc + lint) en local.
- Infra : respecter MAINTENANCE.md (déploiement CD GHCR : ./scripts/deploy-cd.sh,
  fallback : ./scripts/deploy.sh, rollback : ./scripts/rollback.sh).
- Ne JAMAIS committer : docs/audits/, src/audit-*, AUDIT_*.md, .env*.
- Nommer les findings sécurité avec référence (F-xx) + fichier précis.
- Pousser sur une branche puis PR vers dev (pas directement sur main/dev sauf exception).

Tâche demandée ([TYPE]) : [DÉCRIS TA TÂCHE ICI]
```

---

## 🎯 LIGNE SUPPLÉMENTAIRE SELON LE TYPE (ajoute à la fin du bloc)

### 🐛 Bug / Fonctionnalité
```
Type : développeur. Implémente la correction/nouveauté, puis lance la vérif qualité
(tsc + lint + tests) avant de proposer le commit.
```

### 🔒 Sécurité
```
Type : sécurité. Applique la posture SECURITY.md : fail-closed, auth, guild isolation,
validation des entrées. Nomme tout finding F-xx si audit. Voir docs/SECURITY_HARDENING_PLAN.md.
```

### 🖥️ Infra / Déploiement / CI-CD
```
Type : infra. Respecte MAINTENANCE.md : déploiement CD (deploy-cd.sh), ne casse pas
le rollback, ni le nettoyage (maintenance.sh), vérifie healthchecks/expiration GHCR_TOKEN.
```

### 🌐 SEO / Front public
```
Type : SEO. Réfère-toi à docs/SEO_REPRISE.md + vérifier : sitemap, robots.txt,
métadonnées, canonical, headers, performances.
```

### 🗄️ Base de données / Prisma
```
Type : données. Tout changement de schéma → nouvelle migration Prisma (pas de db push en prod),
vérifier l'impact multi-tenant (guildId), jamais de breaking sans rollback possible.
```

---

## 📌 RÉSUMÉ VISUEL (1 ligne par type)

| Ce que tu fais | Commence à coller |
|----------------|-------------------|
| **Tout le temps** | Le bloc commun ci-dessus (CONTEXT.md + exigences) |
| Bug / fonctionnalité | + « Type : développeur… » |
| Sécurité | + « Type : sécurité… » |
| Infra / déploiement | + « Type : infra… » |
| SEO / front | + « Type : SEO… » |
| BDD / Prisma | + « Type : données… » |

---

---

## 🧠 MÉMO DE SESSION (à consulter et tenir à jour à CHAQUE session)

> ⚠️ **Règle permanente** : au démarrage d'une nouvelle session, lire la mémo de session la plus récente, puis **la mettre à jour** en fin de session (ajouter ce qui a été fait, supprimer ce qui est obsolète, corriger toute info devenue fausse).

- **Emplacement** : `src/temp/memo-*.md` (dossier **non commité** — jamais poussé sur git).
- **But** : garder une trace fiable de l'état réel entre les sessions, car `.antigravity` n'est **plus mis à jour** et ne doit plus servir de référence.
- **Convention de nom** : `memo-AAAA-MM-JJ-sujet.md` (ex: `memo-2026-08-03-services-dialogue.md`).

### Données à consigner dans la mémo (ajouter/mettre à jour à chaque session)
- Type (`développeur` / `sécurité` / `infra` / `SEO` / `données`)
- Ce qui a été fait (fichiers modifiés/créés, migration, décisions)
- État git (branche, commit, lien PR en attente, ce qui reste à faire)
- Après merge : migrations à vérifier, rendus à contrôler
- Points d'attention / suite (chantiers ouverts, dette technique connue)

---

*— Bonus : cette fiche vit à la racine (`PROMPT_START.md`) et est volontairement courte. Le vrai contenu détaillé est dans CONTEXT.md, RULES.md, SECURITY.md, MAINTENANCE.md, docs/SEO_REPRISE.md et la mémo de session `src/temp/memo-*.md`.*
