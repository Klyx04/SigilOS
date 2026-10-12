# SigilOS — Module « Salons vocaux temporaires »

> Cahier produit et technique, **version 2.1** (refonte complète du 30 septembre 2026, remplace la version du 24 septembre).
> Statut : **proposition de conception**, pas une fonctionnalité existante. Le dépôt SigilOS n'a pas été fourni : les noms de tables, routes et commandes sont des contrats cibles à adapter au code réel.
> Sources : documentations lues le 30 septembre 2026 (voir §13). Ce qui n'a pas pu être vérifié est signalé.

---

## 0. Ce qui change par rapport à la V1 du cahier

- Relecture des docs **DraftBot**, **TempVoice**, **VoiceMaster** et **Discord** (permissions, rate limits, gateway).
- **Ton « friendly »** : textes, emojis et messages d'erreur écrits comme on parlerait à un membre de guilde.
- **Rôles à 4 niveaux** inspirés de DraftBot (accès, modérateurs, intouchables, accès au panneau).
- **Matrice de droits des commandes slash** (propriétaire / présents / modérateurs / admins), §5.3.
- **Profils sauvegardés** et **import inter-serveurs** en feuille de route ; **salle d'attente** dès la V1.1 ; **mode sans panneau** (commandes seules).
- Prise en compte d'un changement Discord à venir : **obfuscation des salons** non visibles par le bot à partir du 16 novembre 2026 (§8.5).
- Modèles Dofus repensés : donjon, Songes, recrutement, craft/FM, détente.

---

## 1. Vision et promesse

**Produit générique** : les presets Dofus sont des exemples, jamais du code en dur. Le module doit pouvoir fonctionner sur n'importe quel serveur Discord.

> « Je rejoins ➕ **Créer un salon** ; j'arrive dans mon vocal ; je règle qui peut venir en 2 clics ; quand tout le monde part, il disparaît. »

Trois principes :

1. **Zéro friction à l'installation** : un assistant, aucune saisie d'ID, un test guidé.
2. **Sécurité par défaut** : le membre gère *son* salon sans jamais recevoir `MANAGE_ROLES` ni `MANAGE_CHANNELS`. DraftBot documente que ses réglages passent par le bot et déconseille de donner « Changer les permissions » aux créateurs.
3. **Ton humain** : on explique, on rassure, on ne sanctionne pas.

**Hors périmètre** : enregistrer/transcrire l'audio, écouter, créer un Stage, promettre une confidentialité face aux administrateurs (`ADMINISTRATOR` ignore les dérogations de salon).

### Objectifs mesurables (proposés)

- Installation complète avec test en moins de 3 minutes.
- Zéro suppression d'un salon occupé ; zéro suppression d'un salon non enregistré comme temporaire par SigilOS.
- Robustesse aux événements doublés, aux redémarrages et à plusieurs instances.
- Moins de 1 % de créations en erreur en conditions normales (à calibrer en test de charge).

---

## 2. Ce que font les meilleurs (synthèse de lecture)

| | DraftBot | TempVoice | VoiceMaster |
|---|---|---|---|
| **Déclencheur** | « Hub » ; 1 par défaut, plus en premium | Plusieurs « Creator Channels », chacun avec sa config | « Join to Create » avec 4 types de setup |
| **Installation** | `/config` ou panel web | `/setup` en quelques clics | Dashboard web recommandé, sinon `/setup …` |
| **Interface membre** | Embed dans le chat texte du vocal (désactivable) | « Interface Message » à boutons, salon dédié ou chat du vocal | Interface à boutons + `/voice …` |
| **Accès** | Ouvert / Fermé / Privé + liste blanche / noire | Privacy, trust/untrust, block/unblock, invite, kick | lock, permit, reject, ghost, invite |
| **Extras** | Purge avec confirmation, sauvegardes, import inter-serveurs, réquisition | Salle d'attente, fil, région, claim, transfer, delete | LFM, salon texte auto, bitrate, NSFW, `/request` |
| **Nommage** | `{user}`, `{index}`, mots aléatoires | non vérifié en détail | `{username}`, `{seq}`, listes de mots |
| **Monétisation** | Certaines options premium | Certaines options via vote ou premium | Sequential / Predefined / Clone en premium |

