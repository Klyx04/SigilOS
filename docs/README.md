# 📚 Documentation SigilOS — index

Toute la documentation du projet vit ici. Un seul point d'entrée, une seule arborescence :
plus aucun `.md` de documentation n'est éparpillé ailleurs (hors `docs/`, il n'y a que `AGENTS.md`
— l'amorce lue automatiquement par les assistants IA —, `README.md` à la racine, et les `README.md`
colocalisés d'un sous-projet autonome).

## Par où commencer

| Tu veux… | Ouvre |
|---|---|
| **Travailler avec un assistant IA** (amorce obligatoire) | [`../AGENTS.md`](../AGENTS.md) |
| Comprendre le projet (vitrine publique) | [`../README.md`](../README.md) |
| Lancer le projet en local | [`DEVELOPPEMENT.md`](./DEVELOPPEMENT.md) |
| Le contexte technique condensé (archi, modules, pièges) | [`CONTEXT.md`](./CONTEXT.md) |
| Coder aux conventions du projet (sécu, patterns) | [`RULES.md`](./RULES.md) |
| La posture sécurité réelle | [`SECURITY.md`](./SECURITY.md) |
| Exploiter le VPS (cron, déploiement, incidents) | [`MAINTENANCE.md`](./MAINTENANCE.md) |
| Savoir quoi faire et dans quel ordre | [`ROADMAP.md`](./ROADMAP.md) — feuille de route unique |
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
├── ROADMAP.md                     feuille de route unique : backlog + ordre
│
├── agents/                        consignes données aux assistants IA
│   │                              (amorce lue automatiquement : `AGENTS.md`, à la RACINE)
│   ├── harnais.md                 harnais agentique : règles, skills, hooks, mesure
│   ├── journal-sessions-2026.md   archive des 171 blocs de session (à la demande)
│   ├── archive/                   anciennes sources d'ordre (FILE-EXECUTION, BRIEF, amorce)
│   ├── activeContext.md           journal de session (état réel entre deux sessions)
│   ├── zone-volatile.md           règle de la zone de brouillons `src/temp/` (recréée au besoin)
│   ├── git-push.md                procédure de push / PR
│   ├── prisma-schema-change.md    procédure de changement de schéma
│   ├── add-cron-task.md           ajouter une tâche cron
│   ├── discord-module.md          module Discord (embeds, interactions)
│   ├── dev-local.md               environnement de dev local
│   ├── deploy-vps.md              déploiement VPS
│   ├── acces-lecture-seule.md     accès SSH + Postgres **lecture seule** de l'assistant (mesures bêta)
│   ├── disaster-recovery.md       reprise après sinistre
│   ├── dofus-quest-compile.md     compilation des quêtes Dofus
│   ├── siphon-worldmap.md         siphon de la worldmap
│   └── sync-game-assets.md        synchronisation des assets de jeu
│
├── ops/                           procédures d'exploitation (runbooks)
│   └── GUIDE-DEPLOIEMENT-PROD-JOUR-J.md
│
├── plans/                         chantiers produit (en cours / à venir)
│   ├── (l'ordre vit dans ../ROADMAP.md — anciens fichiers : ../agents/archive/)
│   ├── PLAN-ROLES-ANCIENNETE.md   chantier Y : rôles automatiques par ancienneté (paliers `jours → rôles`, annonce)
│   ├── PLAN-ROLES-SUCCES.md        chantier S : rôles par points de succès ladder (paliers `points → rôles`)
│   ├── PLAN-MOTEUR-ROLES-MULTI-SOURCES.md  chantier Y+ : moteur unique ancienneté + vocal + contribution (garde-fous, 1 migration)
│   ├── PLAN-COMMANDES-SLASH.md     chantier Z : commandes slash personnalisées (catalogue ∪ guilde, payloads dérivés)
│   ├── PLAN-ACTIVITE-GUILDE.md     chantier N : activité de guilde enrichie & notifications (aucune migration)
│   ├── PLAN-DEMO-PUBLIQUE.md       chantier S : démo publique en lecture seule
│   ├── AMORCE-STUFF-VARIANTES-RESTE.md  suite du chantier stuff/variantes (panoplies recalculées, Pods, veille)
│   ├── AMORCE-DEMO-PUBLIQUE.md     amorce du chantier S (S-1 → S-5)
│   ├── PLAN-DESLOP-ANNUAIRE.md     deslop de l'annuaire (volet membres de M-1)
│   ├── PLAN-RACCORD-DOFUSDB.md     raccord DofusDB (données de combat + visuels)
│   ├── PLAN-REFONTE-RUSH-SYLVESTRE.md  refonte du rush Sylvestre (T-1 → T-6)
│   ├── ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md  rush : architecture d'alignement
│   ├── MAPPING-RUSH-SYLVESTRE.md  rush : mapping des données
│   ├── RUSH-DEVELOPPEMENT-SUITE.md  rush : organisation de la suite (4 surfaces, blocs S0→S5)
│   ├── PLAN-SUCCES-SPECIAUX.md     succès spéciaux (données + fiches)
│   ├── PLAN-SOLVEURS-TACTIQUES.md solveurs tactiques (à cadrer)

│   ├── PLAN-REFONTE-ONBOARDING.md
│   ├── PLAN-REFONTE-TICKETS-V2.md  module Tickets : état mesuré + ce qui reste pour le boucler
│   ├── PLAN-REFONTE-GOD-GUILDES.md refonte God « Guildes & Users » : 12 chantiers, 7 lots
│   ├── AMORCE-REFONTE-GOD-GUILDES.md  amorce d'exécution de la refonte God
│   ├── PLAN-RAID.md                raid : clôture/no-show, strat, overlay, données (relevé mesuré 01/10/2026)
│   ├── MODULE-RUSH-SYLVESTRE.md    module Rush Sylvestre : carte des fichiers + chantiers (agrégateur)
│   ├── AMORCE-RAID.md              amorce d'exécution des chantiers raid (lots L1→L7 + bloc à coller)
│   ├── PLAN-SALONS-VOCAUX.md       module « salons vocaux » : cahier produit/technique V2.1 (à cadrer)
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
2. **Tout nouveau `.md` va dans `docs/`** (jamais à la racine de `src/`, `scripts/` ou autre). Seule
   exception : `AGENTS.md`, à la racine — le standard impose cet emplacement pour être lu
   automatiquement par les assistants IA.
3. **Jamais de rapport d'audit versionné** : il va dans `docs/audits/` (ignoré par git).
4. **Un chemin cité doit exister.** Avant de renommer/déplacer un fichier, mettre à jour ses citations
   (`git grep -n "nom-du-fichier"`).
5. **Une seule zone volatile** : `src/temp/` (brouillons de session, **jamais versionnée** ; règle :
   [`agents/zone-volatile.md`](./agents/zone-volatile.md)). Le corpus d'audit du 20/09 a été **déplacé**
   dans `src/temp/archive/audit-2026-09/` le 19/10/2026 (aucune suppression).
