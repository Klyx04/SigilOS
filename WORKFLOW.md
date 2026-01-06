# Workflow de Développement SigilOS

Ce document décrit le processus Git à suivre pour garantir la qualité et la stabilité du code.

## 🌳 Structure des Branches

- **`main`** : 🔴 **Production**. Code stable, déployable. Ne jamais modifier directement.
- **`dev`** : 🟡 **Intégration**. Branche de travail principale. Tout le monde part de là et fusionne ici.
- **`feat/nom-feature`** : 🟢 **Feature**. Branche temporaire pour développer une fonctionnalité spécifique.

## 🔄 Cycle de Travail (Routine)

### 1. Commencer une tâche
Toujours partir de la branche `dev` à jour.

```bash
# 1. Aller sur dev
git checkout dev

# 2. Mettre à jour (si d'autres ont travaillé)
git pull origin dev

# 3. Créer sa branche de travail
# Format : feat/nom-explicite (ex: feat/auth-login, fix/header-css)
git checkout -b feat/ma-super-feature
```

### 2. Pendant le développement
Sauvegardez souvent vos modifications localement.

```bash
git add .
git commit -m "feat: ajout du composant bouton"
```

### 3. Terminer la tâche
Une fois la fonctionnalité terminée et testée :

```bash
# 1. Retourner sur dev
git checkout dev

# 2. Récupérer les dernières mises à jour
git pull origin dev

# 3. Fusionner votre travail
git merge feat/ma-super-feature

# 4. Supprimer la branche temporaire
git branch -d feat/ma-super-feature
```

### 4. Partager le code (Push)
Envoyer les modifications sur GitHub.

```bash
git push origin dev
```

## 📝 Bonnes Pratiques

- **Commits atomiques** : Un commit = Une action logique (pas tout le projet d'un coup).
- **Messages clairs** : Utilisez des préfixes :
  - `feat:` Nouvelle fonctionnalité
  - `fix:` Correction de bug
  - `docs:` Documentation
  - `style:` Design / CSS
  - `refactor:` Nettoyage de code sans changement fonctionnel
- **Pas de force push** : Ne jamais utiliser `git push --force` sur `dev` ou `main`.