**Constats**

- Le parcours « rejoindre → déplacé → panneau → suppression quand vide » est identique partout : c'est le socle.
- DraftBot est le plus fin sur la **gouvernance** ; TempVoice le plus simple à installer et le plus souple sur la **multiplicité** de créateurs ; VoiceMaster le plus riche en **nommage**.
- **SigilOS n'impose aucun paywall dans ce cahier.**
- Réserves : la page VoiceMaster `set channel` n'a pas pu être lue en détail ; la page « greeting » et `llms.txt` de TempVoice n'ont pas chargé.

**Positionnement SigilOS** : la gouvernance de DraftBot, l'installation de TempVoice, la variété de VoiceMaster, plus un parcours en français, des confirmations Oui / Non et un diagnostic lisible.

---

## 3. Parcours administrateur

### 3.1 Assistant « Activer les vocaux » (dashboard)

1. **Serveur** : sélection, puis vérification côté backend du droit d'administration SigilOS et des permissions Discord requises.
2. **Mode** : « ⚡ Création rapide » ou « 🛠️ Personnaliser ». La création rapide propose une catégorie `🎙️ Salons temporaires` et un vocal `➕ Créer un salon`, avec la question : *« Je crée ces 2 éléments sur ton Discord ? Oui / Non »*. Rien n'est créé avant le « Oui ».
3. **Générateur** : déclencheur (créé ou existant), catégorie, modèle de nom, limite, accès initial. Aperçu vivant : *« Si Alice rejoint ➕ Créer un salon, je crée `🎙️ Salon d'Alice` ici. »*
4. **Interface** : panneau dans le chat du vocal (défaut), salon texte dédié, ou **commandes seulement**.
5. **Rôles** (§6.2) : qui peut créer, qui modère, qui est intouchable.
6. **Permissions** : contrôle du bot au niveau catégorie + salon.
7. **Récapitulatif** : liste exacte de ce qui sera créé ou modifié, puis Oui / Non. Application séquentielle et journalisée. En cas d'échec partiel : proposer « Réparer » ou « Annuler ce que SigilOS a créé » (jamais de suppression d'éléments préexistants).
8. **Test guidé** : *« Rejoins ➕ Créer un salon pour voir la magie opérer »* ; le diagnostic dit précisément quoi corriger.

### 3.2 Écran de gestion

- **Mes générateurs** : état, déclencheur, destination, salons actifs, erreurs récentes, bouton Tester.
- **Fiche générateur** : Général · Accès · Rôles · Commandes · Réglages membres · Vie du salon · Panneau · Diagnostic · Journal.
- Un changement s'applique aux **prochaines créations**. « Appliquer aux salons actifs » est une action séparée avec aperçu et Oui / Non.
- **Pause** : plus de création ; le déclencheur redevient un vocal normal et les salons en cours continuent.
- **Suppression d'un générateur** : par défaut « arrêter les créations, laisser les salons actifs se vider ».
- Un vocal déclencheur appartient à **un seul** générateur actif par serveur.
- **Salons permanents** : liste de vocaux que le module ne supprimera jamais.

---

## 4. Configuration d'un générateur

