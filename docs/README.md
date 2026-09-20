# 📚 Documentation SigilOS — index

Toute la documentation du projet vit ici. Un seul point d'entrée, une seule arborescence :
plus aucun `.md` de documentation n'est éparpillé ailleurs (le seul `.md` hors `docs/` est
`README.md`, à la racine, et les `README.md` colocalisés d'un sous-projet autonome).

## Par où commencer

| Tu veux… | Ouvre |
|---|---|
| Comprendre le projet (vitrine publique) | [`../README.md`](../README.md) |
| Lancer le projet en local | [`DEVELOPPEMENT.md`](./DEVELOPPEMENT.md) |
| Le contexte technique condensé (archi, modules, pièges) | [`CONTEXT.md`](./CONTEXT.md) |
| Coder aux conventions du projet (sécu, patterns) | [`RULES.md`](./RULES.md) |
| La posture sécurité réelle | [`SECURITY.md`](./SECURITY.md) |
| Exploiter le VPS (cron, déploiement, incidents) | [`MAINTENANCE.md`](./MAINTENANCE.md) |
| Savoir quoi faire ensuite (backlog priorisé) | [`ROADMAP.md`](./ROADMAP.md) |
| Comprendre l'arborescence fichier par fichier | [`arbo/CARTE-DU-PROJET.md`](./arbo/CARTE-DU-PROJET.md) |

## L'arborescence

```
docs/
├── README.md                      ← ce fichier (index)
├── CONTEXT.md                     point d'entrée technique (architecture & état, condensé)
├── DEVELOPPEMENT.md               mise en route locale (prérequis, env, commandes, dépannage)
├── RULES.md                       conventions de code + règles de sécurité non négociables
├── SECURITY.md                    politique de sécurité (découverte par GitHub dans docs/)
├── MAINTENANCE.md                 ops : cron, déploiement, incidents, procédures
├── ROADMAP.md                     backlog priorisé + workflow de session
│
├── agents/                        consignes données aux assistants IA
│   ├── PROMPT_START.md            amorce de session (bloc à coller)
│   ├── session-amorce.md          amorce détaillée : sources, checklists, DoD
│   ├── activeContext.md           journal de session (état réel entre deux sessions)
│   ├── zone-volatile.md           règle de la zone de brouillons `src/temp/` (recréée au besoin)
│   ├── git-push.md                procédure de push / PR
│   ├── prisma-schema-change.md    procédure de changement de schéma
│   ├── add-cron-task.md           ajouter une tâche cron
│   ├── discord-module.md          module Discord (embeds, interactions)
│   ├── dev-local.md               environnement de dev local
│   ├── deploy-vps.md              déploiement VPS
│   ├── disaster-recovery.md       reprise après sinistre
│   ├── dofus-quest-compile.md     compilation des quêtes Dofus
│   ├── siphon-worldmap.md         siphon de la worldmap
│   └── sync-game-assets.md        synchronisation des assets de jeu
│
├── ops/                           procédures d'exploitation (runbooks)
│   └── GUIDE-DEPLOIEMENT-PROD-JOUR-J.md
│
├── plans/                         chantiers produit (en cours / à venir)
│   ├── PLAN-REFONTE-ONBOARDING.md
│   ├── DECISION-OUVERTURE-LANDING.md
│   └── SEO_REPRISE.md
│
├── reference/                     références stables
│   ├── GALERIE-DOFUSBOOK-RELAIS.md
│   ├── I18N_GUIDE.md
│   ├── GLOSSARY-EN.md
│   ├── FACTS_GUILDE_2026.md
│   ├── OCR_STRATEGY_2026.md
│   └── REDIS-OCR-SETUP.md
│
├── arbo/                          état et journal de l'arborescence
│   ├── CARTE-DU-PROJET.md         « c'est quoi ce fichier ? » + méthode de tri
│   ├── AUDIT-ARBO-2026-09.md      audit chiffré + registre des suppressions
│   └── ARCHIVES-TEMP-2026-09.md   où est passé l'ancien `src/temp`
│
└── audits/                        rapports d'audit (NON versionnés, locaux par choix)
```

## Règles de la documentation

1. **Un sujet = un fichier.** Une doc périmée est corrigée ou supprimée, jamais laissée à dériver.
2. **Tout nouveau `.md` va dans `docs/`** (jamais à la racine de `src/`, `scripts/` ou autre).
3. **Jamais de rapport d'audit versionné** : il va dans `docs/audits/` (ignoré par git).
4. **Un chemin cité doit exister.** Avant de renommer/déplacer un fichier, mettre à jour ses citations
   (`git grep -n "nom-du-fichier"`).
5. **Zones volatiles** : `src/temp/` (brouillons de session — **n'existe que si une session le crée**,
   règle : [`agents/zone-volatile.md`](./agents/zone-volatile.md)) et les archives externes `A:\SigilOS--*`
   (mémos, amorces, historiques) — cf. [`arbo/ARCHIVES-TEMP-2026-09.md`](./arbo/ARCHIVES-TEMP-2026-09.md).
