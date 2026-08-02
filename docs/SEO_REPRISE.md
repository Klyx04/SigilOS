# 🔁 REPRISE SESSION SEO — SigilOS (02/08/2026)

> **Fichier de contexte dédié hors audits** — à copier-coller en début de prompt pour retrouver
> instantanément l'état de la session SEO/Growth et reprendre là où on s'est arrêté.
> Complète `CONTEXT.md` (global) et ne remplace pas les audits détaillés (`docs/audits/`).

---

## 👉 PROMPT DE REPRISE (à balancer en début de message)

```text
Reprends le contexte de SigilOS, fichier docs/SEO_REPRISE.md + CONTEXT.md + RULES.md.

Session SEO/Growth du 02/08/2026 (matin + soir) — état réel :

BRANCHES
- Locale de travail : feat/security-post-audit
- BETA déployée via deploy.sh beta → branch dev (à jour)
- PROD (non déployée) : main — 681 commits derrière dev → NE PAS fusionner maintenant

DÉJÀ FAIT le 02/08 MATIN, validé (typecheck) et DÉPLOYÉ sur la beta :
- P0.1 sitemap.ts (réécrit, plus de 404/privé, vraies pages + guildes publiques)
- P0.2 robots.ts (bloque /docs, /onboarding, /test-route)
- P0.3 JSON-LD guildes publiques (Organization + BreadcrumbList) dans guilds/[guildId]/page.tsx
- P0.4 noindex guildes privées/non trouvées
- P0.5 fuite docs MEMBER corrigée (doc-actions.ts + seed-docs.ts → accessLevel PUBLIC|MEMBER|ADMIN)
- P0.6 cache accueil (revalidate=3600, sans effet réel car page utilise la session — gardé)
- P0.7 getAppBaseUrl : écarté (déjà OK, fallback https://sigilos.fr)
- H1 accueil indexable (page.tsx ajoute H1 sr-only + hero-section.tsx aria-hidden sur le H1 client)
- Vitrine maintenance.html v1 (page d'attente SEO, commit 47e0347b, mergé + déployé serveur)

DÉJÀ FAIT le 02/08 SOIR (session en cours — à committer via PR vers dev) :
- GUIDE PUBLIÉ : creer-gerer-guilde-dofus-2026 passe draft:true → false
  → désormais indexable, alimente le sitemap automatiquement, visible sur /guides
  → plus de noindex (avant, ce guide écrit était invisible pour Google !)
- robots.ts : ajout de '/guides' à la liste allow en prod (avant absent → guides bloqués)
- public-header.tsx : ajout de "Guides" dans NAV_ITEMS (header desktop + drawer mobile)
- Vitrine v2 enrichie (public/maintenance.html) :
  · 8 piliers couvrant les ~20 modules (au lieu de 4)
  · JSON-LD enrichi : ItemList (8 fonctionnalités) + FAQPage (5 questions) + Organization/WebSite
  · Meta Open Graph + Twitter Card (partage Discord/réseaux)
  · Bandeau + footer vers le guide
  · Stats légères : 8+ familles · 20+ outils · Gratuit en bêta
  · Retrait de "open-source" (le code est FERMÉ)
  · "guide complet" reformulé en "grandes lignes" (le guide n'est pas exhaustif)
  · Icône Discord SVG sur le bouton "Activer SigilOS"
  · Reformulation accès bêta : "Vous faites déjà partie d'une guilde sur SigilOS ?"
    + "Connexion Discord requise. Accès réservé aux membres d'une guilde déjà activée sur SigilOS."
- Typecheck OK (tsc --noEmit)

DÉJÀ FAIT le 03/08 (fix technique sitemap beta) — branche fix/sitemap-base-url (1d88d4a8) :
- Cause GSC "Impossible de récupérer le sitemap" sur beta : sitemap.ts utilisait
  NEXT_PUBLIC_APP_URL || "https://sigilos.fr" → si l'env manquait, URLs vers sigilos.fr
- Fix : sitemap.ts utilise getAppBaseUrl() (cohérent avec robots.ts + metadata)
  → la base est résolue selon l'environnement (beta.sigilos.fr sur dev)
- NB : le .env.beta a déjà NEXT_PUBLIC_APP_URL=https://beta.sigilos.fr (correct).
  Le fix reste utile en robustesse. La vraie cause GSC était probablement la beta
  en maintenance (réponse HTML au lieu de XML) ou une DB indispo au crawl.
- À vérifier au prochain déploiement : curl -sI https://beta.sigilos.fr/sitemap.xml
  (doit renvoyer 200 + text/xml) AVANT de resoumettre dans GSC.

PENDING DÉCISION (le vrai levier Google, en attente) :
- Recommandation IA browsante attendue : guide unique vs hub de ~20 sujets
  (brief soumis à l'IA le 02/08 soir — voir conversation Cline)
- NE PAS créer les 20 guides tant que cette décision n'est pas prise
  (la landing sert de point d'entrée, le guide publié accumule ses premières impressions sur la beta)

NON URGENT (laissé en attente) :
- P0.8 analytics auto-hébergé gratuit (UMami / Plausible CE via docker-compose sur VPS) — 0€, RGPD-friendly
- Pages légales (audit L1-L7) : privacy incomplet vs FAQ (clé Metamob, pseudo, serveurs Discord, jetons),
  contact RGPD flou, CGU à compléter (Songes/raids/ladder/bot Discord), 5 mentions "équipe"
  → reformuler en "le développeur"/"le support" (projet solo, éditeur Wylan)
- À l'ouverture prod sigilos.fr : préparer fusion main (681 commits + tests + migrations),
  deploy.sh prod, resoumission sitemap GSC, retirer le rewrite maintenance.html du Caddyfile

QUESTION : quel est le plan précis pour cette session ? (attente retour IA → analytics → légal, ou autre)
```

