# 🎨 Guide de Conception : Module "Gribouilleur du Monde des Douze"

Ce document sert de spécification technique et fonctionnelle pour la création du mini-jeu de dessin multijoueur (Sigil-Draw) intégré au dashboard de guilde SigilOS.

---

## 📖 1. Le Concept Central
Le jeu est une adaptation compétitive de Skribbl.io thématisée sur l'univers de Dofus. Un joueur dessine un concept lié au MMO (objet, monstre, lieu, PNJ) tandis que les autres membres de la guilde doivent deviner le mot dans le chat le plus rapidement possible.

### 🔄 La Boucle de Jeu (Game Loop)
1.  **Phase d'Attente :** Les joueurs rejoignent le lobby. Le jeu nécessite au moins **2 joueurs** pour démarrer.
2.  **Phase de Sélection :** Le dessinateur choisit un mot parmi 3 options de difficultés différentes.
3.  **Phase de Dessin :** Le dessinateur a T secondes pour illustrer le mot avec une palette de couleurs Dofus.
4.  **Phase de Révélation :** Le mot est dévoilé, les points sont attribués, et on passe au joueur suivant.
5.  **Fin de Partie :** Affichage du podium et gain de prestige de guilde.

---

## ⚖️ 2. Le Système de Score (Logique Mathématique)
Pour récompenser la rapidité sans punir excessivement les connexions lentes, on utilise une décroissance linéaire.

### Pour le Devin
Le score $S_d$ d'un joueur ayant trouvé le mot à l'instant $t$ (en secondes écoulées) sur un temps total $T$ est calculé ainsi :
$$S_d = \text{BasePoints} \times \left(1 - \frac{t}{T}\right) + \text{BonusPosition}$$

- **BasePoints :** 500
- **BonusPosition :** +50 pour le 1er, +25 pour le 2ème, +10 pour le 3ème.

### Pour le Dessinateur
Il gagne des points basés sur le succès collectif :
$$S_{pinceau} = \left(\sum S_d\right) \times 0.75 / N$$
*(Où N est le nombre de joueurs ayant deviné)*.

---

## 🐲 3. Les Variantes "Dofus Custom"

### A. Les Challenges de Pandala (Modificateurs de Round)
À chaque début de round, un "Challenge" peut s'activer aléatoirement (20% de chance) :
- **Challenge "Mains Propres" :** Le dessinateur ne peut pas utiliser la gomme. Toute erreur est définitive.
- **Challenge "Économe" :** Le dessinateur n'a accès qu'à une seule couleur (marron "Terre", bleu "Eau", vert "Air", rouge "Feu").
- **Challenge "Anachronique" :** Les lettres du mot sont révélées dans le désordre pour les devins.

### B. Les Sorts de Guilde (Power-ups) - *À venir*
- **Sort "Oeil de Taupe" :** Révèle immédiatement 25% des lettres du mot.
- **Sort "Poisse" :** Secoue l'écran du dessinateur pendant 3 secondes.
- **Sort "Roulette d'Ecaflip" :** Double les points gagnés pour ce mot, mais inflige un malus si personne ne trouve.

---

## 🗃️ 4. Base de Données des Mots

| Catégorie | Exemples de mots | Difficulté |
| :--- | :--- | :--- |
| **Ressources** | Fer, Blé, Ortie, Trèfle, Eau | Facile |
| **Équipements** | Coiffe Bouftou, Gelano, Voile d'Encre | Moyen |
| **Bestiaire** | Meulou, Poutch Ingball, Dark Vlad | Moyen |
| **Abstrait/Lieux** | Alignement, Havre-Sac, Zaap, Kolizéum | Difficile |

---

## 🛠️ 5. Spécifications Techniques

### Événements Sockets (WebSocket)
- `skribbl:room:create` / `skribbl:room:join`
- `skribbl:draw:stroke` : Diffusion des tracés (x, y, couleur, taille).
- `skribbl:chat:guess` : Vérification du mot côté serveur.
- `skribbl:game:start` : Lancé par l'hôte uniquement (Min 2 joueurs).

### Sécurité & Anti-Triche
- **Filtrage Chat :** Masquer les propositions exactes pour les autres joueurs.
- **Anti-Flood :** Limiter à 1 proposition par seconde.
- **Distance de Levenshtein :** Afficher "Tu es proche !" pour les erreurs d'une seule lettre.

---

## 🎨 6. Interface Utilisateur (UI)
L'UI doit respecter la charte graphique **SigilOS** :
- **Zone Gauche :** Leaderboard avec avatars des classes Dofus.
- **Zone Centrale :** Canvas "magique" entouré de dorures.
- **Zone Droite :** Chat dynamique avec feedback visuel (bulles vertes pour les bonnes réponses).
- **Barre Supérieure :** Timer représenté par une barre d'énergie et indices (tirets).
