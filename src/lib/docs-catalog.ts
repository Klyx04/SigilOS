/**
 * RÉFÉRENCE FIGÉE — la vérité documentaire vit en base (`DocPage`, éditée via
 * `/god/docs`). Plus aucun sync, seed ou bouton ne rejoue ce fichier : il sert
 * de secours (contenu récupérable) et de garde-fou de style pour les tests
 * (`market-docs`, `songes-docs` : HTML sémantique, faits réels, aucun rôle en dur).
 */
export interface OfficialDoc {
    slug: string;
    title: string;
    category: string;
    accessLevel: 'PUBLIC' | 'MEMBER' | 'ADMIN';
    content: string;
}

export const OFFICIAL_DOCS: OfficialDoc[] = [
// =========================================================================
    // 🌟 PROGRESSION & OBJECTIFS
    // =========================================================================
    {
        slug: 'quetes-dofus',
        title: 'Les Quêtes Dofus & Guides Étape par Étape',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Tracker de Quêtes des Dofus de SigilOS</h2>
<p>L'obtention des Dofus est le cœur de la progression sur Dofus. Le module <strong>Les Quêtes Dofus</strong> permet à chaque membre de suivre sa progression quête par quête, étape par étape, tout en partageant son avancée avec l'ensemble de la guilde pour débloquer les combats de groupe et l'entraide mutuelle.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Interface interactive : suivi chronologique, prérequis et étapes des Dofus primaires et secondaires.</figcaption>
</figure>

<h2>1. Liste des Dofus Disponibles dans le Tracker</h2>
<p>SigilOS intègre les parcours complets des Dofus majeurs du jeu :</p>

<table>
    <thead>
        <tr>
            <th>Dofus</th>
            <th>Niveau Requis</th>
            <th>Type</th>
            <th>Difficulté & Points Clés</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Dofus Argenté / Étincelant</strong></td>
            <td>Niv. 20 - 50</td>
            <td>Secondaire</td>
            <td>Quêtes d'Astrub. Idéal pour les débutants et rerolls.</td>
        </tr>
        <tr>
            <td><strong>Dofus Cawotte</strong></td>
            <td>Niv. 60</td>
            <td>Secondaire</td>
            <td>Île des Wabbits. Nécessite la panoplie du Wa Wabbit et le chemin des terriers.</td>
        </tr>
        <tr>
            <td><strong>Dokoko</strong></td>
            <td>Niv. 80</td>
            <td>Secondaire</td>
            <td>Île de Moon. Combats tactiques avec Kannibouls et quêtes de récolte.</td>
        </tr>
        <tr>
            <td><strong>Dofus Émeraude</strong></td>
            <td>Niv. 100</td>
            <td>Primaire</td>
            <td>Cania, bandits de Cania (Namekop, Edasse, Eratz) et combat contre le Dark Vlad.</td>
        </tr>
        <tr>
            <td><strong>Dofus Pourpre</strong></td>
            <td>Niv. 110</td>
            <td>Primaire</td>
            <td>Chasse au trésor, labyrinthe du Minotoror et combat tactique contre le Mominotor.</td>
        </tr>
        <tr>
            <td><strong>Dofus Turquoise</strong></td>
            <td>Niv. 160</td>
            <td>Primaire</td>
            <td>Donjons avec idoles/succès spécifiques (Mansot, Sapik, Sphincter Cell, Chêne Mou, Dragon Cochon, etc.).</td>
        </tr>
        <tr>
            <td><strong>Dofus des Veilleurs</strong></td>
            <td>Niv. 120</td>
            <td>Dimensions</td>
            <td>Exploration des dimensions divines (Enutrosor, Srambad, Xélorium).</td>
        </tr>
        <tr>
            <td><strong>Dofus Abyssal</strong></td>
            <td>Niv. 200</td>
            <td>Endgame</td>
            <td>Sous-marins de Sufokia, donjons Koutoulou, Dantinéa et Meno.</td>
        </tr>
        <tr>
            <td><strong>Dofus Ivoire</strong></td>
            <td>Niv. 180 - 200</td>
            <td>Primaire</td>
            <td>Alignement 1 à 100, donjons d'Ilyzaelle et combat contre Dathura.</td>
        </tr>
        <tr>
            <td><strong>Dofus Ébène</strong></td>
            <td>Niv. 200</td>
            <td>Primaire</td>
            <td>Voyage dans la zone des Songes, combats de boss corrompus et quêtes d'alignement.</td>
        </tr>
        <tr>
            <td><strong>Dofus Vulbis</strong></td>
            <td>Niv. 200</td>
            <td>Primaire</td>
            <td>Donjons THL, Songes Infinis et combat contre Crocoburio.</td>
        </tr>
        <tr>
            <td><strong>Dofus Sylvestre</strong></td>
            <td>Niv. 200</td>
            <td>Événement / Spécial</td>
            <td>Archipel des Vents et quêtes d'exploration végétale.</td>
        </tr>
    </tbody>
</table>

<h2>2. Fonctionnement de la Synchronisation & Entraide</h2>
<p>Chaque fois que vous cochez une étape sur votre fiche :</p>
<ul>
    <li><strong>Visibilité Immédiate :</strong> Vos compagnons de guilde voient exactement à quelle étape vous vous situez.</li>
    <li><strong>Matching des Combats Bloquants :</strong> Si un combat tactique à 4 ou un donjon difficile est requis (ex : combat contre le Dark Vlad ou les Bandits de Cania), le système indique quels autres membres sont sur la même étape pour créer un groupe immédiatement.</li>
    <li><strong>Liaison Directe DofusDB :</strong> Cliquez sur n'importe quel PNJ, objet ou position pour ouvrir sa fiche détaillée sur DofusDB.</li>
</ul>

<div class="callout callout-tip">
<strong>💡 Astuce pour les Sorties de Groupe</strong>
Utilisez le module <em>Donjons & Quêtes</em> en parallèle pour créer un appel à l'aide en 1 clic lorsque vous arrivez sur une étape de donjon obligatoire.
</div>

<h2>3. Succès et succès imbriqués</h2>
<p>Dans Dofus, un succès ne contient pas toujours directement des quêtes : il peut aussi demander d&apos;obtenir d&apos;autres succès, qui contiennent eux-mêmes les quêtes. Le tracker reproduit cette hiérarchie :</p>
<ul>
    <li><strong>Bloc « Succès » :</strong> une carte dépliable avec son compteur d&apos;objectifs (<em>4/7 objectifs</em>). Les objectifs sont les quêtes à réaliser, listées juste en dessous.</li>
    <li><strong>Succès dans un succès :</strong> un objectif peut être un autre succès — l&apos;imbrication est affichée telle quelle, jusqu&apos;au niveau où se trouvent les quêtes.</li>
    <li><strong>Tout valider / Tout reset :</strong> ces boutons, sur un succès, agissent sur les quêtes de son sous-arbre uniquement. Aucun succès ne possède d&apos;état propre : c&apos;est la validation de ses quêtes qui le complète.</li>
    <li><strong>Compteurs du Dofus :</strong> seules les quêtes comptent comme étapes. Un succès conteneur ne gonfle ni le total, ni le pourcentage d&apos;avancement.</li>
</ul>
<p>La recherche et le filtre « Masquer » conservent toujours le succès parent d&apos;une quête trouvée, pour ne jamais afficher un objectif orphelin.</p>

<div class="callout">
<strong>Réservé aux administrateurs</strong>
La structure des succès (nature « Quête » ou « Succès », rattachement à un succès parent) se règle depuis l&apos;éditeur de quêtes, section par section. Le module refuse les rattachements impossibles : parent d&apos;une autre section, parent qui n&apos;est pas un succès, ou lien circulaire.
</div>
        `
    },
    {
        slug: 'missions',
        title: 'Missions & Défis Hebdomadaires',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Moteur de Quêtes Hebdomadaires</h2>
<p>Chaque semaine, le staff sélectionne une série d'objectifs stimulants et rémunérateurs pour dynamiser la guilde : boss de donjons spécifiques, récoltes de métiers, combats de quête ou accomplissement de succès.</p>

<figure class="my-6">
    <img src="/assets/landing/mission-preview.png" alt="Module Missions SigilOS" class="rounded-2xl border border-white/10 shadow-2xl w-full" />
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Aperçu du module Missions : objectifs en cours, réservation de places et dépôt de captures.</figcaption>
</figure>

<h2>1. Comment Participer à une Mission ?</h2>
<ol>
    <li><strong>Consulter les Missions Actives :</strong> Rendez-vous sur l'onglet <em>Missions</em> pour voir la liste des défis proposés pour la semaine courante.</li>
    <li><strong>Réserver sa Place :</strong> Cliquez sur le bouton <em>"Je participe"</em> pour indiquer votre intention de faire la mission et être comptabilisé dans le groupe.</li>
    <li><strong>Réaliser le Défi en Jeu :</strong> Formez un groupe avec vos compagnons de guilde et réalisez le combat ou l'objectif Dofus.</li>
</ol>

<h2>2. Soumission de la Capture d'Écran (OCR Intelligent)</h2>
<p>Dès le combat terminé, prenez une capture d'écran de la fenêtre de fin de combat.</p>

<div class="callout callout-info">
<strong>🧠 Reconnaissance Automatique par IA (OCR)</strong>
Le moteur de SigilOS analyse l'image déposée pour extraire le nom du monstre vaincu, les pseudos de tous les joueurs présents et l'horodatage. Si tout correspond, votre participation est pré-remplie automatiquement !
</div>

<h3>Checklist de Conformité d'une Capture :</h3>
<ul>
    <li>✅ <strong>Fenêtre de fin de combat ouverte :</strong> Le tableau récapitulatif des gains et des participants doit être net.</li>
    <li>✅ <strong>Pseudos lisibles :</strong> Les noms de vos personnages doivent être visibles sans superposition d'interface.</li>
    <li>✅ <strong>Nom du Boss identifiable :</strong> L'en-tête du combat doit afficher clairement le boss ciblé.</li>
    <li>❌ <strong>Pas de screen tronqué ou rogné :</strong> Une capture partielle sera automatiquement mise en attente de vérification manuelle par le staff.</li>
</ul>

<h2>3. Attribution des Points & Clôture Hebdomadaire</h2>
<p>Chaque mission rapporte des <strong>Points de Contribution</strong> et de l'expérience de guilde :</p>
<ul>
    <li><strong>Validation Directe :</strong> Dès validation par l'OCR ou confirmation par un officier, vos points sont crédités sur votre profil.</li>
    <li><strong>Reset le Dimanche Soir :</strong> À minuit chaque dimanche, les missions de la semaine sont clôturées, les classements sont figés et les nouveaux objectifs sont publiés sur Discord.</li>
</ul>
        `
    },
    {
        slug: 'quete-ocre',
        title: 'Gestion de la Quête Ocre & Matching Metamob',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>La Quête de l'Éternelle Moisson (Dofus Ocre)</h2>
<p>La quête de l'Éternelle Moisson nécessite la capture de <strong>286 âmes de monstres</strong>, dont des dizaines de boss de donjons et les redoutables <strong>Archimonstres</strong>. SigilOS intègre une passerelle bidirectionnelle avec <strong>Metamob</strong> pour transformer ce calvaire individuel en une réussite collective de guilde.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Tableau de matching : détection automatique des échanges optimaux entre membres.</figcaption>
</figure>

<h2>1. Liaison de votre Compte Metamob</h2>
<ol>
    <li>Créez ou connectez votre compte sur le site officiel <a href="https://metamob.fr" target="_blank" rel="noopener noreferrer">Metamob.fr</a>.</li>
    <li>Rendez-vous dans vos paramètres de profil Metamob pour récupérer votre <strong>Clé API</strong> et votre pseudo.</li>
    <li>Sur SigilOS, ouvrez votre <strong>Profil</strong> et collez votre clé dans la section <em>Quête Ocre & Metamob</em>.</li>
</ol>

<h2>2. Les 3 Algorithmes de Matching Inter-Membres</h2>
<p>Une fois votre compte lié, SigilOS croise en continu les listes d'âmes de tous les membres de la guilde :</p>

<table>
    <thead>
        <tr>
            <th>Vue</th>
            <th>Utilité</th>
            <th>Action Recommandée</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Mes Manquants Disponibles</strong></td>
            <td>Affiche les archimonstres qu'il vous manque et qu'un guildmate possède en double.</td>
            <td>Contactez le membre via Discord pour effectuer l'échange en jeu.</td>
        </tr>
        <tr>
            <td><strong>Mes Doubles Utiles</strong></td>
            <td>Liste vos archimonstres en surplus qui manquent à un ou plusieurs compagnons.</td>
            <td>Donnez ou échangez vos doubles en priorité aux membres proches de terminer leur Ocre.</td>
        </tr>
        <tr>
            <td><strong>Inventaire Global de Guilde</strong></td>
            <td>Vision macro de toutes les âmes détenues au sein de la communauté.</td>
            <td>Permet aux officiers d'organiser des sessions d'échanges massives en canal vocal.</td>
        </tr>
    </tbody>
</table>

<div class="callout callout-important">
<strong>Règle d'Entraide de Guilde</strong>
La revente d'archimonstres capturés en guilde à l'hôtel des ventes est vivement déconseillée tant qu'un compagnon en a besoin pour sa propre quête.
</div>
        `
    },
    {
        slug: 'ladder',
        title: 'Ladders & Classements de Guilde',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Tableau d'Honneur de la Guilde</h2>
<p>Le module <strong>Ladder</strong> centralise les performances individuelles et collectives de vos membres, synchronisées régulièrement avec les serveurs officiels d'Ankama.</p>

<h2>1. Les 4 Classements Principaux</h2>
<ul>
    <li><strong>🏆 Points de Succès :</strong> Classement des joueurs selon le total de points de succès débloqués en jeu (quêtes, donjons, monstres, exploration).</li>
    <li><strong>⚡ Niveau & Expérience :</strong> Suivi de la montée en niveau des membres et des personnages secondaires (mules).</li>
    <li><strong>💎 Points de Contribution SigilOS :</strong> Classement basé sur l'investissement communautaire (aide aux donjons, validation de missions, participation aux events).</li>
    <li><strong>⚔️ Ladder par Classe :</strong> Découvrez qui est le meilleur Iop, Eniripsa, Elio ou Crâ de la guilde.</li>
</ul>

<h2>2. Synchronisation avec Ankama</h2>
<p>Le robot SigilOS interroge le Ladder officiel pour actualiser automatiquement :</p>
<ul>
    <li>Le niveau réel de vos personnages</li>
    <li>Votre classe actuelle (y compris après un reroll)</li>
    <li>Votre illustration de personnage officielle</li>
</ul>
        `
    },
    {
        slug: 'succes',
        title: 'Succès Donjons & Recherche de Groupes',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Chasse aux Succès & Formation d'Équipes</h2>
<p>Réaliser tous les succès de donjons (Zombie, Blitzkrieg, Statue, Collant, Premier, Dernier, Duo) est indispensable pour débloquer les Dofus et les ornements prestigieux. Ce module élimine les heures passées en canal recrutement à chercher des partenaires.</p>

<h2>1. Checklist Personnelle des Succès</h2>
<p>Chaque membre dispose d'une matrice complète des donjons Dofus classés par tranche de niveau :</p>
<ul>
    <li>Niveau 1 à 50 (Incarnam, Pandawa, Craqueleur...)</li>
    <li>Niveau 51 à 100 (Wabbit, Dragon Cochon, Rat Blanc...)</li>
    <li>Niveau 101 à 150 (Chêne Mou, Mansot Royal, Fraktale...)</li>
    <li>Niveau 151 à 190 (Nileza, Klime, Sylargh, Missiz Frizz...)</li>
    <li>Niveau 190 à 200 THL (Comte Harebourg, Reine des Voleurs, Tal Kasha, Guerre, Servitude...)</li>
</ul>

<h2>2. L'Outil "WhoHasWhat" (Qui a besoin de quoi)</h2>
<p>Cliquez sur un succès spécifique (ex : <em>Servitude - Spécial</em>) :</p>
<ol>
    <li>SigilOS liste instantanément tous les membres de la guilde qui recherchent ce succès précis.</li>
    <li>Vous visualisez les classes disponibles pour composer un groupe équilibré (Passeur, Placeur, Soin, Érosion).</li>
    <li>Un bouton vous permet d'ouvrir une discussion privée Discord pour fixer l'heure du combat.</li>
</ol>

<h2>3. Les vues du module</h2>
<p>Le module s'ouvre sur un menu en quatre blocs : <strong>Mes Succès</strong>, <strong>Succès Commun</strong>, <strong>Fiches</strong> et <strong>Défi</strong>.</p>
<ul>
    <li><strong>Mes Succès :</strong> ta checklist par donjon — recherche, filtre « à faire / finis », tranche de niveau, et une bascule unique pour valider ou décocher toute la tranche.</li>
    <li><strong>Succès Commun :</strong> l'annuaire « qui a quoi », donjon par donjon.</li>
    <li><strong>Fiches :</strong> boss, anomalies, avis de recherche et titans — quatre sous-vues derrière un seul bloc. Chaque fiche boss s'ouvre sur une section <strong>encyclopédie</strong> (race, zone, rangs, caractéristiques par grade, résistances et propriétés, siphonnées de DofusDB), suivie des onglets sorts (mécaniques clés + détail en un seul onglet), simulation, butin et monstres de la salle. Chaque fiche boss ou titan porte aussi un onglet <strong>Quêtes</strong> avec les quêtes du donjon, le guide Dofus et la progression de guilde.</li>
    <li><strong>Défi :</strong> les événements et défis one-shot.</li>
</ul>
<p>Les coches groupées — un donjon entier ou une tranche de niveau — tiennent dans un seul bouton : il valide ce qui reste à faire, puis propose de décocher une fois que tout est validé.</p>
        `
    },
    {
        slug: 'songes',
        title: 'Songes Infinis & Partage de Runs',
        category: 'Progression & Objectifs',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Ta première run en 5 minutes</h2>
<p>Le module <strong>Songes Infinis</strong> sert à monter une équipe de 4 et à suivre la run étage par étage, jusqu'au Combat Final. Voilà le parcours complet :</p>
<ol>
    <li>Va sur la page <strong>Songes Infinis</strong> du dashboard.</li>
    <li>Clique sur <strong>Créer une Run</strong> et règle ta run.</li>
    <li>Recrute ton équipe : les membres <strong>postulent</strong>, tu <strong>acceptes</strong>.</li>
    <li>Fais avancer les <strong>étages</strong> au fil de la soirée.</li>
    <li><strong>Termine la run</strong> et distribue les points de contribution.</li>
</ol>

<div class="callout callout-info">
<strong>Ce que le module ne fait pas</strong>
<p>SigilOS ne distribue pas de butin : les gains se partagent en jeu, comme d'habitude.</p>
</div>

<h2>Étape 1 — Va sur la page Songes Infinis</h2>
<p>Ouvre le dashboard de ta guilde et choisis <strong>Songes Infinis</strong> dans la barre latérale, section Progression. En haut de la page, tu trouves :</p>
<ul>
    <li><strong>Guide des Boss :</strong> les fiches des 144 boss, à consulter avant de partir.</li>
    <li><strong>Créer une Run :</strong> le bouton pour lancer ta propre expédition.</li>
    <li><strong>Le tableau des runs :</strong> une carte par run active — difficulté, étage en cours, membres inscrits, statut de recrutement. Clique sur une carte pour ouvrir sa fiche complète.</li>
</ul>
<p>Un bouton permet aussi de <strong>revoir la visite guidée</strong> de la page à tout moment.</p>

<h2>Étape 2 — Clique sur Créer une Run</h2>
<p>La création se fait en deux écrans. Remplis les zones numérotées, puis clique sur <strong>Suivant</strong> :</p>

<figure class="my-6">
    <img src="/assets/docs/songes-creation.svg" alt="Écran de création d'une run, zones à remplir numérotées" class="rounded-2xl border border-white/10 shadow-2xl w-full" />
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">L'écran de création : 1 mode, 2 difficulté, 3 objectifs, 4 ta classe, 5 date — puis Suivant.</figcaption>
</figure>

<ul>
    <li><strong>1 — Le mode :</strong> <strong>Run Standard</strong> pour farmer (tu choisis tout), <strong>Épreuve de Songe</strong> pour viser un succès précis — FONSOCAC, REVERSED, NILEZAFF ou SINJSONJ, avec la difficulté imposée par l'épreuve.</li>
    <li><strong>2 — La difficulté :</strong> 10 niveaux, de Rêve I à Cauchemar III. Plus c'est haut, plus le bonus d'XP et de butin grimpe.</li>
    <li><strong>3 — Les objectifs :</strong> coche au moins un objectif. <strong>Mission de Guilde</strong> et <strong>Quête</strong> sont ouverts dès le Rêve I ; <strong>Farm Légendes</strong> et <strong>Succès No Achat</strong> demandent Paradoxe ou Cauchemar (le cadenas te le dit).</li>
    <li><strong>4 — Ta classe :</strong> clique l'icône de ton personnage — principal ou mule — pour que l'équipe sache avec quoi tu viens.</li>
    <li><strong>5 — La date :</strong> laisse l'interrupteur coupé si c'est « quand on est prêts » : la run affiche <strong>Sans date pour l'instant</strong>. Si tu planifies, la run apparaît dans le calendrier et tout le monde reçoit un rappel 1 h avant.</li>
</ul>
<p>Deuxième écran : choisis si la run est <strong>publiée sur Discord</strong>, puis clique sur <strong>Confirmer et Lancer</strong>. Ta run apparaît aussitôt dans le tableau.</p>

<div class="callout callout-tip">
<strong>Pas de butin ni d'expérience en Épreuve</strong>
<p>Les Épreuves ne rapportent que le succès : choisis le mode Standard pour farmer.</p>
</div>

<h3>Les 10 difficultés en détail</h3>
<ul>
    <li>🟢 <strong>Rêve I, II, III</strong> — bonus de +50, +75 et +100 %, 2 vagues par salle.</li>
    <li>🟡 <strong>Paradoxe I, II, III, IV</strong> — bonus de +120 à +190 %, 3 vagues par salle.</li>
    <li>🔴 <strong>Cauchemar I, II, III</strong> — bonus de +220 à +300 %, 4 vagues par salle.</li>
</ul>

<h2>Étape 3 — Recrute ton équipe</h2>
<p>Les autres membres voient ta carte dans le tableau et cliquent sur <strong>Postuler</strong>. Ils choisissent leur classe dans le menu <strong>Choisir ma classe</strong> — et peuvent en changer après coup sans annuler leur candidature.</p>
<ul>
    <li>Ouvre la fiche de ta run et va dans l'onglet <strong>Candidatures</strong> : <strong>accepte</strong> ou <strong>refuse</strong> chaque postulant. Le joueur est notifié dans les deux cas.</li>
    <li>Équipe complète (4 sur 4) ? Les retardataires passent en <strong>file d'attente</strong> et sont promus automatiquement dès qu'une place se libère.</li>
    <li>Un membre peut <strong>Quitter</strong> à tout moment. Mais si c'est le meneur qui part, la run est <strong>abandonnée</strong>.</li>
</ul>

<div class="callout callout-info">
<strong>Candidature sans réponse</strong>
<p>Sans réponse du meneur sous 24 h, la candidature expire automatiquement.</p>
</div>

<h2>Étape 4 — Fais avancer les étages</h2>
<p>Pendant la soirée, le meneur ouvre <strong>Progression du Rêve</strong> depuis la fiche de la run et clique sur l'étage atteint. La montée traverse 5 paliers, du plus doux au plus brutal :</p>

<figure class="my-6">
    <img src="/assets/docs/songes-paliers.svg" alt="Les cinq paliers des Songes, étages 1 à 26" class="rounded-2xl border border-white/10 shadow-2xl w-full" />
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Les 5 paliers et leurs étages. Les jalons garantissent une fontaine à chaque entrée de palier.</figcaption>
</figure>

<ul>
    <li><strong>Les Pensées oniriques</strong> (étages 1 à 3), <strong>les Balades fantastiques</strong> (4 à 9), <strong>les Espaces imaginaires</strong> (10 à 15), <strong>les Concepts brumeux</strong> (16 à 21), <strong>les Abstractions chimériques</strong> (22 à 26, puis Combat Final).</li>
    <li><strong>Jalons 4, 10, 16 et 22 :</strong> fontaine garantie, c'est la porte d'entrée de chaque palier.</li>
    <li><strong>Types de salle :</strong> Combat, Fontaine, Faveur ou Boss.</li>
    <li><strong>Points de Rêve :</strong> chaque étage en rapporte, et les bonus ramassés sont notés par rareté — Communs, Rares, Épiques, Légendaires.</li>
</ul>

<h2>Étape 5 — Termine et distribue les points</h2>
<p>La run est finie ? Clique sur <strong>Terminer la Run</strong>, puis <strong>Confirmer et Distribuer</strong> :</p>
<ul>
    <li>Barème : <strong>Rêve = 1 point</strong>, <strong>Paradoxe = 2 points</strong>, <strong>Cauchemar = 3 points</strong> de contribution guilde.</li>
    <li>Coche les membres ayant <strong>réellement participé</strong> — un remplaçant peut être ajouté à la main — et ne te donne aucun point à toi-même.</li>
    <li>La run passe en <strong>Terminée</strong> et le message Discord est supprimé.</li>
</ul>

<h2>Pendant ce temps, sur Discord</h2>
<p>Si la run est publiée, le salon reçoit ce message — difficulté, meneur, <strong>places (x sur 4)</strong>, date, objectifs, équipe avec les icônes de classes et file d'attente :</p>

<figure class="my-6">
    <img src="/assets/docs/songes-discord-embed.svg" alt="Exemple de message Discord d'une run Songes" class="rounded-2xl border border-white/10 shadow-2xl w-full" />
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Exemple de run Rêve III : 3 places prises, 1 joueur en file d'attente, boutons Postuler et Quitter.</figcaption>
</figure>

<ul>
    <li>Boutons <strong>Postuler</strong> et <strong>Quitter</strong> plus menu de classe : tout se fait sans passer par le site.</li>
    <li>En salon forum, le sujet reçoit automatiquement le <strong>tag du palier</strong>.</li>
    <li><strong>Rappel 1 h avant</strong> pour les runs datées. Le meneur peut aussi toucher la cloche <strong>Envoyer un rappel aux membres</strong> : seuls les absents du vocal sont pingés.</li>
</ul>

<h2>Le Guide des Boss</h2>
<p>Avant de partir, clique sur <strong>Guide des Boss</strong> : les fiches des <strong>144 boss</strong> (données Songes pour les Noobs, par Volcasaurus) avec recherche par nom, note de difficulté, barres Focus, Esquive et Tank, onglets Informations, Mécaniques et Conseils. La <strong>version courte</strong> se lit entre deux salles, et le <strong>boss aléatoire</strong> donne des idées.</p>

<h2>Si ça coince</h2>
<ul>
    <li><strong>Pas de bouton Créer une Run ?</strong> Il faut la permission du module : demande à un officier de la guilde.</li>
    <li><strong>« Vous avez déjà une run active » ?</strong> Termine ou abandonne ta run en cours avant d'en relancer une — un meneur, une run.</li>
    <li><strong>« Trop de runs créées » ?</strong> C'est l'anti-spam : 3 créations maximum toutes les 10 minutes, patiente un peu.</li>
    <li><strong>Candidature restée sans réponse ?</strong> Elle expire au bout de 24 h, tu pourras repostuler.</li>
    <li><strong>Un avertissement Discord à la création ?</strong> Ta run est bien créée : c'est juste la publication sur Discord qui n'est pas partie (salon non configuré ou bot sans accès). Préviens un officier.</li>
</ul>
        `
    },

    // =========================================================================
    // 🛠️ OUTILS & SERVICES
    // =========================================================================
    {
        slug: 'marche',
        title: 'Marché de Guilde — Annonces FM & Lots de Ressources',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Marché de guilde : annonces d'équipements et de lots de ressources</h2>
<p>Le module <strong>Marché</strong> remplace les messages éparpillés dans Discord par un catalogue d'annonces structuré, réservé aux membres de la guilde. Chaque annonce porte un objet du catalogue Dofus (ou un lot de ressources), un prix en kamas, un statut et un vendeur identifié.</p>

<div class="callout callout-important">
<strong>L'échange se conclut en jeu</strong>
SigilOS publie, affiche et suit les annonces — mais <strong>n'effectue jamais</strong> le transfert d'objets ni celui des kamas, et <strong>ne garantit pas</strong> la transaction. L'échange se conclut <strong>en jeu</strong> : la fiche SigilOS (bouton « Voir sur SigilOS ») reste la seule passerelle vers le vendeur.
</div>

<h2>1. Consulter le catalogue</h2>
<ol class="steps">
    <li><strong>Ouvre le Marché</strong> depuis la barre latérale (menu Outils) ou depuis le dashboard.</li>
    <li><strong>Filtre</strong> : recherche par objet ou vendeur, type (équipement / ressources), statut, tri par prix ou par niveau.</li>
    <li><strong>Choisis ta vue</strong> : « Cartes » pour la lecture visuelle, « Tableau » pour comparer rapidement les prix.</li>
    <li><strong>Ouvre la fiche</strong> d'une annonce pour voir le détail du lot, le jet déclaré et les conditions.</li>
</ol>

<div class="callout callout-tip">
<strong>Astuce</strong>
Le bouton « Masquer vendues / expirées » garde le catalogue lisible : décoche-le uniquement pour comparer les prix passés.
</div>

<h2>2. Publier une annonce</h2>
<p>L'assistant de création commence par la <strong>nature</strong> de l'annonce. Trois familles, et rien d'autre :</p>
<table>
    <thead><tr><th>Famille</th><th>Ce qu'elle contient</th><th>Modifiable ?</th></tr></thead>
    <tbody>
        <tr><td><strong>Équipements</strong></td><td>Coiffe, cape, ceinture, amulette, anneau, bouclier, armes (outils, pioches, faux et armes magiques inclus), bottes, familier / montilier / dragodinde / muldo / volkorne, compagnon, Dofus / Trophée / Prysmaradite, équipement de percepteur.</td><td>Oui pour la plupart — voir l'encadré ci-dessous.</td></tr>
        <tr><td><strong>Cosmétique</strong></td><td>Apparats, costumes, épaulières, ailes.</td><td>Non — vente brute.</td></tr>
        <tr><td><strong>Ressources / Autres</strong></td><td>Tout le reste : ressources, consommables, runes, ingrédients, certificats…</td><td>Non — mais le <strong>lot à quantité libre</strong> est disponible (ex. ×1 à ×500).</td></tr>
    </tbody>
</table>
<div class="callout callout-important">
<strong>Objets vendus brut</strong>
Les <strong>compagnons</strong>, <strong>Dofus</strong>, <strong>Trophées</strong>, <strong>Prysmaradites</strong>, l'<strong>équipement de percepteur</strong> et tout le <strong>cosmétique</strong> se vendent tels quels : SigilOS masque l'éditeur de jet et le bloc Forge, et le serveur refuse toute déclaration de statistique ou de forgemagie sur ces objets. Les <strong>familiers</strong> et <strong>montiliers</strong> gardent leurs statistiques modifiables (ils peuvent être <strong>légendaires</strong>) ; les <strong>dragodindes</strong>, <strong>muldos</strong> et <strong>volkornes</strong> aussi, mais sans mention « légendaire ».
</div>
<p>La création se fait en <strong>4 étapes</strong> :</p>
<ol class="steps">
    <li><strong>Nature</strong> : équipement forgemagie ou lot de ressources.</li>
    <li><strong>Objet & jet</strong> : recherche l'objet dans le catalogue (famille, type, niveau, nom) — les <strong>plages natives</strong> se pré-remplissent automatiquement et l'<strong>éditeur de jet</strong> s'ouvre.</li>
    <li><strong>Prix & conditions</strong> : titre, description, prix en kamas, prix négociable, <strong>troc accepté</strong> — une annonce « kamas uniquement » refuse une offre sans kamas — et « Modifié par ».</li>
    <li><strong>Publication Discord</strong> : aperçu fidèle de l'annonce, choix des rôles à mentionner (parmi ceux autorisés par l'admin), puis publication.</li>
</ol>
<p>Tu peux enregistrer en <strong>brouillon</strong> (rien n'est publié) puis publier plus tard depuis <em>Mon espace</em>.</p>

<h3>L'éditeur de jet</h3>
<p>Sur un équipement, chaque ligne native est pré-remplie avec sa <strong>plage</strong> (ex. <code>251 à 300</code>) et affichée avec l'<strong>icône officielle de la statistique</strong> (plus de libellé ambigu ni de signe inversé). Tu saisis la valeur réelle et l'état se met à jour en direct : <strong>✦ Jet parfait</strong> remplit toutes les lignes au maximum, les boutons <strong>Exo PA / PM / PO / Invocation</strong> ajoutent un effet exotique en un clic, et une <strong>ligne libre</strong> couvre le mode avancé. Les plages natives viennent <strong>toujours du catalogue</strong> : c'est le serveur qui les recalcule, jamais le navigateur.</p>

<h3>La forge réelle (Transcendance, élément, arme de chasse)</h3>
<p>Un objet forgemagie ne se résume pas à son jet : le module permet de <strong>déclarer la forge réellement appliquée</strong>, et cette déclaration se retrouve ensuite dans l'annonce et dans l'embed Discord.</p>
<table>
    <thead><tr><th>Déclaration</th><th>Effet</th></tr></thead>
    <tbody>
        <tr><td><strong>Rune de Transcendance</strong></td><td>L'objet est transcendant : plus aucune forgemagie future n'est possible. Cette déclaration <strong>exclut tout over et tout exo</strong> (c'est le seul refus du module).</td></tr>
        <tr><td><strong>Élément de frappe + potion</strong></td><td>Réservé aux <strong>armes</strong> : élément (Feu, Eau, Terre, Air) et palier de potion. Le palier est borné aux valeurs de jeu réellement siphonnées.</td></tr>
        <tr><td><strong>Arme de chasse</strong></td><td>Réservé aux <strong>armes</strong> : libellé déclaré de l'arme de chasse.</td></tr>
        <tr><td><strong>Troc accepté / Kamas uniquement</strong></td><td>Ce que tu choisis apparaît noir sur blanc dans l'annonce : une annonce « kamas uniquement » refuse explicitement une offre sans kamas, au dépôt comme en contre-offre.</td></tr>
    </tbody>
</table>
<p>Ces règles sont vérifiées <strong>côté serveur</strong> à chaque création et modification : l'interface les annonce, mais c'est le serveur qui les applique.</p>

<div class="callout callout-tip">
<strong>Discord : filtre par tag</strong>
Si le salon du marché est un <strong>forum</strong>, chaque annonce reçoit un tag de <em>famille</em> et un tag de <em>statut</em> : dans Discord, clique un tag pour ne voir que les annonces qui t'intéressent (par exemple « Équipement » + « Disponible »).
</div>

<h3>Les lots de ressources</h3>
<table>
    <thead><tr><th>Type de lot</th><th>Contenu</th><th>Usage typique</th></tr></thead>
    <tbody>
        <tr><td><strong>Lot simple</strong></td><td>1 ressource + quantité (ex. 1 000 Bois de Frêne)</td><td>Vendre une récolte complète</td></tr>
        <tr><td><strong>Lot composite</strong></td><td>N ressources (ex. Pack craft Coiffe = 120 Bois + 40 Cuivre + 12 Plumes)</td><td>Vendre un « pack » prêt à crafter</td></tr>
    </tbody>
</table>
<p>La <strong>quantité minimale</strong> (facultative) permet d'accepter un achat partiel tout en garantissant un volume plancher.</p>

<h3>Le lot multiple (2 à 5 objets)</h3>
<p>Le <strong>lot multiple</strong> vend ensemble 2 à 5 objets différents (familles mélangées, ex. une cape + de l'eau potable), chacun avec <strong>son propre prix</strong>. Chaque objet se réserve séparément à son prix et reçoit <strong>son propre message Discord</strong> (un par objet, chacun avec ses boutons Réserver / Faire une offre).</p>
<p>Si un objet du lot est un <strong>équipement modifiable</strong>, un <strong>éditeur de jet</strong> s'ouvre sous sa ligne (les autres objets se vendent bruts, sans jet). Son message Discord affiche alors la <strong>carte des stats</strong> comme une annonce simple, et elle est <strong>régénérée à chaque modification du jet</strong>. La fiche du lot affiche le <strong>prix total</strong> (somme des objets) et le jet de chaque équipement ; modifier le lot <strong>conserve</strong> les réservations et les messages des objets qui restent.</p>

<h2>3. Le cycle de vie d'une annonce</h2>
<table>
    <thead><tr><th>Statut</th><th>Signification</th></tr></thead>
    <tbody>
        <tr><td><strong>Brouillon</strong></td><td>Créée mais non publiée — visible uniquement par toi.</td></tr>
        <tr><td><strong>Disponible</strong></td><td>Publiée, visible par la guilde.</td></tr>
        <tr><td><strong>Réservé</strong></td><td>Quelqu'un a réservé l'annonce ou une offre a été acceptée : l'annonce est bloquée pour cet acheteur jusqu'à l'échéance de la réservation.</td></tr>
        <tr><td><strong>Vendu</strong></td><td>Transaction confirmée par le vendeur (état terminal).</td></tr>
        <tr><td><strong>Expiré</strong></td><td>Échéance dépassée — l'annonce sort du catalogue actif mais reste dans tes archives.</td></tr>
        <tr><td><strong>Retiré</strong></td><td>Retirée par le vendeur ou la modération.</td></tr>
    </tbody>
</table>
<p>Un cycle de rappels est appliqué automatiquement (par défaut à <strong>J+7</strong> et <strong>J+15</strong>) et l'annonce cesse d'être active à l'échéance maximale (par défaut <strong>J+20</strong>). Une annonce expirée peut être <strong>renouvelée une seule fois</strong>.</p>

<div class="callout callout-info">
<strong>Mon espace</strong>
L'onglet <em>Mon espace</em> regroupe tes annonces <strong>en cours</strong> et tes <strong>archives</strong>, avec les actions : publier, retirer, renouveler, supprimer. Tu y retrouves aussi les <strong>réservations</strong> reçues et le <strong>centre de négociation</strong> (offres reçues et envoyées) : accepter une offre réserve l'annonce, expire automatiquement les autres offres en attente, et le montant proposé reste <strong>privé</strong> (jamais publié dans Discord).
</div>

<h2>4. Comprendre un jet forgemagie</h2>
<p>Le module étiquette chaque valeur déclarée par rapport à la plage native de l'objet :</p>
<table>
    <thead><tr><th>Étiquette</th><th>Signification</th></tr></thead>
    <tbody>
        <tr><td><strong>Parfait</strong></td><td>Valeur égale au maximum natif.</td></tr>
        <tr><td><strong>Bon</strong></td><td>Dans la plage, au-dessus de la moyenne.</td></tr>
        <tr><td><strong>Normal</strong></td><td>Dans la plage.</td></tr>
        <tr><td><strong>Sous la plage</strong></td><td>Valeur inférieure au minimum natif.</td></tr>
        <tr><td><strong>Over</strong></td><td>Valeur supérieure au maximum natif (légitime et recherché).</td></tr>
        <tr><td><strong>Exotique</strong></td><td>Effet absent des natifs (ex. PA/PM/PO) — affiché en violet.</td></tr>
    </tbody>
</table>

<div class="callout callout-important">
<strong>Un over ou un exo n'est jamais refusé</strong>
C'est la valeur du marché FM. SigilOS ne peut pas lire ton inventaire : il étiquette la valeur, il ne la juge pas. Seules les <strong>fautes de frappe manifestes</strong> (bornes anti-débilité) sont bloquées à la saisie.
</div>

<h2>5. La carte d'item et les prix</h2>
<p>Chaque annonce affiche une <strong>carte d'item</strong> calquée sur l'affichage du jeu : nom, niveau et type, <strong>panoplie</strong>, image, lignes d'effets (valeur colorée selon l'état), « Modifié par », puis en pied le <strong>poids</strong> et le <strong>prix moyen de la guilde</strong> pour ce même objet. La même carte est générée en image PNG pour le message Discord.</p>

<h2>6. Publication Discord</h2>
<p>À la publication, SigilOS envoie l'annonce dans le <strong>salon configuré</strong> par l'admin (salon texte <strong>ou</strong> forum). Un <strong>seul message</strong> par annonce est maintenu à jour à chaque changement de statut (jamais de repost).</p>
<ul>
    <li>L'embed affiche le vendeur, le prix, le statut, la négociabilité et le <strong>nombre</strong> d'offres — <strong>jamais</strong> leur montant.</li>
    <li>Le créateur choisit les rôles à mentionner, limités à ceux que l'admin a marqués comme « pinguables ».</li>
    <li>Si Discord échoue, l'annonce reste publiée sur SigilOS ; la synchronisation est rejouée automatiquement (et manuellement par un modérateur).</li>
</ul>
<p>Si aucun salon n'est configuré, l'annonce est publiée <strong>sans Discord</strong> (aucune erreur).</p>

<h2>7. Permissions</h2>
<table>
    <thead><tr><th>Permission</th><th>Ce qu'elle permet</th></tr></thead>
    <tbody>
        <tr><td><code>market:trade</code></td><td>Voir le catalogue, publier ses annonces et interagir (réserver, négocier).</td></tr>
        <tr><td><code>market:moderate</code></td><td>Retirer ou restaurer une annonce, traiter les signalements et clôturer les dossiers.</td></tr>
    </tbody>
</table>
<p>Le module doit également être <strong>activé</strong> par un administrateur (Pilotage → Gestion des Modules).</p>

<h2>8. Questions fréquentes</h2>
<h3>Le prix est-il garanti ?</h3>
<p>Non : SigilOS n'est pas un hôtel de vente. Le prix est celui déclaré par le vendeur ; l'échange se conclut en jeu.</p>
<h3>Pourquoi mon annonce a-t-elle disparu du catalogue ?</h3>
<p>Elle est probablement <strong>expirée</strong> ou <strong>vendue</strong>. Décoche « Masquer vendues / expirées » ou ouvre <em>Mon espace</em>.</p>
<h3>Puis-je vendre plusieurs objets d'un coup ?</h3>
<p>Oui, sous forme de <strong>lot composite</strong> (jusqu'à 20 ressources).</p>
<h3>Les liens dans ma description s'affichent-ils ?</h3>
<p>Non : les liens et invitations sont automatiquement retirés (anti-phishing).</p>
`,
    },
    {
        slug: 'donjons-et-quetes',
        title: 'Donjons & Quêtes (Entraide LFG)',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Système d'Entraide Communautaire (LFG)</h2>
<p>Besoin de bras pour passer un donjon difficile, débloquer un combat de quête complexe ou valider une quête d'alignement ? Le module <strong>Donjons & Quêtes</strong> remplace les pings anarchiques sur Discord par un babillard d'annonces propre et interactif.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Module LFG : publication d'annonces d'aide, choix du donjon et inscription en 1 clic.</figcaption>
</figure>

<h2>1. Créer une Demande d'Entraide</h2>
<ol>
    <li><strong>Choisir l'Activité :</strong> Sélectionnez le boss de donjon, le combat de quête ou l'activité visée.</li>
    <li><strong>Définir les Horaires :</strong> Précisez si vous cherchez du monde pour <em>"Maintenant"</em>, <em>"Ce soir à 21h"</em> ou <em>"Ce weekend"</em>.</li>
    <li><strong>Nombre de Places :</strong> Indiquez le nombre de compagnons recherchés (de 1 à 7 joueurs).</li>
</ol>

<h2>2. Rejoindre un Groupe</h2>
<p>Les autres membres voient l'annonce sur leur Dashboard. Un simple clic sur <em>"Je viens aider"</em> réserve le slot et avertit le créateur du post.</p>

<h2>3. Filtrer le Babillard</h2>
<ul>
    <li><strong>Type d'activité :</strong> les segments <em>Tout</em>, <em>Donjons</em>, <em>Quêtes</em>, <em>Défi</em> et <em>Titans</em> affichent le nombre d'annonces disponibles <strong>avant</strong> le clic.</li>
    <li><strong>Recherche :</strong> la touche <kbd>/</kbd> place le curseur dans le champ « Rechercher un donjon, boss, quête… » ; la recherche couvre le donjon, son boss et le nom de la quête.</li>
    <li><strong>Palier de niveau :</strong> 1-100, 100-140, 140-200 ou 200+ pour ne voir que les annonces à votre portée.</li>
    <li><strong>Filtres rapides :</strong> « Places dispo » (il reste au moins un slot), « Avec succès » (succès de donjon visé) et « Posts fermés ».</li>
</ul>

<h2>4. Pseudo, classe et chuchotement</h2>
<p>Dans une annonce comme dans les rosters (Donjons &amp; Quêtes, Songes Infinis, Calendrier et Raids), chaque joueur inscrit apparaît avec l'<strong>icône de sa classe Dofus</strong> devant son pseudo, et une petite icône de copie juste après. Un clic copie <code>/w Pseudo</code> pour ce joueur uniquement : il ne reste plus qu'à coller la commande dans Discord.</p>
<div class="callout callout-tip">
<strong>💡 Astuce clé</strong>
La copie est <em>unitaire</em> : plus de bouton qui copiait toute la liste d'un coup (on collait huit lignes dans Discord au lieu d'un seul chuchotement). Si un joueur n'a pas renseigné sa classe dans son profil, seule l'icône manque — le pseudo et la copie restent disponibles.
</div>

<h2>5. Bouton d'inscription et menu de classe (embed Discord)</h2>
<p>Chaque annonce publiée porte un bouton <em>« S'inscrire »</em> qui ouvre une <strong>modale</strong> : la classe Dofus (facultative) et un message y sont saisis <strong>en une seule fois</strong>, l'inscription partant directement avec sa classe. Le menu <em>« Choisir ma classe »</em> placé sous les boutons sert à s'inscrire en un clic avec une classe, ou à corriger la sienne sans annuler son inscription. L'embed regroupe alors les participants dans un champ par classe représentée, et le compteur de places suit chaque inscription : le créateur lit la composition du groupe d'un coup d'œil.</p>

<h2>6. Rappel automatique avant un raid</h2>
<p>Chaque raid publié déclenche <strong>un rappel automatique</strong> dans son salon Discord <strong>1 h avant le départ</strong> (délai réglable par événement, 60 min par défaut). Ce rappel <strong>notifie uniquement les membres inscrits</strong> : le message ne mentionne que les joueurs du roster — les rôles mentionnés à la publication de l'embed ne sont <em>pas</em> re-pingés, et la file d'attente n'est pas notifiée. Un rappel manuel reste possible depuis le dashboard : dans ce cas, le rappel automatique se tait pendant 30 minutes, pour ne jamais pinguer deux fois.</p>

<h2>7. Récompense en Points de Contribution</h2>
<p>Lorsque le combat est terminé, le créateur clôture le post en cliquant sur <em>"Objectif Réussi"</em> :</p>
<ul>
    <li>Chaque membre ayant apporté son aide reçoit automatiquement des <strong>Points de Contribution</strong> sur son profil de guilde.</li>
    <li>Les points peuvent ensuite être dépensés dans la <strong>Boutique de Guilde</strong>.</li>
</ul>
        `
    },
    {
        slug: 'galerie-stuff',
        title: 'Galerie d\'Équipements & Fiches Stuff',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>La Bibliothèque de Builds de Guilde</h2>
<p>Partagez vos meilleures panoplies, vos optimisations exotiques et vos équipements spécialisés pour guider les recrues et échanger sur les théories d'optimisation Dofus.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Fiches de builds : prévisualisation automatique des caractéristiques et orientation de jeu.</figcaption>
</figure>

<h2>1. Publier un Équipement</h2>
<p>Collez simplement le lien de votre équipement depuis <strong>DofusBook</strong> ou <strong>DofusDB</strong> :</p>
<ul>
    <li>Le nom du build, l'icône de classe et le niveau sont extraits automatiquement.</li>
    <li>Choisissez l'orientation : <em>PvM</em>, <em>PvP / Kolizéum</em>, <em>Songes Infinis</em> ou <em>Farming</em>.</li>
    <li>Précisez les éléments dominants (Terre, Feu, Eau, Air, Multi-Éléments, Do Pou, Retrait PM...).</li>
</ul>

<h2>2. Votes & Recommandations</h2>
<p>Les membres de la guilde peuvent voter pour les équipements les plus performants afin de constituer la liste des builds de référence recommandés aux nouveaux arrivants.</p>
        `
    },
    {
        slug: 'services',
        title: 'Services de Guilde & Artisans 200',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>L'Annuaire des Métiers & de Forgemagie</h2>
<p>Trouvez instantanément quel compagnon de guilde possède le métier de craft ou de forgemagie nécessaire pour fabriquer vos panoplies sans payer de frais exorbitants aux ateliers publics.</p>

<h2>1. Métiers Référencés</h2>
<table>
    <thead>
        <tr>
            <th>Catégorie</th>
            <th>Métiers Disponibles</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Artisanat d'Équipement</strong></td>
            <td>Tailleur, Cordonnier, Bijoutier, Forgeron, Sculpteur, Façonneur.</td>
        </tr>
        <tr>
            <td><strong>Forgemagie Spécialisée</strong></td>
            <td>Costumage, Cordomage, Joaillomage, Forgemage, Sculptemage, Façomage.</td>
        </tr>
        <tr>
            <td><strong>Consommables & Récolte</strong></td>
            <td>Alchimiste, Bricoleur, Chasseur, Paysan, Mineur, Bûcheron, Pêcheur.</td>
        </tr>
    </tbody>
</table>

<h2>2. Déclarer ses Métiers Niveau 200</h2>
<p>Sur votre fiche de profil, cochez vos métiers niveau 200 pour apparaître dans l'annuaire des artisans de guilde. Vous pouvez également préciser vos spécialités (ex : <em>"Exo PA / PM garanti avec runes fournies"</em>).</p>
        `
    },
    {
        slug: 'planning',
        title: 'Planning & Gestion des Disponibilités',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Organiser les Soirées de Jeu Sans Prise de Tête</h2>
<p>Le module <strong>Planning & Disponibilités</strong> permet à chaque membre de renseigner ses habitudes de connexion pour que les meneurs et organisateurs sachent quand planifier les sorties de guilde.</p>

<h2>1. Définir ses Créneaux Habituels</h2>
<ul>
    <li><strong>Après-midi (14h - 18h) :</strong> Idéal pour les quêtes solo et le farm de ressources.</li>
    <li><strong>Soirée Prime (20h30 - 23h30) :</strong> Créneau privilégié pour les donjons THL, Raids et Songes.</li>
    <li><strong>Nocturne (23h30+) :</strong> Pour les couche-tard et sessions farm intensives.</li>
    <li><strong>Weekend :</strong> Disponibilités prolongées du samedi et dimanche.</li>
</ul>

<h2>2. Signalement des Vacances & Absences</h2>
<p>Vous partez en vacances ou avez des examens ? Renseignez votre date de départ et de retour sur le planning. Cela empêche le système de relance automatique de vous signaler comme inactif pendant votre absence !</p>
        `
    },
    {
        slug: 'worldmap',
        title: 'Carte Interactive Dofus HD',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>L'Atlas Interactif du Monde des Douze</h2>
<p>Une carte vectorielle fluide en haute définition couvrant l'intégralité des territoires d'Amakna, Frigost, Pandala, Otomaï, Saharach et des Dimensions Divines.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Navigation cartographique : repères de zaaps, bateaux, entrées de donjons et zaapis.</figcaption>
</figure>

<h2>Fonctionnalités Intégrées :</h2>
<ul>
    <li><strong>Localisation des Zaaps :</strong> Trouvez en un clin d'œil le Zaap le plus proche des coordonnées de votre quête.</li>
    <li><strong>Entrées de Donjons :</strong> Visualisez l'emplacement exact des donjons avec leur niveau recommandé.</li>
    <li><strong>Transporteurs & Bateaux :</strong> Repérez les routes maritimes et foreuses pour accéder aux zones isolées.</li>
</ul>
        `
    },
    {
        slug: 'mini-jeux',
        title: 'Mini-Jeux & Blindtest Dofus',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>L'Espace Détente & Animation de Guilde</h2>
<p>SigilOS propose une série de mini-jeux multijoueurs intégrés pour animer vos soirées vocales et tester votre culture du Monde des Douze.</p>

<h3>Jeux Disponibles :</h3>
<ul>
    <li><strong>🎵 Blindtest Musical :</strong> Écoutez un extrait audio officiel de Dofus et devinez la zone, le donjon ou la musique de boss associée.</li>
    <li><strong>📜 Quizz Lore & Histoire :</strong> Questions variées sur l'univers d'Ankama, les dieux, les héros et les anecdotes du jeu.</li>
    <li><strong>🧩 Devinettes d'Objets :</strong> Retrouvez le nom d'un équipement ou d'une ressource à partir de sa description mystérieuse.</li>
</ul>
        `
    },
    {
        slug: 'ressources',
        title: 'Ressources Dofus & Liens Essentiels',
        category: 'Outils & Services',
        accessLevel: 'MEMBER' as any,
        content: `
<h2>Le Répertoire des Outils Communautaires Certifiés</h2>
<p>Accédez en un clic aux meilleurs outils créés par la communauté Dofus pour optimiser votre temps de jeu.</p>

<table>
    <thead>
        <tr>
            <th>Outil</th>
            <th>Type</th>
            <th>Description & Utilité</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>DofusDB</strong></td>
            <td>Encyclopédie</td>
            <td>Base de données ultra-complète sur tous les monstres, items, quêtes, recettes et succès.</td>
        </tr>
        <tr>
            <td><strong>Metamob</strong></td>
            <td>Quête Ocre</td>
            <td>Plateforme d'échange d'archimonstres synchronisée avec SigilOS.</td>
        </tr>
        <tr>
            <td><strong>DofusBook</strong></td>
            <td>Builder de Stuff</td>
            <td>Création et calcul avancé de panoplies et dégâts théoriques.</td>
        </tr>
        <tr>
            <td><strong>Almanax Officiel</strong></td>
            <td>Quotidien</td>
            <td>Offrande du jour, bonus de zone et économies d'ingrédients.</td>
        </tr>
    </tbody>
</table>
        `
    },

    // =========================================================================
    // 👥 COMMUNAUTÉ & GUILDE
    // =========================================================================
    {
        slug: 'introduction',
        title: 'Bienvenue sur SigilOS',
        category: 'Communauté & Guilde',
        accessLevel: 'PUBLIC' as any,
        content: `
<h2>Premier Pas sur SigilOS</h2>
<p>SigilOS est le système d'exploitation conçu pour décharger le staff des tâches répétitives et offrir aux membres une interface moderne, vivante et interactive pour piloter leur aventure Dofus.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Le Cockpit SigilOS : tableau de bord centralisé pour votre guilde Dofus.</figcaption>
</figure>

<h2>1. Connexion & Rapprochement Automatique</h2>
<p>L'authentification s'effectue directement avec votre compte <strong>Discord</strong> :</p>
<ul>
    <li>Aucun mot de passe supplémentaire à retenir.</li>
    <li>Vos rôles Discord (Meneur, Bras Droit, Officier, Membre, Recrue) sont analysés pour vous octroyer immédiatement les bons accès.</li>
</ul>

<h2>2. Les 3 Actions Indispensables à l'Arrivée</h2>
<ol>
    <li><strong>Renseigner son Personnage Principal :</strong> Synchronise votre classe et votre niveau avec le Ladder officiel.</li>
    <li><strong>Déclarer ses Mules :</strong> Permet à vos compagnons de savoir qui joue quel personnage secondaire.</li>
    <li><strong>Lier sa Clé Metamob :</strong> Si la guilde chasse le Dofus Ocre, activez le partage d'archimonstres pour compléter votre quête 5x plus vite.</li>
</ol>
        `
    },

    // =========================================================================
    // 👑 PANNEAU D'ADMINISTRATION (14 GUIDES STAFF & LEADERS)
    // =========================================================================
    {
        slug: 'admin-getting-started',
        title: 'Guide de Démarrage & Onboarding Guilde',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Initialisation & Déploiement d'une Nouvelle Guilde</h2>
<p>Ce guide vous accompagne pas à pas pour déployer SigilOS sur votre serveur Discord communautaire en moins de 10 minutes.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Centre d'administration : configuration globale des modules et liaisons Discord.</figcaption>
</figure>

<h2>Les 5 Étapes de Mise en Service :</h2>
<ol>
    <li><strong>Inviter le Bot Discord :</strong> Assurez-vous que le bot SigilOS possède les permissions de gestion des rôles et des salons sur votre serveur Discord.</li>
    <li><strong>Lier les Salons Système :</strong> Dans <em>Paramètres Généraux</em>, sélectionnez votre salon d'annonces hebdomadaires et votre salon privé réservé au staff.</li>
    <li><strong>Configurer la Matrice RBAC :</strong> Dans <em>Rôles & Permissions</em>, associez vos rôles Discord aux permissions SigilOS.</li>
    <li><strong>Activer vos Modules :</strong> Dans <em>Gestion des Modules</em>, cochez uniquement les outils que votre guilde souhaite utiliser.</li>
    <li><strong>Lancer l'Audit Initial :</strong> Dans <em>Audit & Gestion des Membres</em>, cliquez sur <em>"Synchroniser"</em> pour importer automatiquement votre roster Discord.</li>
</ol>
        `
    },
    {
        slug: 'admin-settings',
        title: 'Paramètres Généraux de Guilde',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Le Centre de Contrôle Technique</h2>
<p>Ce panneau régit toutes les intégrations tierces, les canaux de communication et les paramètres de sécurité de votre guilde.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Paramètres généraux : salons Discord, webhooks et liaisons Metamob.</figcaption>
</figure>

<h2>1. Salons Discord de Notification</h2>
<ul>
    <li><strong>Salon d'Annonces :</strong> Reçoit les embeds de publication des missions hebdomadaires, les annonces d'événements et les clôtures de semaine.</li>
    <li><strong>Salon d'Alertes Staff (Privé) :</strong> Notifie immédiatement les officiers lors des fins de période d'essai (J-3, J-0) ou des signalements.</li>
    <li><strong>Salon des Validations :</strong> Canal où transitent les logs d'approbation et de refus des captures d'écran de missions.</li>
</ul>

<h2>2. Intégration Metamob & Serveur Dofus</h2>
<ul>
    <li><strong>Clé API Metamob de Guilde :</strong> Permet d'alimenter le matching global des archimonstres.</li>
    <li><strong>Serveur Officiel :</strong> Sélectionnez votre serveur de jeu (Imagiro, Orukam, Tal Kasha, Draconiros, etc.) pour calibrer les requêtes Ladder.</li>
</ul>

<figure class="my-6">
    <div class="flex flex-wrap items-center gap-2">
        <img src="/assets/dofus/servers/draconiros.webp" alt="Draconiros" title="Draconiros" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/ombre.webp" alt="Ombre" title="Ombre" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/tal-kasha.webp" alt="Tal Kasha" title="Tal Kasha" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/imagiro.webp" alt="Imagiro" title="Imagiro" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/orukam.webp" alt="Orukam" title="Orukam" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/tylezia.webp" alt="Tylezia" title="Tylezia" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/hell-mina.webp" alt="Hell Mina" title="Hell Mina" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/dakal.webp" alt="Dakal" title="Dakal" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/mikhal.webp" alt="Mikhal" title="Mikhal" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/kourial.webp" alt="Kourial" title="Kourial" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/rafal.webp" alt="Rafal" title="Rafal" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/brial.webp" alt="Brial" title="Brial" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
        <img src="/assets/dofus/servers/salar.webp" alt="Salar" title="Salar" class="w-12 h-12 rounded-[10px] object-cover" loading="lazy" />
    </div>
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Les 13 serveurs Dofus Unity sélectionnables : Épique, Monocompte, Classiques et Pionniers.</figcaption>
</figure>
        `
    },
    {
        slug: 'admin-permissions',
        title: 'Rôles, Permissions & Matrice RBAC',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Contrôle d'Accès Basé sur les Rôles (RBAC)</h2>
<p>SigilOS utilise une matrice granulaire de <strong>20 permissions réelles</strong> réparties sur 6 domaines indépendants pour s'adapter à n'importe quelle hiérarchie de guilde.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Matrice RBAC : attribution des droits par rôle Discord et par membre individuel.</figcaption>
</figure>

<h2>Matrice Complète des Permissions</h2>
<table>
    <thead><tr><th>Domaine</th><th>Permission</th><th>Description & Périmètre</th></tr></thead>
    <tbody>
        <tr><td><strong>Accès</strong></td><td><code>dashboard:login</code></td><td>Socle obligatoire pour accéder au Dashboard.</td></tr>
        <tr><td><strong>Staff</strong></td><td><code>staff:member_mgmt</code></td><td>Gestion du Roster, périodes d'essai J-X, mules et départs.</td></tr>
        <tr><td><strong>Staff</strong></td><td><code>staff:content</code></td><td>Édition de la page de présentation publique et wiki officier.</td></tr>
        <tr><td><strong>Staff</strong></td><td><code>staff:audit</code></td><td>Accès au journal des logs d'audit et historique des actions.</td></tr>
        <tr><td><strong>Staff</strong></td><td><code>staff:reaction_roles</code></td><td>Création et déploiement des panneaux de reaction roles.</td></tr>
        <tr><td><strong>Staff</strong></td><td><code>staff:tickets</code></td><td>Prise en charge et modération des tickets d'assistance.</td></tr>
        <tr><td><strong>Admin</strong></td><td><code>system:config</code></td><td>Modification des paramètres généraux, webhooks et salons.</td></tr>
        <tr><td><strong>Admin</strong></td><td><code>system:rbac</code> ★</td><td>Gestion de la matrice des permissions (anti-escalade).</td></tr>
        <tr><td><strong>Admin</strong></td><td><code>system:god</code> ★</td><td>Bypass absolu de sécurité (propriétaire de guilde).</td></tr>
        <tr><td><strong>Missions</strong></td><td><code>missions:play</code></td><td>Inscription et participation aux missions de guilde.</td></tr>
        <tr><td><strong>Missions</strong></td><td><code>missions:officer</code></td><td>Création, planification et validation des captures OCR.</td></tr>
        <tr><td><strong>Jeu</strong></td><td><code>game:view</code></td><td>Accès à l'Ocre, Ladder, Quêtes, Worldmap et Mini-jeux.</td></tr>
        <tr><td><strong>Jeu</strong></td><td><code>game:operations</code></td><td>Organisation des Songes Infinis et services VIP.</td></tr>
        <tr><td><strong>Jeu</strong></td><td><code>points:manage</code></td><td>Gestion des points de contribution et boutique interne.</td></tr>
        <tr><td><strong>Communauté</strong></td><td><code>community:access</code></td><td>Consultation de l'Annuaire, Calendrier et Sondages.</td></tr>
        <tr><td><strong>Communauté</strong></td><td><code>community:mod</code></td><td>Création et modération des événements du calendrier.</td></tr>
        <tr><td><strong>Jeu</strong></td><td><code>market:trade</code></td><td>Marché : voir le catalogue, publier ses annonces et interagir (réserver, négocier).</td></tr>
        <tr><td><strong>Jeu</strong></td><td><code>market:moderate</code> ★</td><td>Marché : retirer / restaurer une annonce et traiter les signalements.</td></tr>
    </tbody>
</table>

<div class="callout callout-important">
<strong>Protection Anti-Escalade</strong>
Les permissions marquées ★ ne peuvent être attribuées que par un réel Administrateur Discord. Un officier délégué ne peut pas s'auto-attribuer des privilèges supérieurs à son rang.
</div>
        `
    },
    {
        slug: 'admin-marche',
        title: 'Configurer le Marché de guilde',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Réglages → Marché (groupe « Par Module »)</h2>
<p>Avant de communiquer sur le Marché, vérifie la configuration Discord et les plafonds. L'écran se trouve dans <em>Réglages → Marché</em> (visible uniquement si le module est actif).</p>

<h2>1. Activer le module</h2>
<ol class="steps">
    <li>Ouvre <em>Pilotage → Gestion des Modules</em>.</li>
    <li>Active l'interrupteur <strong>Marché</strong>.</li>
    <li>Attribue la permission <code>market:trade</code> aux rôles/membres concernés (et <code>market:moderate</code> aux modérateurs).</li>
</ol>

<h2>2. Salon de publication</h2>
<p>Choisis un salon <strong>textuel, annonces ou forum</strong>. Le bot doit pouvoir le voir et y écrire. Sur un salon <strong>forum</strong>, SigilOS utilise les <strong>tags déjà présents</strong> dans le salon (voir « Tags de forum » ci-dessous) : <strong>aucun tag n'est créé automatiquement</strong> — c'est à toi de les créer dans les réglages du salon Discord.</p>
<div class="callout callout-info">
<strong>Validation serveur</strong>
Le salon est revalidé à chaque sauvegarde et à chaque test : un identifiant fourni par le navigateur n'est jamais utilisé aveuglément.
</div>

<h2>2bis. Tags de forum (salon forum uniquement)</h2>
<p>Un salon forum permet aux membres de <strong>filtrer les annonces depuis Discord</strong>. SigilOS applique aux sujets les tags qui <strong>existent déjà</strong> dans le salon — il n'en crée jamais et n'en modifie jamais la liste :</p>
<ol class="steps">
    <li><strong>Crée les tags dans Discord</strong> (réglages du salon forum), par exemple une famille (<em>Équipement</em>, <em>Ressources</em>) et les statuts (<em>Disponible</em>, <em>Réservé</em>, <em>Vendu</em>…).</li>
    <li><strong>Associe chaque tag</strong> dans <em>Réglages → Marché → Tags de forum</em> : la section n'apparaît que si le salon configuré est un forum avec au moins un tag.</li>
    <li><strong>Enregistre</strong> : à la publication, le sujet reçoit la <strong>famille</strong> et le <strong>statut</strong> ; à chaque changement de statut, l'ancien tag est retiré et le nouveau appliqué.</li>
</ol>
<table>
    <thead><tr><th>Comportement</th><th>Détail</th></tr></thead>
    <tbody>
        <tr><td><strong>Aucun tag appliqué</strong> si…</td><td>le mapping est vide, le salon n'a pas de tag, ou le salon est textuel : la publication reste <strong>normale</strong> (jamais d'erreur).</td></tr>
        <tr><td><strong>Maximum 5 tags</strong> par sujet</td><td>limite Discord : la famille + le statut suffisent largement.</td></tr>
        <tr><td><strong>Tag inconnu</strong></td><td>un tag supprimé du salon côté Discord est <strong>écarté</strong> à l'enregistrement (jamais conservé à l'aveugle).</td></tr>
    </tbody>
</table>

<h2>3. Rôles</h2>
<table>
    <thead><tr><th>Réglage</th><th>Ce qu'il fait</th></tr></thead>
    <tbody>
        <tr><td><strong>Rôles « pinguables »</strong></td><td>Rôles que le créateur peut mentionner lui-même à la publication (vide = aucun ping possible).</td></tr>
    </tbody>
</table>

<div class="callout callout-important">
<strong>Les droits du Marché viennent de la matrice RBAC, pas des rôles Discord</strong>
Publier, réserver, offrir et gérer ses propres annonces demandent la permission <code>market:trade</code> ; la modération du marché demande <code>market:moderate</code>. Un second système de droits « par rôle Discord » (rôle minimum, rôle modérateur) a été <strong>retiré</strong> : il faisait doublon et créait deux vérités.
</div>

<div class="callout callout-tip">
<strong>Ping vérifié côté serveur</strong>
Seuls les rôles listés dans « Rôles pinguables » peuvent être mentionnés à la publication : un identifiant envoyé par le navigateur est revalidé en base avant l'envoi et ignoré s'il n'est pas autorisé.
</div>

<h2>4. Durées, plafonds & rétention</h2>
<p>Ces valeurs sont <strong>globales</strong> : elles sont pilotées depuis <strong>God → Marché</strong> et appliquées à <strong>toutes</strong> les guildes en une fois. Le panneau de guilde ne les édite plus (un doublon de réglage = deux vérités) ; il ne conserve que ce qui est local par nature (salon de publication, rôles pinguables, tags du forum).</p>
<table>
    <thead><tr><th>Réglage</th><th>Défaut</th><th>Rôle</th></tr></thead>
    <tbody>
        <tr><td>Annonces actives / membre</td><td>5</td><td>Anti-abus (plafond par membre).</td></tr>
        <tr><td>Durée par défaut</td><td>7 jours</td><td>Durée proposée à la création.</td></tr>
        <tr><td>Durée de vie maximale</td><td>20 jours</td><td>Échéance absolue de survie d'une annonce.</td></tr>
        <tr><td>Paliers de rappel</td><td>7, 15</td><td>Jours des rappels automatiques (1 à 3 paliers).</td></tr>
        <tr><td>Durée d'une réservation</td><td>12 h</td><td>Délai avant libération automatique.</td></tr>
        <tr><td>Durée de vie d'une offre</td><td>48 h</td><td>Délai avant expiration d'une offre.</td></tr>
        <tr><td>Rétention des médias</td><td>30 jours</td><td>Purge des médias d&apos;annonce (aucun upload n&apos;est ouvert aux membres).</td></tr>
        <tr><td>Rétention des logs</td><td>365 jours</td><td>Conservation du journal d'audit du marché.</td></tr>
    </tbody>
</table>

<h3>Quand un changement de seuil s'applique</h3>
<p>Les valeurs sont écrites <strong>immédiatement</strong> pour <strong>toutes</strong> les guildes (une seule écriture, aucun redémarrage, aucune attente de tâche planifiée), et chaque consommateur les relit en base <strong>au moment où il agit</strong> : la tâche automatique n'a jamais la main sur un seuil.</p>
<table>
    <thead><tr><th>Réglage</th><th>Quand le changement se voit</th></tr></thead>
    <tbody>
        <tr><td>Durée de vie maximale</td><td>Sur les annonces publiées <strong>après</strong> le changement : l'échéance est fixée au moment de la publication, une annonce déjà en ligne garde celle qu'elle a reçue.</td></tr>
        <tr><td>Durée par défaut</td><td>Proposée à la création suivante (aucun effet rétroactif).</td></tr>
        <tr><td>Durée d'une réservation / d'une offre</td><td>Sur les réservations et les offres créées <strong>après</strong> le changement (même logique : l'échéance est calculée à la création).</td></tr>
        <tr><td>Paliers de rappel</td><td>Relus à <strong>chaque passe</strong> (toutes les 10 minutes) — y compris pour les annonces déjà en ligne : un palier raccourci peut envoyer un rappel dès la passe suivante, un palier allongé le reporte.</td></tr>
        <tr><td>Annonces actives / membre</td><td>Contrôlé à chaque publication et à chaque modification : le nouveau plafond s'applique au prochain enregistrement.</td></tr>
        <tr><td>Rétention des médias</td><td>À la passe de purge suivante (quotidienne).</td></tr>
        <tr><td>Rétention du journal</td><td>À la passe de nettoyage des journaux suivante.</td></tr>
        <tr><td>Verrou plateforme</td><td>Tout de suite : le module est désactivé (ou rendu) dans <strong>toutes</strong> les guildes, et chaque bascule de guilde est conservée pour le déverrouillage.</td></tr>
    </tbody>
</table>

<h2>5. Bouton « Tester la configuration »</h2>
<p>Le test vérifie que le salon est joignable, en détecte le type (texte / forum) et liste les points à corriger (salon absent, aucun rôle pinguable…). Aucun test n'est bloquant : le marché reste utilisable depuis le dashboard.</p>

<h2>6. Modération</h2>
<p>Les membres de la permission <code>market:moderate</code> peuvent retirer une annonce et traitent les signalements. Chaque action est journalisée dans le journal d'audit du marché (rétention configurable).</p>

<h2>7. Les 2 permissions du module</h2>
<table>
    <thead><tr><th>Permission</th><th>Ce qu'elle ouvre</th></tr></thead>
    <tbody>
        <tr><td><code>market:trade</code></td><td>Voir le catalogue, publier ses annonces, réserver et négocier.</td></tr>
        <tr><td><code>market:moderate</code></td><td>Retirer ou restaurer une annonce, traiter les signalements et consulter l'historique d'une annonce.</td></tr>
    </tbody>
</table>
<p>Ces deux permissions sont indépendantes de la bascule du module : pense à activer <strong>les deux</strong> interrupteurs (module + permission) pour un membre qui doit publier.</p>

<h2>8. Supervision plateforme (staff SigilOS)</h2>
<p>Le staff dispose d'une vue <strong>inter-guilde</strong> de supervision : indicateurs d'annonces, réservations et offres, signalements ouverts, volume des preuves, santé de la synchronisation Discord, purge des médias, verrou plateforme, rétention et durées globales. Cette vue est réservée au staff : aucune donnée n'en sort côté guilde.</p>
<p>Le <strong>journal d'audit du Marché</strong> est regroupé avec les autres journaux de la plateforme : <em>God → Audit Logs → onglet « Marché »</em> (filtre par guilde, dates en UTC, conservation pilotée par « Rétention du journal »). Les <strong>rôles pinguables</strong> restent un réglage <strong>de guilde</strong> (<em>Réglages → Marché</em>) : la console plateforme ne les modifie pas, un réglage local par nature n'a qu'une seule maison.</p>
`,
    },
    {
        slug: 'admin-modules',
        title: 'Gestion & Activation des Modules',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Activation Modulaire à la Carte</h2>
<p>Chaque guilde possède son propre ADN : axée PvM THL, élevage, entraide de quêtes ou Songes. Vous pouvez activer ou désactiver chaque brique fonctionnelle d'un simple interrupteur.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Panneau d'activation : masquez les modules superflus pour garder une interface épurée.</figcaption>
</figure>

<h2>Modules Configurables :</h2>
<ul>
    <li><strong>Missions Hebdomadaires :</strong> Défis et validation OCR.</li>
    <li><strong>Quête Ocre & Metamob :</strong> Matching inter-membres des archimonstres.</li>
    <li><strong>Songes Infinis :</strong> Suivi des étages et compositions de runs.</li>
    <li><strong>Donjons & Quêtes (LFG) :</strong> Système d'appel à l'aide interne.</li>
    <li><strong>Galerie de Stuff :</strong> Bibliothèque de panoplies DofusBook / DofusDB.</li>
    <li><strong>Services & Artisans :</strong> Annuaire des forgerons et mages 200.</li>
    <li><strong>Calendrier & Événements :</strong> Sorties planifiées et rappels Discord.</li>
    <li><strong>Bot Tickets :</strong> Support privé et candidatures.</li>
    <li><strong>Rôles par Réaction :</strong> Attribution automatique de rôles Discord.</li>
</ul>
        `
    },
    {
        slug: 'admin-members',
        title: 'Audit Technique & Gestion des Membres',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Une seule liste, deux onglets</h2>
<p>La page réunit désormais <strong>tous les humains de votre serveur Discord</strong> — ceux qui ont un profil sur SigilOS <em>comme</em> ceux qui n'en ont pas — dans <strong>une seule liste</strong>, sous deux onglets : <strong>Membres</strong> et <strong>Blacklist</strong>. Un membre n'apparaît plus jamais deux fois.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Liste unifiée : filtres de statut, inscription au dashboard, rôle Discord, recherche et pagination numérotée.</figcaption>
</figure>

<h2>1. Ce que la liste montre et filtre</h2>
<ul>
    <li><strong>Indicateurs :</strong> comptes actifs (avec la jauge de places), archivés, exclus et total géré.</li>
    <li><strong>Filtres de statut :</strong> Actifs / Archivés / Exclus / Tous, avec le compteur de chaque catégorie.</li>
    <li><strong>Inscription :</strong> Les deux / Dashboard / Hors dashboard (membres Discord sans profil SigilOS).</li>
    <li><strong>Rôle Discord :</strong> ne propose que les rôles réellement portés par au moins un membre.</li>
    <li><strong>Recherche libre :</strong> pseudo, pseudo Dofus, surnom Discord, tag Ankama ou identifiant Discord. Tri par arrivée, ancienneté ou pseudo, et pagination numérotée.</li>
</ul>

<h2>2. La modale par membre</h2>
<p>Cliquer une personne ouvre <strong>une modale unique</strong> qui regroupe les trois volets historiques :</p>
<ul>
    <li><strong>Profil &amp; actions :</strong> identité du registre (pseudo Dofus, tag Ankama au format Nom#0000, date d'arrivée), essai (validation et fin d'essai), vacances, relance Discord, archivage, exclusion et réintégration.</li>
    <li><strong>Registre :</strong> recruteur, mules (une par ligne) et journal du staff (commentaires horodatés et signés).</li>
    <li><strong>Discord :</strong> identifiant, pseudo serveur et rôles Discord connus.</li>
</ul>
<p>Les membres <strong>hors dashboard</strong> sont visibles et filtrables ; leur ligne ne porte ni essai, ni recruteur, ni journal (ils n'existent pas au registre).</p>

<h2>3. Suppression définitive d'un profil</h2>
<p>Une permission dédiée — <strong>« Supprimer un profil de guilde »</strong> — commande l'affichage du bouton de suppression. Elle se règle par rôle Discord dans l'écran RBAC : sans cette permission, le bouton n'apparaît pas et l'action est refusée côté serveur.</p>
<div class="callout callout-warning"><strong>⚠️ Action irréversible</strong> : la suppression efface définitivement les données SigilOS de la personne <strong>pour cette guilde</strong> (missions, succès, progression, journal) et ne conserve <strong>aucune exclusion</strong>. S'il revient, il repart comme un nouvel arrivant. Un admin de guilde ne touche jamais au compte global ni aux autres guildes ; seul le God peut purger le compte plateforme complet.</div>

<h2>4. Outils et journal de guilde</h2>
<ul>
    <li><strong>Synchronisation Globale :</strong> rapproche les comptes et met à jour les fiches depuis Discord.</li>
    <li><strong>Rapport d'audit :</strong> envoie sur Discord la couverture d'inscription et les membres manquants.</li>
    <li><strong>Blacklist de Guilde :</strong> conserve les identifiants Discord des personnes exclues pour alerter le staff en cas de tentative de réinscription.</li>
</ul>

<div class="callout callout-tip"><strong>💡 Depuis Discord</strong> : la commande staff <strong>/valider-recrue</strong> (mention + pseudo Dofus + tag Ankama + recruteur + date d'arrivée) complète directement la ligne d'une recrue, par exemple dans son ticket de candidature. Elle n'apparaît jamais dans le guide des commandes des membres.</div>
        `
    },
    {
        slug: 'module-recrutement-cycle-de-vie',
        title: 'Recrutement & Cycle de Vie des Membres',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Remplacement Intégral des Tableurs Excel</h2>
<p>Ce module vit désormais dans <strong>Membres &amp; Recrutement</strong>, onglet <strong>Registre</strong> : l'ancienne URL redirige automatiquement vers le registre, qui remplace définitivement les Google Sheets manuels par un flux temps réel connecté au Ladder Ankama et à Discord.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Cycle de vie des membres : compte à rebours d'essai J-X, jauge de mules et leaderboard des recruteurs.</figcaption>
</figure>

<h2>Les 5 Onglets Opérationnels :</h2>
<ol>
    <li><strong>Annuaire Actif :</strong> Visualisation des membres, statut de confirmation, tag Ankama éditable et personnages secondaires déclarés.</li>
    <li><strong>Période d'Essai (J-X) :</strong> Compte à rebours dynamique coloré (vert si &gt; 3j, orange si &le; 3j, rouge si expiré) avec validation en 1 clic et Leaderboard des recruteurs.</li>
    <li><strong>Mules & Alts :</strong> Jauge de saturation en direct par rapport au quota maximal défini par votre guilde (ou mode illimité).</li>
    <li><strong>Historique des Départs :</strong> Traçabilité des motifs (Volontaire, Inactivité, Comportement, Exclusion) avec réintégration possible en 1 clic.</li>
    <li><strong>Paramètres de Guilde :</strong> Réglage de la durée d'essai par défaut, des quotas et du message de bienvenue personnalisé.</li>
</ol>
        `
    },
    {
        slug: 'admin-missions',
        title: 'Gestion des Missions & Objectifs',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Piloter la Semaine d'Objectifs</h2>
<p>Le panneau de gestion des missions permet d'orchestrer la dynamique hebdomadaire de la guilde en fixant les défis de donjon, d'artisanat et d'exploration.</p>

<h2>1. Créer une Nouvelle Mission</h2>
<ul>
    <li><strong>Type d'Objectif :</strong> Donjon Boss (ex : Servitude, Tal Kasha, Guerre), Récolte de métier ou Succès spécifique.</li>
    <li><strong>Récompense :</strong> Nombre de Points de Contribution et d'XP de guilde attribués aux participants.</li>
    <li><strong>Nombre de Places :</strong> Limite de participants autorisés (ex : 4 joueurs pour un donjon classique, 8 pour un Kralamoure).</li>
</ul>

<h2>2. Publication & Reset</h2>
<ul>
    <li><strong>Publication Discord :</strong> D'un clic, le bot poste un bel embed récapitulatif dans votre salon d'annonces.</li>
    <li><strong>Reset Hebdomadaire :</strong> Clôturez la semaine pour figer les scores et renouveler les défis pour la semaine suivante.</li>
</ul>
        `
    },
    {
        slug: 'admin-validation',
        title: 'Validation des Preuves & File de Tri OCR',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Centre de Contrôle des Captures d'Écran</h2>
<p>Lorsqu'un membre réalise une mission, il soumet sa capture d'écran de fin de combat. Le moteur d'analyse extrait les informations pour assister le staff dans sa validation.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Centre de tri : vérification des données extraites par l'OCR et validation en 1 clic.</figcaption>
</figure>

<h2>1. Processus de Vérification :</h2>
<ol>
    <li><strong>Réception :</strong> La capture apparaît dans la file de validation avec son statut <em>"En attente"</em>.</li>
    <li><strong>Lecture OCR :</strong> Détection automatique du boss vaincu, des participants et de la date.</li>
    <li><strong>Vérification Manuelle :</strong> Comparez les données extraites avec les critères de la mission (bon boss ? bons participants ? bonne semaine ?).</li>
    <li><strong>Décision :</strong> Approuvez pour créditer les points, ou refusez avec un motif explicite.</li>
</ol>

<h2>2. Critères de Conformité :</h2>
<table>
    <thead><tr><th>Critère</th><th>✅ Valide</th><th>❌ Invalide</th></tr></thead>
    <tbody>
        <tr><td>Lisibilité</td><td>Image nette, non compressée</td><td>Floue, trop petite ou rognée</td></tr>
        <tr><td>Nom du boss</td><td>Clairement visible dans l'en-tête</td><td>Absent ou coupé</td></tr>
        <tr><td>Participants</td><td>Pseudos complets de tous les membres du groupe</td><td>Liste masquée ou incomplète</td></tr>
        <tr><td>Date</td><td>Horodatage de la semaine en cours</td><td>Semaine précédente ou illisible</td></tr>
    </tbody>
</table>
        `
    },
    {
        slug: 'admin-points',
        title: 'Points de Contribution & Économie de Guilde',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Système de Récompenses Communautaires</h2>
<p>Valorisez l'entraide, le temps passé à aider les nouveaux arrivants et la participation aux événements grâce aux <strong>Points de Contribution</strong>.</p>

<h2>1. Barèmes d'Attribution</h2>
<ul>
    <li><strong>Missions Hebdomadaires :</strong> Points indexés sur la difficulté du donjon (ex : 50 pts pour un donjon 150, 150 pts pour un boss THL).</li>
    <li><strong>Entraide LFG Donjons :</strong> Points crédités automatiquement lors de la clôture d'un appel à l'aide réussi.</li>
    <li><strong>Runs Songes Infinis :</strong> Bonus de points pour les organisateurs de paliers partagés.</li>
</ul>

<h2>2. Boutique de Guilde</h2>
<p>Configurez les récompenses échangeables contre des points : cosmétiques, rôles Discord honorifiques ou avantages en jeu.</p>
        `
    },
    {
        slug: 'admin-reaction-roles',
        title: 'Rôles par Réaction (Reaction Roles)',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Panneaux Interactifs Discord</h2>
<p>Permettez à vos membres de s'auto-attribuer les rôles de votre serveur Discord (notifications de sorties, disponibilités, classe jouée, métiers) via des boutons ou des menus déroulants modernes.</p>

<figure class="my-6">
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Déploiement de panneaux interactifs : sélecteurs de classes, métiers et notifications de sorties.</figcaption>
</figure>

<h2>1. Types de Panneaux Disponibles :</h2>
<ul>
    <li><strong>Boutons Interactifs :</strong> Idéal pour les rôles de notification (ex : <code>🔔 Notif Donjons</code>, <code>💎 Notif Songes</code>).</li>
    <li><strong>Menu Déroulant (Select Menu) :</strong> Recommandé pour les sélections denses comme les 19 classes Dofus ou les métiers de forgemagie.</li>
    <li><strong>Choix Unique vs Multiple :</strong> Empêche les membres de sélectionner des rôles mutuellement exclusifs si souhaité.</li>
</ul>

<div class="callout callout-important">
<strong>Hiérarchie des Rôles Discord</strong>
Pour que le bot puisse attribuer un rôle, le rôle du Bot SigilOS dans les paramètres de votre serveur Discord <strong>DOIT être positionné plus haut</strong> que les rôles qu'il est chargé de distribuer.
</div>
        `
    },
    {
        slug: 'admin-tickets',
        title: 'Bot Tickets & Support Discord',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>À quoi sert le module Tickets</h2>
<p>Ce module remplace avantageusement les bots tiers externes (Dyno, Ticket Tool, Ticketmaster) : la gestion de l'équipe, les notes privées, les transcripts certifiés et les avis restent hébergés au sein de SigilOS, tandis que les salons et notifications sont directement synchronisés sur votre serveur Discord. <strong>Zéro fuite de données, 100% gratuit et souverain.</strong></p>

<div class="callout callout-tip my-4">
    <p><strong>Architecture moderne :</strong> Le module s'articule autour de 7 briques intuitives : la <strong>Boîte de Réception</strong> (traitement en direct), les <strong>Types de Demande</strong> (parcours & formulaires), les <strong>Panneaux Discord</strong> (messages d'ouverture), les <strong>Commandes Slash</strong> (raccourcis rapides avec variables), les <strong>Archives</strong> (copies conformes), les <strong>Avis CSAT</strong> (notes 1 à 5 étoiles) et la <strong>Configuration</strong> (rôles et salons).</p>
</div>

<!-- ========================================================================= -->
<!-- MOCKUP 1 : PANNEAU DISCORD -->
<!-- ========================================================================= -->
<figure class="my-6">
    <div style="background-color: #313338; border: 1px solid #3f4147; border-radius: 12px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; max-width: 600px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #22c55e; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">S</div>
            <div>
                <span style="font-weight: bold; font-size: 14px;">SigilOS</span>
                <span style="background-color: #5865f2; font-size: 10px; font-weight: bold; padding: 1px 4px; border-radius: 4px; margin-left: 6px;">APP</span>
                <span style="color: #949ba4; font-size: 11px; margin-left: 8px;">aujourd'hui à 14:30</span>
            </div>
        </div>

        <div style="background-color: #2b2d31; border-left: 4px solid #5865f2; border-radius: 6px; padding: 14px; margin-bottom: 14px;">
            <div style="font-size: 15px; font-weight: bold; color: #ffffff; margin-bottom: 6px;">📩 Centre de Support & Recrutement</div>
            <div style="font-size: 13px; color: #dbdee1; line-height: 1.5;">
                Bienvenue sur le portail de la guilde !<br>
                Pour ouvrir un dossier privé avec notre équipe, cliquez sur l'un des boutons ci-dessous.<br>
                <em>Un salon dédié vous sera instantanément ouvert.</em>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #949ba4; border-top: 1px solid #3f4147; pt-2;">
                Guilde SigilOS • Service automatique
            </div>
        </div>

        <!-- Boutons d'action Discord -->
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <div style="background-color: #248046; color: #ffffff; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                🎉 Postuler dans la guilde
            </div>
            <div style="background-color: #4e5058; color: #ffffff; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                🛡️ Contacter les Modérateurs
            </div>
            <div style="background-color: #4e5058; color: #ffffff; padding: 7px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                ⚖️ Signaler un problème
            </div>
        </div>
    </div>
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Aperçu réaliste d'un panneau d'accueil déployé dans un salon Discord.</figcaption>
</figure>

<h2>1. Boîte de Réception & Suivi en direct</h2>
<p>L'inbox regroupe l'intégralité des tickets de votre serveur. Vous pouvez filtrer par statut (Ouvert, En attente, Fermé) ou rechercher par nom de membre, numéro de ticket ou mot-clé.</p>
<ul>
    <li><strong>Prise en charge (Claim) :</strong> Dès qu'un membre du staff clique sur « Prendre en charge », l'embed du salon Discord et le dashboard se mettent à jour instantanément pour afficher son nom. Les autres modérateurs savent immédiatement qui traite la demande.</li>
    <li><strong>Notes internes sécurisées :</strong> Rédigez des mémos privés ou des comptes-rendus entre modérateurs. Ces notes restent <strong>strictement réservées au dashboard</strong> et ne sont jamais divulguées au membre dans son salon Discord.</li>
    <li><strong>Rafraîchissement automatique :</strong> Le statut et la liste des tickets se mettent à jour en direct toutes les 10 secondes sans rechargement de page.</li>
</ul>

<h2>2. Types de Demande & Questionnaires (Parcours)</h2>
<p>Chaque guilde possède des besoins variés : recrutement, demande de craft, questions débutants ou réclamations. Les <strong>Types de Demande</strong> permettent de personnaliser l'expérience :</p>
<ul>
    <li><strong>Questionnaire intake jusqu'à 20 questions :</strong> Découpage automatique en pages de 5 modales Discord. Vous pouvez poser des questions texte court, paragraphe, choix unique, choix multiples ou Oui/Non.</li>
    <li><strong>Le Oui/Non comme condition bloquante :</strong> Une réponse « Non » (ex: <em>Possédez-vous un personnage niveau 200 ?</em>) peut soit avertir le candidat, soit bloquer directement l'envoi pour éviter de polluer le staff.</li>
    <li><strong>Rôles staff dédiés :</strong> Seuls les rôles Discord assignés à ce parcours (ex: le rôle <code>@Recruteurs</code>) ont accès au salon du ticket et reçoivent les notifications.</li>
    <li><strong>Sauvegarde de brouillon :</strong> Si le joueur ferme Discord en cours de saisie, ses réponses sont conservées 30 minutes : il peut reprendre son questionnaire d'un simple clic sans recommencer !</li>
</ul>

<h2>3. Panneaux Discord & Déploiement 1-Clic</h2>
<p>Les panneaux sont les messages d'accueil visibles par vos membres sur Discord :</p>
<ul>
    <li>Choisissez le salon Discord de destination (ex: <code>#recrutement</code> ou <code>#accueil-tickets</code>).</li>
    <li>Personnalisez l'embed avec vos couleurs de guilde, une miniature ou une grande bannière.</li>
    <li>Sélectionnez les parcours à afficher sous forme de <strong>boutons interactifs</strong> ou de <strong>menu déroulant</strong>.</li>
    <li>Cliquez sur « Déployer » : le message Discord est publié instantanément par le bot.</li>
</ul>

<!-- ========================================================================= -->
<!-- MOCKUP 2 : COMMANDE SLASH DANS LE TICKET -->
<!-- ========================================================================= -->
<figure class="my-6">
    <div style="background-color: #313338; border: 1px solid #3f4147; border-radius: 12px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; max-width: 600px; margin: 0 auto;">
        <div style="font-size: 12px; color: #949ba4; margin-bottom: 8px;">Salon ticket : <strong>#ticket-0042</strong></div>
        
        <!-- Frappe de la commande avec autocomplétion -->
        <div style="background-color: #2b2d31; border: 1px solid #3f4147; border-radius: 8px; padding: 10px 12px; font-family: monospace; font-size: 13px; display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
            <span style="color: #22c55e; font-weight: bold;">/</span>
            <span style="color: #ffffff; font-weight: 600;">bienvenue</span>
            <span style="background-color: #383a40; color: #dbdee1; padding: 2px 6px; border-radius: 4px; font-size: 11px;">membre: @CandidatDofus</span>
        </div>

        <!-- Rendu Discord de la commande -->
        <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #22c55e; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; shrink: 0;">S</div>
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="font-weight: bold; font-size: 13px;">SigilOS</span>
                    <span style="background-color: #5865f2; font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 4px;">APP</span>
                </div>
                <div style="font-size: 13px; color: #dbdee1; line-height: 1.5;">
                    🎉 Félicitations <span style="background-color: rgba(88, 101, 242, 0.2); color: #c9cdfb; padding: 2px 6px; border-radius: 4px; font-weight: 500;">@CandidatDofus</span> ! Ta candidature sur <strong>Guilde SigilOS</strong> a été validée par <span style="background-color: rgba(88, 101, 242, 0.2); color: #c9cdfb; padding: 2px 6px; border-radius: 4px; font-weight: 500;">un membre du staff</span> !
                </div>

                <div style="margin-top: 8px; background-color: #2b2d31; border-left: 4px solid #22c55e; border-radius: 6px; padding: 10px 12px; font-size: 12px;">
                    <div style="font-weight: bold; color: #ffffff; margin-bottom: 4px;">✨ Rôles Discord mis à jour :</div>
                    <div style="color: #dbdee1;">• Ajouté : <span style="color: #22c55e; font-weight: 600;">+ Membre</span><br>• Retiré : <span style="color: #ed4245; font-weight: 600;">- Candidat</span></div>
                </div>
            </div>
        </div>
    </div>
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Exécution en direct d'une commande slash personnalisée avec modification automatique de rôles.</figcaption>
</figure>

<h2>4. Commandes Slash Personnalisées (Exclusives aux Tickets)</h2>
<p>Vous pouvez créer jusqu'à <strong>20 commandes slash Discord sur-mesure</strong> utilisables uniquement à l'intérieur des salons tickets :</p>
<ul>
    <li><strong>Modèles prêts à l'emploi :</strong> 4 modèles disponibles en 1 clic (<em>Validation Recrue</em>, <em>Promotion / Grade</em>, <em>Résolution & Clôture</em>, <em>Relance Inactivité</em>).</li>
    <li><strong>Dictionnaire complet des balises dynamiques :</strong>
        <ul>
            <li><code>{demandeur}</code> : Ping Discord du créateur du ticket (ex: <code>@Joueur</code>).</li>
            <li><code>{cible}</code> : Ping du membre ciblé par l'option ou le demandeur.</li>
            <li><code>{pseudo}</code> : Pseudo brut sans arobase (idéal pour les titres d'embeds).</li>
            <li><code>{staff}</code> : Ping du modérateur ayant exécuté la commande.</li>
            <li><code>{motif}</code> : Nom du type de demande (ex: Recrutement).</li>
            <li><code>{numero}</code> : Numéro unique du ticket (ex: #0042).</li>
            <li><code>{salon}</code> : Lien cliquable vers le salon Discord actuel.</li>
            <li><code>{serveur}</code> : Nom officiel de votre guilde.</li>
        </ul>
    </li>
    <li><strong>Actions automatiques sur les rôles :</strong> Attribuez (ex: <em>Membre</em>) et retirez (ex: <em>Candidat</em>) des rôles Discord en un instant.</li>
    <li><strong>Clôture automatique :</strong> Déclenchez l'archivage et la fermeture du salon dès que la commande est validée.</li>
</ul>

<h2>5. Archives & Transcripts Certifiés</h2>
<p>Lors de la clôture d'un ticket, le système capture l'intégralité des échanges pour assurer la conformité et l'historique :</p>
<ul>
    <li><strong>Document Partageable (HTML) :</strong> Génère une copie propre et élégante contenant tous les messages publics, pièces jointes et avatars des intervenants. Les notes privées du staff n'y figurent jamais.</li>
    <li><strong>Annexe Interne Staff :</strong> Document réservé au staff regroupant l'audit log complet, les temps de réponse et les notes privées.</li>
    <li><strong>Rétention automatique :</strong> Vos archives sont conservées 365 jours par défaut (durée configurable) et peuvent être révoquées ou purgées à tout moment.</li>
</ul>

<!-- ========================================================================= -->
<!-- MOCKUP 3 : SONDAGE CSAT -->
<!-- ========================================================================= -->
<figure class="my-6">
    <div style="background-color: #313338; border: 1px solid #3f4147; border-radius: 12px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2b2d31; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="font-size: 14px; font-weight: bold; color: #ffffff; margin-bottom: 4px;">⭐ Votre avis compte pour notre équipe</div>
            <div style="font-size: 12.5px; color: #dbdee1;">
                Votre ticket <strong>#ticket-0042</strong> a été résolu. Comment évaluez-vous l'accueil et l'efficacité de notre staff ?
            </div>
        </div>

        <div style="display: flex; gap: 6px;">
            <div style="background-color: #4e5058; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 1</div>
            <div style="background-color: #4e5058; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 2</div>
            <div style="background-color: #4e5058; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 3</div>
            <div style="background-color: #4e5058; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 4</div>
            <div style="background-color: #f59e0b; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">⭐ 5</div>
        </div>
    </div>
    <figcaption class="text-xs text-muted-foreground mt-2 text-center">Sondage de satisfaction (CSAT) avec verrou de vote unique.</figcaption>
</figure>

<h2>6. Avis & Satisfaction (CSAT)</h2>
<p>Mesurez objectivement la qualité de réponse de votre modération :</p>
<ul>
    <li>Lors de la fermeture du ticket, le robot envoie automatiquement le sondage par message privé ou directement dans le salon avant suppression.</li>
    <li><strong>Verrou de vote unique :</strong> Le membre ne peut voter qu'une seule et unique fois ; toute tentative ultérieure est neutralisée.</li>
    <li><strong>Moyennes et statistiques :</strong> Retrouvez la moyenne globale de satisfaction (ex: 4.8 / 5) et le volume de retours dans l'onglet <em>Avis & Satisfaction</em>.</li>
</ul>

<h2>7. Configuration & Positionnement des Salons</h2>
<ul>
    <li><strong>Position dans la catégorie Discord :</strong> Choisissez si les nouveaux salons tickets sont créés <strong>tout en haut (TOP)</strong> pour une visibilité immédiate du staff, ou <strong>en bas (BOTTOM)</strong> pour suivre l'ordre chronologique Discord classique.</li>
    <li><strong>Salon de logs privé :</strong> Recevez une trace de chaque action importante (création, prise en charge, clôture, suppression).</li>
    <li><strong>Plafonds anti-spam :</strong> Limitez le nombre de tickets actifs simultanés par utilisateur (1 à 5) pour préserver votre serveur.</li>
</ul>
        `
    },
    {
        slug: 'admin-presentation',
        title: 'Identité & Page Publique de Guilde',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Votre Vitrine Publique SigilOS</h2>
<p>La page publique de guilde permet aux joueurs extérieurs de découvrir vos valeurs, vos accomplissements et les modalités de recrutement de votre communauté.</p>

<h2>Éléments Personnalisables :</h2>
<ul>
    <li><strong>Blason & Bannière :</strong> Intégrez votre logo de guilde et une illustration en haute définition.</li>
    <li><strong>Présentation & Ambitions :</strong> Décrivez l'histoire de votre guilde, vos activités principales (PvM THL, Songes, Élevage).</li>
    <li><strong>Critères de Recrutement :</strong> Affichez clairement le niveau requis, les exigences vocales et les créneaux d'activité.</li>
    <li><strong>Bouton Postuler :</strong> Redirige automatiquement le candidat vers l'ouverture d'un ticket sur votre Discord.</li>
</ul>
        `
    },
    {
        slug: 'admin-logs',
        title: 'Logs d\'Audit & Traçabilité Staff',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Sécurité & Traçabilité des Actions Staff</h2>
<p>Chaque modification opérée sur le Dashboard ou le bot Discord est consignée dans un journal d'audit immuable avec horodatage précis pour garantir une transparence totale.</p>

<h2>Événements Tracés :</h2>
<ul>
    <li><strong>Modifications RBAC :</strong> Ajout ou retrait d'une permission à un rôle Discord.</li>
    <li><strong>Gestion des Membres :</strong> Validation d'essai, exclusion, archivage ou modification de recruteur.</li>
    <li><strong>Validation de Missions :</strong> Approbation ou refus d'une capture d'écran avec identité de l'officier modérateur.</li>
    <li><strong>Changement de Configuration :</strong> Modification d'un webhook, d'une durée d'essai ou d'un salon système.</li>
</ul>
        `
    },
    {
        slug: 'admin-api-keys',
        title: 'Clés d\'API & Intégrations Développeur',
        category: 'Administration & Staff',
        accessLevel: 'ADMIN' as any,
        content: `
<h2>Accès Programmatique Sécurisé (API REST)</h2>
<p>Pour les guildes disposant de développeurs ou de bots personnalisés, SigilOS permet de générer des jetons d'accès (Bearer Token) sécurisés avec des scopes restreints.</p>

<h2>Fonctionnalités :</h2>
<ul>
    <li><strong>Génération de Clé :</strong> Création de jeton avec libellé descriptif et date d'expiration optionnelle.</li>
    <li><strong>Révocation Instantanée :</strong> Désactivation immédiate d'un jeton compromis sans impact sur le reste de la guilde.</li>
    <li><strong>Journal des Requêtes :</strong> Suivi du volume d'appels et des adresses IP clientes.</li>
</ul>

<div class="callout callout-important">
<strong>Bonnes Pratiques de Sécurité</strong>
Ne communiquez jamais vos clés secrètes sur des canaux publics. En cas de doute sur la fuite d'un jeton, révoquez-le immédiatement.
</div>
        `
    }

];