---

## 🧭 État global (rappel rapide)

| Domaine | Rôle | SEO |
|---|---|---|
| `beta.sigilos.fr` | La vraie app (annuaire, guildes, contenu) — branch `dev` | ✅ soumis à Google, indexation en cours → **vrai levier** |
| `sigilos.fr` | Page d'attente vitrine (maintenance.html) — Caddy | ✅ page optimisée + indexable, pas de sitemap (pas encore la vraie app) |

- Le **socle SEO est dans `dev`** → restera **actif sur la beta** à chaque reprise.
- `main` (prod) est très en retard ; **ne pas fusionner tant que sigilos.fr n'est pas prêt** à ouvrir.

---

## 🧭 STRATÉGIE DES 2 DOMAINES (à relire si perte de repères)

> **Règle d'or : ne jamais indexer les DEUX domaines avec le même contenu** → risque de
> duplicate content et de dilution du ranking. Un seul domaine porte le SEO à la fois.

| Domaine | Rôle réel | Indexation |
|---|---|---|
| **beta.sigilos.fr** | La **vraie app** (dev) — guide, annuaire, guildes | ✅ **Domaine SEO ACTIF actuellement** (c'est lui qui travaille) |
| **sigilos.fr** | Page vitrine statique (attente prod) | ⚠️ Indexable mais **vide de contenu** → ne rapporte rien en organique |

- Le **guide vit sur `beta.sigilos.fr/guides/creer-gerer-guilde-dofus-2026`**, PAS sur sigilos.fr.
- Il est publié (draft:false), indexable, dans le sitemap de la beta → il SERA indexé une fois
  le sitemap réparé + resoumis (voir fix sitemap ci-dessus + checklist GSC).
- **sigilos.fr ne "sert à rien" en SEO tant que c'est une page statique** — son rôle est
  stratégique : c'est le domaine de marque, prêt à recevoir la vraie app le jour de la prod.

### 🔄 Plan de bascule quand la prod est prête (fusion main)
1. Fusionner `main` (les ~800 commits en retard + tests + migrations)
2. Déployer la vraie app sur `sigilos.fr` → il devient LE domaine principal
3. Le SEO (guide, guildes, sitemap, JSON-LD) migre automatiquement sur sigilos.fr
   (même code, donc quasi automatique — juste resoumettre le sitemap GSC sur sigilos.fr)
4. **Noindexer la beta** (robots.ts / noindex) pour ne PAS cannibaliser sigilos.fr
5. Retirer le rewrite `maintenance.html` du Caddyfile (bloc sigilos.fr)

### ⚠️ À ne PAS faire
- Ouvrir la prod "à la va-vite" (800 commits = risque de casse majeure).
- Garder les 2 domaines indexés en même temps (dilution / duplicate content).
- Supprimer sigilos.fr (c'est le domaine de marque final).

---

## 🗓️ Sources / fichiers clés

| Fichier | Rôle |
|---|---|
| `docs/audits/SEO_GROWTH_2026-08-02.md` | Audit SEO détaillé (local, NON versionné) — backlog, 20 sujets, netlinking, KPIs |
| `CONTEXT.md` | Contexte global projet (à référencer aussi) |
| `RULES.md` | Conventions de dev + sécurité non-négociables |
| `public/maintenance.html` | Vitrine sigilos.fr (page d'attente SEO) — version v2 enrichie |

---

*— Fichier de reprise SEO maintenu à jour (02/08/2026). —*