| Champ | Défaut conseillé | Comportement |
|---|---|---|
| État | Actif | En pause : le déclencheur redevient un vocal normal ; avertissement si des membres s'y accumulent. |
| Déclencheur | `➕ Créer un salon` | Référencé par ID, jamais par le nom. |
| Destination | Catégorie choisie | Vérifier visibilité et permissions effectives. |
| Nom | `🎙️ Salon de {display_name}` | Variables : `{display_name}`, `{username}`, `{index}`, `{word}`. Neutraliser mentions et caractères problématiques. |
| Capacité | 0 = sans limite | Valider la borne via l'API (DraftBot documente 0–99 pour son interface ; ce n'est pas une constante Discord). |
| Accès initial | Ouvert | Fermé ou Privé possibles. |
| Source des droits | Catégorie | Alternative : copier le déclencheur. **Liste blanche** de bits copiables. |
| Un salon par membre | Oui | Si un salon actif existe, déplacer le membre dedans au lieu d'en créer un second. |
| Délai après vide | 10 s | Anti-reconnexion ; occupation revérifiée juste avant suppression. |
| Boutons / commandes | Tous actifs | Chacun activable/désactivable par l'admin. |
| Réquisition | Désactivée | Si activée, un présent peut reprendre le salon quand le propriétaire est parti. |
| Profils | Désactivés en V1 | Voir §7. |

### 4.1 Modèles (presets configurables)

| Modèle | Exemple de nom | Réglages | Usage hors Dofus |
|---|---|---|---|
| 💬 Discussion | `🎙️ Salon de {display_name}` | Ouvert, sans limite | Détente |
| ⚔️ Groupe | `⚔️ Groupe de {display_name}` | Limite 4 à 8 | Équipe de jeu |
| 🗝️ Donjon | `🗝️ Donjon {index}` | Limite préréglée, verrouillable | Sessions numérotées |
| 🌙 Songes | `🌙 Songes {index}` | Limite préréglée, fermé par défaut | Runs planifiés |
| 🤝 Recrutement | `🤝 Entretien de {display_name}` | Privé, modérateurs autorisés | Onboarding, entretien |
| 🛠️ Craft / FM | `🛠️ Atelier {index}` | Ouvert, limite basse | Ateliers, entraide |
| 🎉 Événement | `🎉 Événement {index}` | Rôle participant par défaut | Rencontres |

Ces presets ne sont **pas** des règles du jeu : aucune donnée Dofus n'est lue.

---

## 5. Expérience membre

### 5.1 Création

1. Le membre rejoint le déclencheur ; le bot reçoit `Voice State Update`.
2. Contrôles : serveur autorisé, membre réel, rôle admissible, quota, pas de création déjà en cours, permissions du bot.
3. Salon actif existant : déplacement dedans. Sinon : intention enregistrée → salon créé → ID persisté → déplacement (`MOVE_MEMBERS`).
4. Membre parti entre-temps : pas de déplacement forcé ; le salon vide passe par le nettoyage.
5. Déplacement en échec : message clair, salon conservé brièvement puis supprimé s'il reste vide.
6. Panneau posté dans le chat du vocal (facultatif). S'il échoue, le salon reste utilisable et `/vocal` prend le relais.

### 5.2 Panneau (proposition)

```text
🎙️ TON SALON — ⚔️ Groupe de Lyra
Propriétaire : @Lyra · Accès : 🟢 Ouvert · Places : 2/4

[✏️ Renommer] [👥 Places] [🔒 Accès]
[✅ Inviter]  [⛔ Bloquer] [🚪 Exclure]
[👑 Transférer] [💾 Profils] [⚙️ Plus]

Ce salon disparaît quand il est vide. Les modérateurs ne peuvent pas être bloqués.
```

- Les boutons ouvrent un sélecteur ou un formulaire, répondent en **éphémère** et mettent à jour le panneau.
- On affiche l'**état effectif** : *« 🔒 Privé — les membres non invités ne voient plus ce salon. Les administrateurs du serveur y ont toujours accès. »*
- Après un changement de micro/vidéo, préciser qui n'est pas concerné (rôle, admin, dérogation) et rappeler que les personnes déjà connectées peuvent devoir se reconnecter.
- L'utilisateur et l'état du salon sont contrôlés **à chaque clic**.
- DraftBot indique un nombre de modifications restantes à cause de la limite Discord sur les modifications de salon. SigilOS ne code pas de chiffre en dur : il lit les en-têtes de rate limit (§8.5) et affiche le vrai délai.

