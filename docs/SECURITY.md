# Politique de sécurité — SigilOS

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique.** Utiliser le canal privé GitHub :

➡️ **[Signalement privé](https://github.com/Klyx04/SigilOS/security/advisories/new)**
(*Private vulnerability reporting*, activé sur ce dépôt : l'échange reste privé entre vous et le
mainteneur, et donne lieu à un avis de sécurité publié après correctif).

À fournir : description · étapes de reproduction · impact potentiel · version/commit concerné ·
correctif suggéré le cas échéant. **Ne jamais joindre** de donnée d'exploitation réelle, de secret
ou d'export de base.

**Délais** — accusé de réception sous **48 h** · première évaluation sous **1 semaine** ·
correctif selon la gravité (critique : au plus vite · élevée : 1 semaine · moyenne : 2 semaines).

**Périmètre** : le code de ce dépôt et le service en ligne (`sigilos.fr`, `beta.sigilos.fr`).
**Hors périmètre** : le jeu Dofus et les services tiers (Ankama, DofusDB, Metamob…) — à signaler à
leurs éditeurs.

## Versions prises en charge

| Version | État |
|---|---|
| `main` | production |
| `dev` | bêta |

## Ce que ce dépôt garantit

- **Aucun secret versionné** : la configuration passe par des variables d'environnement (modèle
  `.env.example`) et les jetons d'accès sont chiffrés au repos.
- **Aucune empreinte de machine** : pas de chemin local, d'identifiant personnel, ni d'image
  porteuse de métadonnées — contrôle automatique (`node scripts/check-media-metadata.mjs`) exécuté
  dans la CI **et** avant chaque commit.
- Les actions tierces des workflows sont **épinglées par SHA complet** ; les dépendances sont
  suivies automatiquement (Dependabot) et les alertes traitées dans les délais ci-dessus.
- Le **rapport interne de durcissement** (mesures détaillées, état de l'infrastructure, écarts
  connus) est **volontairement non publié** : publié, il indiquerait à un attaquant où chercher.
  Une demande motivée peut être adressée par le canal privé ci-dessus.

> Ce dépôt est une **vitrine technique** : il n'expose ni donnée d'exploitation, ni secret, ni
> architecture de production.
