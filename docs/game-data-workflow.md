# 📦 Workflow — Synchronisation des données de jeu

> Local → Beta → Prod

---

## 🧩 Cas 1 : Modification de données uniquement (pas de nouvelles images)

> *Ex: modifier un niveau, renommer un boss, changer des points d'achievement*

```
1. Modifier les données dans GOD (local)
2. GOD → Import/Export → "Sauvegarder dans Git"
3. git add . && git commit -m "chore(data): ..."
4. git push + PR → merge dans dev
5. Sur le VPS : ./scripts/deploy.sh beta
```

---

## 🖼️ Cas 2 : Nouvelles images + données

> *Ex: ajouter un nouveau donjon avec son image*

```
1. Modifier/ajouter dans GOD (local) + uploader les images
2. GOD → Import/Export → "Sauvegarder dans Git"
3. Envoyer les images sur le VPS :
      ./scripts/sync-assets.sh beta     ← depuis Git Bash, racine du projet
4. git add . && git commit -m "chore(data): ..."
5. git push + PR → merge dans dev
6. Sur le VPS : ./scripts/deploy.sh beta
```

> ⚠️ **Toujours** `sync-assets.sh` **avant** `deploy.sh` — les images doivent arriver avant que la BDD les référence.

---

## 📂 Ce que `sync-assets.sh` envoie

Tout le contenu de `public/game-data/` **récursivement** :

| Dossier | Contenu |
|---|---|
| `dungeons/` | Images des donjons (`.webp`) |
| `monsters/` | Images des familles de monstres (`.webp`) |
| `achievements/` | Icônes des challenges (`.png`) |
| `songes/` *(à venir)* | Automatiquement inclus |
| `quetes/` *(à venir)* | Automatiquement inclus |

---

## 🔑 Commandes de survie

```bash
# Sync images local → beta
./scripts/sync-assets.sh beta

# Sync images local → prod (demande confirmation)
./scripts/sync-assets.sh prod

# Déployer beta
./scripts/deploy.sh beta

# Déployer prod
./scripts/deploy.sh prod
```