### 5.3 Commandes slash et droits d'usage

Principe : les commandes de **gestion** sont réservées au propriétaire du salon (ou aux modérateurs désignés). Seules l'aide, l'info et la réquisition sont ouvertes aux membres présents. Ce découpage suit les concurrents : chez VoiceMaster, les commandes vocales ne s'appliquent qu'aux salons temporaires créés par le bot ; chez TempVoice, `/voice` sert au propriétaire à changer les propriétés et gérer les membres ; la réquisition (`claim`) n'est possible que si le propriétaire est parti.

| Commande | Qui | Condition |
|---|---|---|
| `/vocal aide` | Tout membre | Réponse éphémère |
| `/vocal info` | Membre présent dans un salon temporaire | Propriétaire, accès, places. Réservé aux présents pour ne pas exposer la composition d'un salon privé (réglable par l'admin) |
| `/vocal recuperer` | Membre présent dans le salon | Réquisition activée **et** propriétaire absent ; contrôle atomique à la validation |
| `/vocal nom`, `/vocal places`, `/vocal acces ouvert\|ferme\|prive` | Propriétaire | Sur son salon uniquement |
| `/vocal inviter`, `/vocal bloquer`, `/vocal debloquer` | Propriétaire | Cible non protégée (modérateur, intouchable, admin) |
| `/vocal exclure` | Propriétaire | Cible encore présente dans le salon et non protégée |
| `/vocal transferer` | Propriétaire | Cible présente dans le salon ; confirmation Oui / Non |
| `/vocal fermer` | Propriétaire | Préférer « quitte le salon, il se supprime seul » ; suppression manuelle seulement si vide ou après confirmation |
| `/vocal profil sauver\|charger` (V2) | Propriétaire | Ses propres profils uniquement |
| Mêmes commandes de gestion, sur tout salon temporaire | Modérateurs désignés | Toujours limités par les rôles intouchables |
| `/vocal-admin diagnostic`, `/vocal-admin …` | Administrateurs SigilOS | Autorisation contrôlée côté backend |

**Règles communes aux commandes de gestion**

- L'auteur doit être **dans son salon** au moment de la commande. Sinon : *« Tu dois être dans ton salon vocal pour faire ça. »*
- Un membre sans salon actif ne peut rien modifier.
- À **chaque exécution**, le bot revérifie que l'auteur est le propriétaire courant et que le salon est suivi par SigilOS. Une ancienne commande ou un ancien panneau ne donne aucun droit après un transfert.
- Aucune commande ne s'exécute sur un salon non suivi par SigilOS.
- Les commandes sont visibles dans la liste Discord, mais le refus est explicite et éphémère ; l'admin peut restreindre leur visibilité via les réglages d'intégrations du serveur Discord.
- Chaque commande de gestion est activable ou désactivable par l'admin, comme les boutons.

Le panneau reste l'interface principale ; les commandes assurent l'accessibilité et la sortie de secours, et servent seules en mode « sans panneau ».

### 5.4 Ton et messages (charte « friendly »)

| Situation | Message |
|---|---|
| Création réussie | « Ton salon est prêt ! Fais-en ce que tu veux 🎉 » |
| Déplacement impossible | « Ton salon est créé, mais je n'ai pas le droit de t'y déplacer. Rejoins-le depuis la liste, ou préviens un admin. » |
| Salon déjà existant | « Tu as déjà un salon ici, je t'y emmène. » |
| Renommage trop rapide | « Discord demande de patienter avant un nouveau changement de nom. Réessaie dans {délai}. » |
| Cible protégée | « Cette personne est protégée par les règles du serveur. » |
| Suppression refusée | « Il reste du monde dans le salon, il restera ouvert. » |
| Panne | « Petit souci de mon côté. Ton vocal actuel n'a pas été touché. » |

