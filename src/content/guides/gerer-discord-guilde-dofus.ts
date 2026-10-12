export const guide = {
    slug: "gerer-discord-guilde-dofus",
    title: "Gérer le Discord de sa guilde Dofus : architecture, permissions, sécurité et sorties",
    description:
        "Le guide de terrain pour bâtir un Discord de guilde Dofus performant : arborescence épurée, permissions fail-closed, parade anti-phishing, gestion des raids 3.6 et intégration native avec SigilOS.",
    publishedAt: "2026-08-23",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Un serveur Discord doit servir le jeu, pas devenir un second travail</strong>
            <p>Le rôle d'un Discord de guilde n'est pas d'empiler 40 salons fantômes ou 8 bots redondants. Il doit répondre à trois impératifs : trouver une information en 5 secondes, monter un donjon ou un raid sans friction, et protéger ses membres contre les vols de compte. Moins il y a de bruit, plus la guilde joue ensemble.</p>
        </div>

        <h2>I. Architecture : des flux nets, zéro salon mort</h2>
        <p>L'erreur la plus fréquente des meneurs est de créer un salon pour chaque idée passagère (<code>#fm-cac</code>, <code>#drop-vulbis</code>, <code>#musique</code>). Résultat : des canaux déserts qui diluent l'activité et découragent les nouveaux. Chaque catégorie doit répondre à un flux de jeu précis.</p>

        <div class="callout callout-info">
            <strong>La règle d'or : Salon thématique + Fils temporaires</strong>
            <p>Plutôt que de créer un salon par donjon ou par quête, conservez un salon racine (ex. <code>#sorties-et-succes</code>) et ouvrez <strong>un fil de discussion par sortie</strong>. Une fois le donjon plié ou la soirée terminée, le fil s'archive automatiquement : l'historique reste consultable sans encombrer la barre latérale.</p>
        </div>

        <h3>1. L'arborescence recommandée pour Dofus 2026</h3>
        <table>
            <thead>
                <tr>
                    <th>Catégorie</th>
                    <th>Salons indispensables</th>
                    <th>Rôle et règles d'utilisation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>📌 01. ACCUEIL & INFOS</strong></td>
                    <td><code>#reglement</code><br/><code>#annonces</code><br/><code>#liens-utiles</code></td>
                    <td><strong>Lecture seule absolue.</strong> Pas de flood. <code>#annonces</code> est réservé aux communications officielles du meneur et des bras droits (raids, rassemblements, votes).</td>
                </tr>
                <tr>
                    <td><strong>💬 02. QG DE GUILDE</strong></td>
                    <td><code>#taverne</code><br/><code>#screens-et-drops</code><br/><code>#commandes-bot</code></td>
                    <td>Le cœur social. Accessible uniquement après attribution du rôle <em>Membre</em> ou <em>Recrue</em>. Activez un slowmode de 3 à 5 secondes sur la taverne uniquement en cas de rush ou de pic de spam.</td>
                </tr>
                <tr>
                    <td><strong>⚔️ 03. SORTIES & OBJECTIFS</strong></td>
                    <td><code>#sorties-et-succes</code><br/><code>#songes-infinis</code><br/><code>#raids-de-guilde</code><br/><code>#missions-hebdo</code></td>
                    <td>Opérationnel pur. Une sortie = un fil de discussion. Le salon <code>#missions-hebdo</code> sert à coordonner les 12 missions de guilde chaque mardi dès le reset de 7h pour valider les jalons d'XP.</td>
                </tr>
                <tr>
                    <td><strong>🔨 04. ÉCONOMIE & ENTRAIDE</strong></td>
                    <td><code>#artisans-et-craft</code><br/><code>#bourse-aux-archis</code><br/><code>#prets-et-coffre</code></td>
                    <td>Entraide ciblée. Le salon <code>#bourse-aux-archis</code> fluidifie la quête du Dofus Ocre en évitant d'inonder la taverne de listes interminables.</td>
                </tr>
                <tr>
                    <td><strong>🔊 05. SALONS VOCAUX</strong></td>
                    <td><code>🔊 Taverne (Ouvert)</code><br/><code>⚔️ Donjon 1 (4 places)</code><br/><code>⚔️ Donjon 2 (4 places)</code><br/><code>🐙 Raid (12-16 places)</code><br/><code>🤫 Focus / Stream</code></td>
                    <td><strong>Calibrez les limites d'utilisateurs.</strong> Un vocal donjon à 4 places empêche les parasites extérieurs de perturber un combat de boss tendu. Les membres qui discutent restent en Taverne.</td>
                </tr>
                <tr>
                    <td><strong>🛡️ 06. STAFF & MODÉRATION</strong></td>
                    <td><code>#qg-officiers</code><br/><code>#candidatures</code><br/><code>#journal-audit</code><br/><code>#urgences-phishing</code></td>
                    <td>Strictement invisible pour les membres. Les discussions sur les recrutements, avertissements et litiges de guilde ne doivent jamais transpirer en public.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Fini le cimetière de vocaux : le modèle dynamique</h3>
        <p>Rien n'est plus triste qu'un serveur affichant 12 salons vocaux vides. Deux approches professionnelles existent :</p>
        <ul>
            <li><strong>L'arborescence fixe resserrée</strong> : 1 vocal libre (Taverne), 2 vocaux Donjon plafonnés à 4 joueurs, 1 vocal Raid et 1 vocal muet pour les joueurs qui stream leur écran Dofus.</li>
            <li><strong>Le vocal dynamique (« Rejoindre pour créer »)</strong> : Un unique salon déclencheur (Hub). Dès qu'un joueur y entre, le bot crée instantanément un vocal éphémère (ex: <code>🎙️ Donjon de [Pseudo]</code>) avec la bonne limite de places. Dès que le dernier joueur quitte, le salon est supprimé. Votre Discord reste propre en permanence.</li>
        </ul>

        <h2>II. Sécurité & Permissions : le rempart fail-closed</h2>
        <p>Un Discord de guilde Dofus est une cible privilégiée pour les pirates. Le principe de sécurité de référence est le <strong>fail-closed</strong> : par défaut, un utilisateur n'a aucun droit tant qu'il n'a pas été explicitement authentifié.</p>

        <h3>1. Le verrouillage hermétique de <code>@everyone</code></h3>
        <p>Le rôle <code>@everyone</code> s'applique automatiquement à n'importe quel compte qui franchit la porte de votre serveur. S'il n'est pas verrouillé, un bot pirate peut rejoindre à 4h du matin et mentionner toute votre communauté avec un faux lien Ankama.</p>

        <table>
            <thead>
                <tr>
                    <th>Permission Discord</th>
                    <th>État obligatoire</th>
                    <th>Justification technique</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Mentionner <code>@everyone</code>, <code>@here</code> et tous les rôles</td>
                    <td>🔴 <strong>DÉSACTIVÉ</strong></td>
                    <td>Évite les pings massifs dévastateurs en cas de raid ou de faille de compte.</td>
                </tr>
                <tr>
                    <td>Créer des invitations</td>
                    <td>🔴 <strong>DÉSACTIVÉ</strong></td>
                    <td>Le staff garde la totale maîtrise des arrivées et peut révoquer un lien compromis en un clic.</td>
                </tr>
                <tr>
                    <td>Envoyer des messages & joindre des fichiers</td>
                    <td>🔴 <strong>DÉSACTIVÉ</strong></td>
                    <td>Ouvrez l'écriture uniquement dans <code>#presentations</code>. Les fichiers et images doivent être bloqués pour les non-membres.</td>
                </tr>
                <tr>
                    <td>Intégrer des liens (Embed Links)</td>
                    <td>🔴 <strong>DÉSACTIVÉ</strong></td>
                    <td>Bloque net la diffusion de liens de phishing dès l'entrée du serveur.</td>
                </tr>
                <tr>
                    <td>Gérer les rôles, salons, webhooks ou messages</td>
                    <td>🔴 <strong>DÉSACTIVÉ</strong></td>
                    <td>Aucune permission administrative ne doit être héritée par défaut.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Hiérarchie des rôles Discord</h3>
        <p>Sur Discord, la position verticale des rôles régit l'autorité. Un rôle ne peut jamais modérer, attribuer ou retirer un rôle situé au-dessus de lui. Structurez vos rôles du haut vers le bas :</p>

        <ol>
            <li><strong>👑 Meneur de Guilde</strong> : Propriétaire du serveur Discord. Authentification à deux facteurs (2FA) <strong>obligatoire</strong>. Ne l'attribuez jamais à un tiers.</li>
            <li><strong>🤖 Bot SigilOS</strong> : Positionné immédiatement sous le Meneur pour pouvoir synchroniser et attribuer les rôles de guilde sans nécessiter la dangereuse permission <code>Administrateur</code>.</li>
            <li><strong>⚔️ Bras Droits / Officiers</strong> : Gestion des sorties, modération des salons, gestion des candidatures. Aucun droit de modifier la structure du serveur ou les intégrations sensibles.</li>
            <li><strong>🛡️ Modérateurs / Organisateurs</strong> : Gestion des messages, expulsion temporaire (timeout), gestion des vocaux et création d'événements.</li>
            <li><strong>⚜️ Membre de Guilde</strong> : Accès intégral aux salons internes, vocaux, partage de captures et réactions.</li>
            <li><strong>🌱 Recrue à l'essai</strong> : Accès restreint le temps de l'intégration (généralement 1 à 2 semaines). Envoi de liens externes bridé pour éviter les mauvaises surprises.</li>
            <li><strong>🤝 Invité / Allié</strong> : Accès limité aux salons d'alliance ou au vocal inter-guilde. Zéro visibilité sur la taverne, le coffre ou les sorties internes.</li>
        </ol>

        <div class="callout callout-warning">
            <strong>Parade anti-phishing Dofus : les 3 arnaques qui détruisent les guildes</strong>
            <p>Les joueurs de Dofus sont la cible permanente d'attaques ciblées sur Discord :</p>
            <ul>
                <li><strong>Le piège du compte ami piraté</strong> : Le compte Discord d'un membre de votre guilde se fait voler. Le pirate poste dans votre chat : <em>« Les gars, votez pour notre guilde sur le forum Dofus pour gagner un Pack d'abonnement : lien-fake-dofus.com »</em>. La moitié de la guilde clique en pensant qu'il s'agit d'un ami.</li>
                <li><strong>Le faux bot de vérification par QR Code</strong> : Un bot prétendant vérifier l'âge ou le compte Ankama demande de scanner un QR code via l'application Discord mobile. <strong>Ne scannez jamais de QR code Discord</strong> : cela transfère l'accès direct de votre session au pirate.</li>
                <li><strong>La règle absolue du staff</strong> : Un vrai administrateur Dofus ou Ankama ne vous contactera <strong>JAMAIS</strong> en message privé Discord. Bloquez l'envoi de messages privés entre membres du serveur dans vos paramètres Discord si vous constatez des démarchages suspects.</li>
            </ul>
        </div>

        <h2>III. Onboarding : de l'arrivée au premier combat</h2>
        <p>Un nouveau joueur qui arrive sur un serveur et attend 24 heures sans savoir où cliquer va simplement fermer Discord et chercher une autre guilde. L'accueil doit être fluide et balisé.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-onboarding-natif.png" alt="Configuration du processus d'accueil natif sur Discord" class="guide-image" />
            <span class="guide-caption">Activez l'onboarding communautaire de Discord : questionnaire d'entrée, sélection des rôles de notifications et salons de démarrage visibles immédiatement.</span>
        </div>

        <h3>Les 4 étapes d'une intégration réussie</h3>
        <ol>
            <li><strong>Le sas d'accueil</strong> : Le nouvel arrivant voit uniquement <code>#reglement</code> et <code>#presentations</code>.</li>
            <li><strong>La fiche personnage type</strong> : Épinglez un modèle court dans <code>#presentations</code> :<br/>
                <code>Pseudo en jeu / Classe / Niveau / Serveur — Métiers principaux — Horaires habituels — Objectifs (PvM, Quêtes, Songes, Élevage).</code>
            </li>
            <li><strong>Attribution des rôles de notification (Opt-in)</strong> : Laissez les membres choisir leurs alertes via des rôles de réaction : <code>@Sorties PvM</code>, <code>@Raids</code>, <code>@Songes</code>, <code>@Artisans</code>. <strong>Bannissez les mentions <code>@everyone</code></strong> pour les annonces de sorties courantes sous peine de lasser les membres.</li>
            <li><strong>Liaison avec le profil de guilde</strong> : Un officier valide la présentation et attribue le rôle <em>Recrue</em> ou <em>Membre</em>.</li>
        </ol>

        <h2>IV. Organisation des sorties : Donjons, Songes et Raids 3.6</h2>
        <p>Rien ne tue plus vite la motivation d'une guilde que les sorties improvisées avec des messages éparpillés, où 3 personnes répondent « dispo », mais où personne ne sait qui joue quelle classe ni qui a les clefs.</p>

        <h3>1. Le canevas d'annonce officiel</h3>
        <pre><code>⚔️ [SORTIE] — Nom du Donjon ou Objectif (ex: Tal Kasha / Succès Zombie)

📅 Date & Heure : Jeudi 21h00 (groupage à 20h45)
🎯 Objectif : Validation de quête + Succès Zombie
👥 Composition recherchée :
   1. [Pseudo] - Panda Tank (Leader)
   2. [Pseudo] - Eniripsa / Soin
   3. [Libre]  - Placeur ou Entrave (Elio, Sram...)
   4. [Libre]  - Gros DPS (Iop, Cra, Ouginiak...)
⏱️ Durée estimée : 1h15
🎒 Pré-requis : Clef du donjon en inventaire, avoir validé la quête d'accès
📍 Lieu : Vocal Donjon 1

Inscription : Réagissez ci-dessous avec votre classe et rôle.</code></pre>

        <h3>2. Spécificités des Raids 3.6 (Gigalodon, Jardins Éternels)</h3>
        <p>Avec les Raids de guilde introduits par la mise à jour 3.6, organiser 8 à 16 joueurs sur Discord exige une rigueur militaire :</p>
        <ul>
            <li><strong>Annonce 48h à l'avance</strong> : Prévoyez systématiquement <strong>2 remplaçants</strong> inscrits sur liste d'attente. Un imprévu de dernière minute à 20h55 ne doit pas annuler la sortie de 12 joueurs.</li>
            <li><strong>Briefing vocal 10 minutes avant</strong> : Attribution des rôles spécifiques aux mécaniques de salle (qui gère l'invocation, qui débuff, qui porte les clés).</li>
            <li><strong>Clôture systématique</strong> : Une fois le raid terminé, notez le score obtenu et archivez le fil. Les inscriptions fantômes de la semaine passée ne doivent pas parasiter le serveur.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/sigilos-donjons-quetes.png" alt="Module Donjons et Quêtes SigilOS avec synchronisation Discord" class="guide-image" />
            <span class="guide-caption">Le module Donjons & Quêtes de SigilOS : création de cartes d'événement, compositions de classes et inscriptions en temps réel synchronisées avec Discord.</span>
        </div>

        <h2>V. Ce que Discord ne sait pas faire seul (Et comment SigilOS le résout)</h2>
        <p>Discord est une messagerie instantanée hors pair. Mais dès qu'il s'agit de gérer un calendrier de sorties, de savoir qui est Forgemage 200 connecté, ou d'échanger des archimonstres sans perdre le fil, <strong>Discord montre ses limites</strong>. Les listes épinglées deviennent obsolètes, les messages se noient, et les officiers s'épuisent.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-embed-sigilos-donjon.png" alt="Embed Discord officiel du bot SigilOS avec boutons d'inscription" class="guide-image" />
            <span class="guide-caption">Ce que voit votre guilde sur Discord : un embed SigilOS automatisé avec carte officielle, objectifs, rôles requis et boutons d'inscription interactive.</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Mission de guilde</th>
                    <th>La galère sur Discord seul</th>
                    <th>Avec l'écosystème SigilOS</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Inscriptions aux Sorties</strong></td>
                    <td>Réactions emojis confuses, doublons de classes, pas de rappel automatique.</td>
                    <td><strong>Embed interactif</strong> : inscriptions par classe/rôle, composition équilibrée visible en temps réel et synchronisation sur l'agenda web de la guilde.</td>
                </tr>
                <tr>
                    <td><strong>Quête de l'Ocre & Archis</strong></td>
                    <td>Des dizaines de messages <em>« qui a l'archi Piou bleu ? »</em> qui polluent le chat textuel.</td>
                    <td><strong>Bourse d'échange d'archimonstres</strong> : chaque membre indique ses archimonstres possédés, manquants et doublons. La matrice repère immédiatement les échanges possibles.</td>
                </tr>
                <tr>
                    <td><strong>Annuaire des Artisans</strong></td>
                    <td>Spam régulier dans <code>#taverne</code> pour chercher un Forgemage ou Cordonnier 200.</td>
                    <td><strong>Annuaire dynamique</strong> : liste actualisée de tous les métiers et niveaux de chaque membre, consultable en 1 clic.</td>
                </tr>
                <tr>
                    <td><strong>Missions Hebdo (Mardi 7h)</strong></td>
                    <td>Tableaux Excel externes ou bloc-notes Discord que personne ne met à jour.</td>
                    <td><strong>Suivi des 12 missions</strong> de guilde, calcul des paliers d'activité et optimisation du gain de Guildatons.</td>
                </tr>
                <tr>
                    <td><strong>Activité & Rangs de guilde</strong></td>
                    <td>Impossible de distinguer les membres investis des inactifs sans inspecter les logs à la main.</td>
                    <td><strong>Ladder d'activité Discord</strong> : mesure automatique du temps passé en vocal, des streams et des messages pour récompenser les piliers de guilde.</td>
                </tr>
                <tr>
                    <td><strong>Sécurité & Succession</strong></td>
                    <td>Si le compte du meneur est banni ou supprimé de Discord, la guilde perd ses accès administratifs.</td>
                    <td><strong>Succession automatique fail-safe</strong> : SigilOS préserve la propriété de guilde et transfère les accès au successeur légitime sans blocage.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Garde-fous techniques de SigilOS</strong>
            <p>Le bot SigilOS applique le principe du moindre privilège (<em>least privilege</em>). Il ne requiert pas de permission Administrateur, ne lit jamais les frappes de touches (<code>GuildMessageTyping</code> désactivé), chiffre ses communications et archive proprement les profils pendant 12 mois en cas de départ.</p>
        </div>

        <h2>VI. Modération & Gestion des crises de guilde</h2>
        <p>Un conflit mal géré sur un salon public peut faire imploser une guilde en 48 heures. Prévoyez des protocoles écrits connus de tous les officiers.</p>

        <table>
            <thead>
                <tr>
                    <th>Scénario de crise</th>
                    <th>Action immédiate du staff</th>
                    <th>Traitement de fond</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Litige de butin / perco / coffre</strong></td>
                    <td>Isoler les protagonistes. Couper court aux débats publics dans <code>#taverne</code>.</td>
                    <td>Ouvrir un <strong>ticket privé</strong> entre les officiers et les personnes concernées. Se référer au règlement écrit, sans traitement de faveur.</td>
                </tr>
                <tr>
                    <td><strong>Compte officier piraté</strong></td>
                    <td>Retirer immédiatement tous les rôles administratifs du compte concerné via Discord.</td>
                    <td>Vérifier le journal d'audit (rôles attribués, salons modifiés, webhooks créés). Publier un avertissement dans <code>#annonces</code> pour signaler le piratage.</td>
                </tr>
                <tr>
                    <td><strong>Raid de spam ou bot malveillant</strong></td>
                    <td>Activer le mode de sécurité Discord (verrouillage temporaire des nouveaux messages).</td>
                    <td>Bannir les comptes robots, révoquer le lien d'invitation utilisé et purger les messages via les commandes du bot.</td>
                </tr>
            </tbody>
        </table>

        <h2>VII. Checklist de déploiement et d'audit trimestriel</h2>
        <p>Que vous créiez votre Discord ou que vous repreniez un serveur existant, cochez cette liste avant d'ouvrir les vannes :</p>

        <ol>
            <li>[ ] <strong>Rôle @everyone verrouillé</strong> : mentions bannie, invitations désactivées, zéro intégration de liens.</li>
            <li>[ ] <strong>2FA obligatoire</strong> activée sur le compte du Meneur et de chaque Officier.</li>
            <li>[ ] <strong>Arborescence resserrée</strong> : moins de 20 salons au total, aucun canal fantôme sans message depuis plus de 30 jours.</li>
            <li>[ ] <strong>Salons vocaux calibrés</strong> : Taverne ouverte, donjons bloqués à 4 places, vocal raid calibré.</li>
            <li>[ ] <strong>Onboarding communautaire activé</strong> avec règlement clair et rôles de notifications opt-in.</li>
            <li>[ ] <strong>Salon staff et tickets privés configurés</strong> pour traiter les candidatures et litiges en toute discrétion.</li>
            <li>[ ] <strong>Bot SigilOS connecté</strong> : synchronisation des rôles, module de sorties déployé et annuaire d'artisans actif.</li>
            <li>[ ] <strong>Audit des permissions réelles</strong> : testez la vue du serveur avec la fonction <em>« Voir le serveur depuis le rôle »</em> (Recrue, Membre, Invité).</li>
        </ol>

        <div class="callout callout-tip">
            <strong>Conclusion : la simplicité fait la longévité</strong>
            <p>Une guilde Dofus vit par ses combats, ses réussites communes et ses soirées en vocal, pas par la complexité de ses salons textuels. En combinant un Discord épuré et sécurisé avec la puissance d'organisation de SigilOS, vous offrez à vos membres le meilleur cadre de jeu possible.</p>
        </div>
    `,
} as const;