---

## 6. Permissions, rôles et confidentialité

### 6.1 Modes d'accès

| Mode | Membre ordinaire | Invité explicite | Modérateur / administrateur |
|---|---|---|---|
| 🟢 Ouvert | Voit et rejoint (sauf bloqués) | Oui | Selon ses permissions |
| 🟡 Fermé | Voit, ne rejoint pas | Peut rejoindre | Non bloquable |
| 🔴 Privé | Ne voit pas, ne rejoint pas | Voit et rejoint | Les administrateurs Discord contournent les dérogations : jamais de promesse de secret absolu |

### 6.2 Rôles (inspiration DraftBot)

- **Rôles d'accès** : qui peut rejoindre par défaut (@everyone par défaut).
- **Rôles modérateurs** : accès à tous les salons, non bloquables, peuvent utiliser les commandes de gestion.
- **Rôles intouchables** : ne peuvent être ni invités ni bloqués par un propriétaire.
- **Rôles sans accès au panneau** : pour interdire les réglages à certains profils.

Exemple guilde Dofus : « Membre » = accès ; « Officier » = modérateur ; « Chef » = intouchable.

### 6.3 Calcul des droits

Discord applique : permissions de base, rôles, dérogations @everyone, dérogations de rôles, dérogations de membres ; `ADMINISTRATOR` et le propriétaire du serveur contournent tout. Le module doit :
- calculer les permissions **effectives** avant d'annoncer un état ;
- ne pas supposer qu'un rôle plus haut l'emporte sur une dérogation de salon ;
- prévenir que personnaliser un salon le **désynchronise** de sa catégorie.

### 6.4 Droits du bot

À demander : `MANAGE_CHANNELS`, `MOVE_MEMBERS`, `VIEW_CHANNEL`, `CONNECT`, envoi de messages/embeds si panneau, `MANAGE_ROLES` pour poser des dérogations (jamais délégué aux membres). À ne pas demander : `ADMINISTRATOR`. L'assistant explique chaque droit.

### 6.5 Vocabulaire des actions

- **Bloquer** : refus pour la durée du salon (et déconnexion si présent).
- **Exclure** : expulsion pour la session, sans mémorisation.
- **Inviter / liste blanche** : autorisation explicite, pas de MP par défaut.
- **Purge** : déconnecte tous les présents sauf propriétaire, invités, modérateurs et admins ; liste affichée avant confirmation.
- **Transférer** : définitif ; le propriétaire perd l'accès au panneau ; prévenir avant confirmation.

### 6.6 Confidentialité et abus

- Aucun enregistrement audio ; journal minimal (action, auteur, cible, résultat, date) avec rétention paramétrable.
- Pas de mention massive implicite ; limites par utilisateur sur créations, renommages, invitations, exclusions.
- Autorisation admin vérifiée sur **chaque** mutation API ; droit du propriétaire vérifié sur **chaque** interaction.

---

## 7. Feuille de route

| Priorité | Fonction | Notes |
|---|---|---|
| **V1** | Générateurs multiples, création/déplacement/suppression idempotents | Un déclencheur = un générateur |
| **V1** | Panneau, commandes selon §5.3, rôles à 4 niveaux, modes d'accès | Boutons et commandes activables un par un |
| **V1** | Assistant, diagnostic, réparation, test guidé | Oui / Non partout |
| **V1** | Salons permanents exclus, pause, journal | |
| **V1.1** | Micro, vidéo, soundboard, statut du salon, région, bitrate | Chaque option sous contrôle admin |
| **V1.1** | Salle d'attente (demande d'accès à accepter/refuser) | Chez TempVoice, certaines options passent par vote ou premium ; ici sans condition |
| **V1.1** | Purge, réquisition, fil de discussion optionnel | |
| **V2** | Profils sauvegardés par membre et par générateur | Chargement par défaut possible |
| **V2** | Import de profil depuis un autre serveur | Rôles non importés |
| **V2** | Nommage avancé : séquences, pools de mots, clonage | Jamais de droits privilégiés clonés à l'aveugle |
| **V2** | LFM et liens SigilOS (planning, tickets) | Opt-in |
| **V2** | Statistiques agrégées | Pas de classement intrusif |

Idées SigilOS (non issues des concurrents, à valider) : vocal créé depuis un événement de raid/donjon planifié ; avertissement avant suppression d'un salon vide ; panneau en lecture seule pour les invités.

---

## 8. Architecture cible

### 8.1 Modules logiques

```text
Discord Gateway (voiceStateUpdate, interactions)
        │
        ├── VoiceRoomOrchestrator ── politiques, états, idempotence
        ├── DiscordVoiceAdapter ──── création, édition, droits, déplacements
        ├── VoicePermissionEngine ── calcul effectif + aperçu
        ├── VoicePanelHandler ────── boutons, formulaires, commandes, réponses éphémères
        ├── VoiceLifecycleWorker ─── nettoyage différé + réconciliation
        ├── VoiceAuditService ────── événements métier minimaux
        └── VoiceDashboardAPI ────── config, diagnostic, aperçu
                    │
              base SQL existante + verrou distribué / file de jobs si besoin
```

Ne pas créer un second bot : brancher sur le gestionnaire d'interactions de SigilOS. Séparer domaine et adaptateur Discord pour rester réutilisable hors Dofus.

### 8.2 Modèle de données proposé

```text
voice_generators
  id, guild_id, trigger_channel_id UNIQUE, destination_category_id
  enabled, config_json(versionné), created_by, created_at, updated_at

voice_rooms
  id, guild_id, generator_id, discord_channel_id UNIQUE NULL
  owner_user_id, state(CREATING|ACTIVE|EMPTY_PENDING|DELETING|DELETED|ERROR)
  creation_key UNIQUE, opened_at, empty_since NULL, deleted_at NULL
  panel_message_id NULL, last_error_code NULL, version

voice_room_access
  room_id, subject_type(USER|ROLE), subject_id, kind(ALLOW|BLOCK|TEMP_EJECT)
  expires_at NULL, UNIQUE(room_id, subject_type, subject_id, kind)

voice_permanent_channels
  guild_id, channel_id

voice_profiles (V2)
  guild_id, generator_id, user_id, profile_name, settings_json(versionné)
  is_default, created_at, updated_at

voice_events
  id, guild_id, room_id NULL, actor_id NULL, action, result, reason_code
  occurred_at, retention_deadline
```

Snowflakes stockés en **chaînes**. Index : `(guild_id, generator_id, state)`, `(guild_id, owner_user_id, state)`, `(state, empty_since)`.

### 8.3 Machine à états

```text
JOIN trigger
  └─ lock(guild_id, generator_id, user_id)
     ├─ room ACTIVE existante → essayer move, sans nouvelle création
     └─ intention CREATING → créer le salon Discord → persister l'ID
        ├─ membre toujours dans le trigger → move → ACTIVE
        └─ membre parti / move refusé → EMPTY_PENDING (ou ACTIVE si occupé)

VOICE_STATE_UPDATE sur un salon suivi
  ├─ ≥ 1 membre → ACTIVE, annuler le nettoyage
  └─ 0 membre → EMPTY_PENDING, vérification différée

Worker sur EMPTY_PENDING
  ├─ salon disparu → DELETED
  ├─ membres revenus → ACTIVE
  └─ toujours vide → DELETING → suppression Discord → DELETED
```

- Sérialiser par utilisateur/générateur et par salon ; contraintes uniques ; opérations rejouables.
- Écrire l'intention **avant** l'appel de création ; persister l'ID **immédiatement** après.
- Création Discord réussie mais échec base : orphelin retrouvable via journal, réconcilié sans suppression arbitraire.
- 404 à la suppression → `DELETED`. 403 → `ERROR` + alerte + retry borné après correction des droits.
- Réconciliation au démarrage et périodique contre la réalité Discord.
- **Jamais** de suppression sans preuve que le salon a été créé par SigilOS.

### 8.4 API cible

```text
GET    /guilds/:guildId/voice-generators
POST   /guilds/:guildId/voice-generators/preview
POST   /guilds/:guildId/voice-generators
PATCH  /guilds/:guildId/voice-generators/:id
POST   /guilds/:guildId/voice-generators/:id/diagnose
POST   /guilds/:guildId/voice-generators/:id/pause
POST   /guilds/:guildId/voice-generators/:id/repair
DELETE /guilds/:guildId/voice-generators/:id
GET    /guilds/:guildId/voice-rooms?state=ACTIVE
```

Toutes les écritures : authentification, autorisation serveur, validation que canal/rôle appartiennent à la guilde, CSRF si session navigateur, audit, clé d'idempotence si pertinent. `DELETE` d'un générateur ne supprime jamais les salons actifs sans action distincte.

### 8.5 Contraintes Discord (issues de la doc)

- **Rate limits** : lire les en-têtes (`X-RateLimit-*`, `Retry-After`, bucket) plutôt que coder des valeurs ; plafond global de 50 requêtes par seconde par bot.
- **Requêtes invalides** : 401, 403 et 429 comptent ; au-delà de 10 000 sur 10 minutes, restriction temporaire. Donc **vérifier les permissions avant d'appeler l'API** et ne jamais réessayer un 403 à l'aveugle.
- **Obfuscation des salons** : à partir du **16 novembre 2026**, un bot qui ne peut pas voir un salon recevra des métadonnées masquées. Le diagnostic contrôle `VIEW_CHANNEL` sur la catégorie et le déclencheur.
- **Statut de salon vocal** : événement dédié et permission `SET_VOICE_CHANNEL_STATUS`.
- **Synchronisation de catégorie** : modifier un salon enfant le désynchronise.
- `Voice State Update` n'est pas une preuve d'état final : revérifier l'occupation avant suppression.

---

## 9. Erreurs et confirmations

Oui / Non obligatoire pour : création initiale de ressources, remplacement d'un déclencheur, application aux salons actifs, purge, suppression d'un salon occupé, suppression d'un générateur, transfert de propriété. On montre **qui et quoi** avant confirmation et on **recontrôle les droits après**.

| Erreur | Action système |
|---|---|
| Bot sans `MOVE_MEMBERS` | Lien vers le salon, diagnostic ciblé |
| Catégorie invisible | Bloquer la publication, expliquer |
| 429 | File de reprise avec `Retry-After` |
| 403 répété | Stop des retries, alerte admin |
| 404 salon | Nettoyer l'état |
| Panneau non postable | Salon utilisable, `/vocal` proposé |
| Propriétaire parti | Réquisition si activée, recontrôle atomique |

---

## 10. Plan de tests

**Fonctionnels**
- Deux membres rejoignent en même temps : un salon chacun ; double événement : un seul salon.
- Plusieurs générateurs : bonne catégorie, bon preset, pause indépendante.
- Vieux panneau ou ancienne commande après transfert : refus propre.
- **Matrice des commandes §5.3** : chaque commande testée en tant que propriétaire, présent non propriétaire, membre hors salon, modérateur, intouchable, admin.
- Fermé / Privé testés sur permissions **effectives** avec plusieurs rôles contradictoires.
- Bloqué ne revient pas ; exclusion expire à la fin du salon ; protégés non bloquables.
- Dernier départ puis retour avant délai : pas de suppression ; vide durable : supprimé une seule fois ; salon permanent ou externe de même nom : intact.

**Fiabilité et sécurité**
- Redémarrage entre intention, création, écriture base, déplacement, suppression.
- Deux instances : verrous et contraintes uniques empêchent le doublon.
- Requêtes dashboard forgées sur un autre `guild_id` : rejetées.
- Rafale de créations, 429 et 403 simulés.
- Serveur avec `ADMINISTRATOR`, catégorie désynchronisée, bot sans droits.
- Bascule du 16 novembre 2026 testée sur un serveur où le bot ne voit pas certains salons.

**Critères « prêt à livrer V1 »**
- Assistant, diagnostic, panneau, commandes et nettoyage couverts par des tests automatisés + essai sur serveur de test.
- Aucun `ADMINISTRATOR` exigé, aucun `MANAGE_ROLES` donné aux membres.
- Aucun salon occupé supprimé, aucun salon non suivi supprimé.
- Chaque erreur de permission donne une explication actionnable.

---

## 11. Ordre d'implémentation

1. **Inventaire du code SigilOS** : gateway, interactions, API dashboard, ORM, rôles, worker, logs, déploiement.
2. **Noyau** : migration, générateur, événement vocal, création/déplacement, états, nettoyage prudent, reprise.
3. **Permissions** : moteur unique de droits effectifs, rôles à 4 niveaux, modes d'accès, garde des commandes.
4. **UX** : assistant, aperçu, Oui / Non, diagnostic, panneau, commandes, charte de ton.
5. **Échelle** : multi-générateurs, multi-instance, files, métriques, réconciliation.
6. **V1.1 / V2** : salle d'attente, profils, modèles avancés, intégrations SigilOS activables séparément.

**Décision centrale** : livrer d'abord une expérience simple et sûre, mais penser états, rôles et permissions dès la V1.

---

## 12. Questions ouvertes

- Panneau par défaut dans le chat du vocal ou dans un salon dédié ?
- Réquisition activée par défaut ? (proposition : non)
- `/vocal info` visible des seuls présents (proposition) ou de tous ?
- Quota par serveur, et à quelle valeur ?
- Presets Dofus visibles pour tous les serveurs ou seulement ceux marqués « Dofus » ?

---

## 13. Sources consultées le 30 septembre 2026

- DraftBot — [Salons vocaux temporaires](https://www.draftbot.fr/docs/engagement/salons-vocaux-temporaires), [Logs](https://www.draftbot.fr/docs/securite/logs)
- TempVoice — [Accueil](https://easy.tempvoice.xyz/), [Quickstart](https://easy.tempvoice.xyz/getting-started/setup), [Interface Message](https://easy.tempvoice.xyz/commands/interface-message), [Waiting](https://easy.tempvoice.xyz/commands/voice/waiting), [/voice](https://easy.tempvoice.xyz/commands/voice), [/voice user](https://easy.tempvoice.xyz/commands/voice/user)
- VoiceMaster — [Guide de setup](https://voicemaster.xyz/guides/en/how-to-setup-bot), [Index des commandes](https://voicemaster.xyz/en/docs/commands), [Guide des commandes vocales](https://voicemaster.xyz/guides/fr/voice-commands-guide), [/voice claim](https://voicemaster.xyz/en/docs/commands/voice-claim)
- Discord — [Rate limits](https://docs.discord.com/developers/topics/rate-limits), [Permissions](https://docs.discord.com/developers/topics/permissions), [Gateway events](https://docs.discord.com/developers/events/gateway-events)

**Limites** : `llms.txt` et la page « greeting » de TempVoice n'ont pas chargé ; la page VoiceMaster `set channel` n'a pas été lue en détail ; la répartition précise des droits par commande chez VoiceMaster provient en partie d'une doc tierce sur les commandes en préfixe, à prendre comme indicative. Noms d'écrans, commandes `/vocal`, valeurs par défaut, schémas et priorités sont des **recommandations SigilOS**, à valider dans le dépôt et sur un serveur de test.
