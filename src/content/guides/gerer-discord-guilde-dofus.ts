export const guide = {
    slug: "gerer-discord-guilde-dofus",
    title: "Gérer le Discord de sa guilde Dofus : architecture, permissions et sorties",
    description:
        "Le guide pratique pour bâtir un Discord de guilde Dofus lisible et sécurisé : salons utiles, rôles, permissions, onboarding et organisation des sorties.",
    publishedAt: "2026-08-23",
    updatedAt: "2026-08-23",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Un Discord utile, pas un second jeu à administrer</strong>
            <p>Un serveur de guilde doit rendre une information facile à trouver, une sortie facile à rejoindre et une décision facile à suivre. Le but n'est pas d'empiler les salons ou les bots : c'est de réduire les messages perdus et la charge des officiers.</p>
        </div>

        <h2>I. Commencer par les flux, pas par les salons</h2>
        <p>Avant de créer une catégorie, demandez-vous quel flux elle sert. Une guilde a généralement cinq flux stables : accueillir, discuter, organiser des sorties, rendre service et modérer. Si un salon n'a pas de flux précis, il deviendra probablement un salon mort.</p>

        <div class="callout callout-info">
            <strong>Principe d'architecture</strong>
            <p>Un salon principal par sujet, puis un fil de discussion par sortie, demande d'aide ou commande. Les fils gardent l'historique de l'action sans transformer <code>#donjons-et-succès</code> en mur de messages.</p>
        </div>

        <h3>1. Arborescence minimale recommandée</h3>
        <table>
            <thead>
                <tr>
                    <th>Catégorie</th>
                    <th>Salons</th>
                    <th>Règle d'utilisation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>📌 01. ACCUEIL</strong></td>
                    <td><code>#reglement</code><br/><code>#annonces</code><br/><code>#presentations</code></td>
                    <td>Le règlement et les annonces sont en lecture seule. <code>#presentations</code> est le seul salon où une personne sans rôle de guilde peut écrire.</td>
                </tr>
                <tr>
                    <td><strong>💬 02. VIE DE GUILDE</strong></td>
                    <td><code>#taverne</code><br/><code>#screens-et-drops</code><br/><code>#commandes-bot</code></td>
                    <td>Réservé aux membres vérifiés. Activez un ralentissement seulement si le volume le justifie ; ne punissez pas une communauté active par défaut.</td>
                </tr>
                <tr>
                    <td><strong>⚔️ 03. SORTIES</strong></td>
                    <td><code>#donjons-et-succes</code><br/><code>#raids</code><br/><code>#songes-infinis</code><br/><code>#entraide-dofus</code></td>
                    <td>Une sortie = un fil. Le message initial porte la date, l'objectif, les places et les besoins ; le fil porte les échanges.</td>
                </tr>
                <tr>
                    <td><strong>🔨 04. ARTISANAT</strong></td>
                    <td><code>#artisans-et-craft</code><br/><code>#prets-et-coffre</code><br/><code>#commerce-interne</code></td>
                    <td>Donnez un format épinglé à chaque demande : objet, ressources, budget, disponibilité et délai.</td>
                </tr>
                <tr>
                    <td><strong>🔊 05. VOCAUX</strong></td>
                    <td><code>🔊 Taverne</code><br/><code>⚔️ Donjon 1 (×4)</code><br/><code>⚔️ Donjon 2 (×4)</code><br/><code>🐙 Raid (×12)</code><br/><code>🤫 Silencieux / stream</code></td>
                    <td>Les salons de donjon ont une limite correspondant au groupe. Le vocal raid doit être créé pour son format réel, pas pour accueillir tout le serveur.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Catégories privées à ne pas oublier</h3>
        <table>
            <thead>
                <tr>
                    <th>Catégorie</th>
                    <th>Accès</th>
                    <th>Contenu</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>🛡️ STAFF</strong></td>
                    <td>Meneur, officiers et modérateurs</td>
                    <td><code>#staff</code>, <code>#candidatures</code>, <code>#journal-moderation</code>. Les sanctions et les candidatures ne se traitent jamais dans les salons publics.</td>
                </tr>
                <tr>
                    <td><strong>🤝 ALLIANCE / INVITÉS</strong></td>
                    <td>Rôle Allié ou Invité uniquement</td>
                    <td>Un espace de coordination qui ne donne aucun accès aux conversations, aux prêts ou aux décisions internes de la guilde.</td>
                </tr>
                <tr>
                    <td><strong>📚 ARCHIVES</strong></td>
                    <td>Membres ou staff, selon le contenu</td>
                    <td>Anciens comptes-rendus, règles historiques et événements clôturés. Archivez : ne supprimez pas une information encore utile.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. Permissions : une base fermée, des accès explicites</h2>
        <p>Le rôle <code>@everyone</code> s'applique à toute personne qui rejoint le serveur. Traitez-le comme le rôle d'un visiteur non vérifié : il ne doit pas pouvoir perturber le serveur, inviter des inconnus ni accéder aux espaces internes.</p>

        <h3>1. Réglage de <code>@everyone</code></h3>
        <table>
            <thead>
                <tr>
                    <th>Permission</th>
                    <th>Réglage</th>
                    <th>Pourquoi</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Mentionner <code>@everyone</code>, <code>@here</code> et les rôles</td>
                    <td>🔴 Désactivé</td>
                    <td>Les pings collectifs restent une responsabilité de staff ou de rôles précis.</td>
                </tr>
                <tr>
                    <td>Créer des invitations</td>
                    <td>🔴 Désactivé</td>
                    <td>Vous gardez la maîtrise des arrivées et pouvez invalider une invitation compromise.</td>
                </tr>
                <tr>
                    <td>Envoyer des messages et joindre des fichiers</td>
                    <td>🔴 Désactivé par défaut</td>
                    <td>Ouvrez uniquement <code>#presentations</code> si nécessaire. Les liens et fichiers ne sont pas indispensables avant vérification.</td>
                </tr>
                <tr>
                    <td>Gérer les salons, messages, rôles ou webhooks</td>
                    <td>🔴 Désactivé</td>
                    <td>Ces permissions ne doivent jamais être héritées par accident.</td>
                </tr>
                <tr>
                    <td>Voir les salons et ajouter des réactions</td>
                    <td>🟢 Accueil uniquement</td>
                    <td>La personne peut lire les règles et effectuer l'action de validation prévue.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Hiérarchie de rôles</h3>
        <p>La position des rôles est aussi importante que leurs permissions. Un rôle ne peut agir que sur des rôles placés sous lui. Le bot doit donc être au-dessus des rôles qu'il est censé attribuer, mais n'obtient pas pour autant la permission Administrateur.</p>

        <ol>
            <li><strong>👑 Meneur</strong> : propriétaire du serveur. Activez la double authentification et limitez l'accès à ce rôle.</li>
            <li><strong>🤖 SigilOS Bot</strong> : attribue uniquement les rôles qu'il doit gérer et publie uniquement dans les salons prévus.</li>
            <li><strong>⚔️ Bras droits</strong> : gestion de la guilde, des événements et des messages. Pas d'<code>Administrateur</code> par confort.</li>
            <li><strong>🛡️ Modérateurs / organisateurs</strong> : messages, fils, vocaux, événements et délais d'exclusion ; aucun droit de gestion globale.</li>
            <li><strong>⚜️ Membre</strong> : accès aux espaces internes, vocaux et salons de sorties.</li>
            <li><strong>🌱 Recrue</strong> : accès limité le temps de l'intégration, notamment sans envoi libre de liens externes.</li>
            <li><strong>🤝 Allié / invité</strong> : accès explicitement limité à la catégorie inter-guildes.</li>
        </ol>

        <div class="callout callout-warning">
            <strong>Le test qui évite les mauvaises surprises</strong>
            <p>Après chaque modification importante, utilisez la fonction « Voir le serveur depuis le rôle » dans les paramètres Discord. Vérifiez au minimum ce que voient une Recrue, un Membre, un Invité et un Modérateur. Un serveur est sécurisé par ses accès réels, pas par la liste des rôles que vous pensez avoir configurée.</p>
        </div>

        <h2>III. Onboarding : transformer un arrivant en membre</h2>
        <p>Un nouveau ne devrait jamais devoir demander « je vais où ? ». Son parcours doit tenir en quatre étapes visibles dès l'arrivée.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-onboarding-natif.png" alt="Processus d'accueil Discord — configuration des salons et rôles de départ" class="guide-image" />
            <span class="guide-caption">Discord propose nativement un processus d'accueil : activez-le pour guider chaque nouveau membre dès son arrivée sur votre serveur de guilde.</span>
        </div>

        <ol>
            <li><strong>Lire</strong> : règlement, fonctionnement de la guilde et règle de confidentialité dans <code>#reglement</code>.</li>
            <li><strong>Se présenter</strong> : personnage principal, serveur, objectifs et disponibilités dans <code>#presentations</code>.</li>
            <li><strong>Être vérifié</strong> : un officier valide l'arrivée ou le membre obtient le rôle Recrue après l'étape que vous avez définie.</li>
            <li><strong>Choisir ses notifications</strong> : rôles de notification utiles, par exemple <code>Raids</code>, <code>Songes</code> ou <code>Artisanat</code>. Ne rendez aucun rôle de notification obligatoire.</li>
        </ol>

        <div class="callout callout-tip">
            <strong>À faire une seule fois</strong>
            <p>Épinglez un message de présentation avec un modèle court : <code>Classe / niveau — objectifs — créneaux — métiers — ce que je cherche</code>. Vous obtenez une information exploitable sans transformer l'arrivée en formulaire interminable.</p>
        </div>

        <h2>IV. Sorties : une annonce qui se suffit à elle-même</h2>
        <p>Une annonce de sortie doit pouvoir être comprise sans relire 40 messages. Le lecteur doit savoir immédiatement s'il peut venir, quand, et ce qu'il doit préparer.</p>

        <h3>1. Modèle d'annonce à réutiliser</h3>
        <pre><code>⚔️ [DONJON / RAID] — Nom de l'objectif

📅 Date et heure : vendredi 21h00
🎯 Objectif : passage, succès ou farm
👥 Places : 4 / 8 — rôles ou classes recherchés
⏱️ Durée estimée : 1h30
📍 Rendez-vous : vocal Raid, 10 minutes avant
🎒 Pré-requis : clefs, consommables, succès concernés

Inscription : réagissez ou utilisez le bouton prévu.
Les échanges et la composition se font dans le fil de ce message.</code></pre>

        <h3>2. Donjons, succès et Songes</h3>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/sigilos-donjons-quetes.png" alt="Dashboard SigilOS — Donjons & Quêtes avec système d'inscription en temps réel" class="guide-image" />
            <span class="guide-caption">Le module Donjons & Quêtes de SigilOS : une sortie par carte, date, composition et bouton d'inscription directement synchronisé avec Discord.</span>
        </div>

        <ul>
            <li><strong>Donjons et succès</strong> : créez un fil par objectif ; nommez-le avec le donjon, le succès et la date pour qu'il reste retrouvable.</li>
            <li><strong>Songes infinis</strong> : le premier message du fil indique l'étage, les modificateurs, l'équipe et le prochain créneau de reprise. Ce sont les seules informations qui doivent survivre à une pause.</li>
            <li><strong>Raids de guilde (Gigalodon, Jardins Éternels)</strong> : annoncez-les 48h à l'avance, prévoyez des remplaçants sur liste d'attente et faites un briefing vocal 10 minutes avant le lancement.</li>
            <li><strong>Après la sortie</strong> : clôturez le fil avec un résultat simple : terminé, reporté ou à reprendre. Cela évite les inscriptions fantômes.</li>
        </ul>

        <h3>3. Vocaux : des règles simples</h3>
        <p>Le vocal Taverne est social. Les vocaux de donjon sont opérationnels : privilégiez les informations utiles en combat et déplacez les discussions annexes vers un autre salon. L'organisateur doit pouvoir annoncer un rappel sans se battre contre le bruit.</p>

        <h2>V. Connecter Discord à SigilOS</h2>
        <p>Discord est excellent pour discuter ; il n'est pas conçu pour maintenir, seul, une liste fiable de personnages, de disponibilités, de métiers ou d'objectifs. La connexion avec SigilOS doit donc être pensée comme une réduction des doubles saisies, pas comme une couche de bots supplémentaire.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-embed-sigilos-donjon.png" alt="Embed Discord du bot SigilOS — annonce de recherche de donjon avec boutons d'inscription" class="guide-image" />
            <span class="guide-caption">Ce que voit votre guilde dans Discord : l'embed SigilOS publie automatiquement le donjon, la date, les succès visés, les places disponibles et les boutons d'action.</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Besoin</th>
                    <th>Discord seul</th>
                    <th>Avec SigilOS</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Sorties</strong></td>
                    <td>Listes manuelles dans un message et relances individuelles.</td>
                    <td>Un événement publie une annonce structurée, centralise les inscriptions et garde une composition lisible.</td>
                </tr>
                <tr>
                    <td><strong>Quêtes de Dofus</strong></td>
                    <td>Chacun gère ses étapes séparément, sans vue collective.</td>
                    <td>Matrice interactive (Ocre, Primordiaux, Dokille, Dolmanax) : regroupement instantané des membres bloqués au même endroit.</td>
                </tr>
                <tr>
                    <td><strong>Artisanat</strong></td>
                    <td>La disponibilité des artisans se perd dans le flux.</td>
                    <td>Un annuaire de guilde filtrable par métier et niveau donne un point d'entrée clair.</td>
                </tr>
                <tr>
                    <td><strong>Prêts</strong></td>
                    <td>Un message est vite oublié et ne constitue pas un suivi.</td>
                    <td>Le prêt est suivi depuis une donnée dédiée, avec un statut et un historique.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Garde-fous d'intégration</strong>
            <p>Le bot ne reçoit que les permissions strictement nécessaires à ses actions. Réservez-lui un salon de commandes et des salons de publication identifiés. Ne synchronisez jamais un rôle qui donne plus d'accès que l'information associée ne le justifie. Testez le scénario complet avec un compte de test : association, rôle attribué, inscription, désinscription et suppression d'accès.</p>
        </div>

        <h2>VI. Modération : prévoir les incidents avant qu'ils arrivent</h2>
        <p>La meilleure modération est prévisible. Les membres doivent connaître les règles, les officiers doivent savoir qui décide, et les incidents doivent laisser une trace accessible au staff.</p>

        <table>
            <thead>
                <tr>
                    <th>Situation</th>
                    <th>Réponse immédiate</th>
                    <th>Suivi</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Spam ou raid</strong></td>
                    <td>Fermez temporairement les salons publics, désactivez les invitations et appliquez les mesures de modération adaptées.</td>
                    <td>Consultez le journal d'audit, nettoyez les accès puis annoncez brièvement le retour à la normale.</td>
                </tr>
                <tr>
                    <td><strong>Compte staff compromis</strong></td>
                    <td>Retirez les rôles sensibles ; vérifiez les modifications récentes de rôles, salons et webhooks.</td>
                    <td>Changez les accès concernés, restaurez la configuration et documentez l'incident dans le salon staff.</td>
                </tr>
                <tr>
                    <td><strong>Conflit public ou vocal</strong></td>
                    <td>Stoppez l'escalade, séparez les participants si nécessaire et déplacez la discussion hors du salon public.</td>
                    <td>Appliquez la règle connue de tous, pas une sanction improvisée sous pression.</td>
                </tr>
            </tbody>
        </table>

        <h2>VII. Checklist de mise en ligne</h2>
        <ol>
            <li><strong>Supprimer</strong> les salons inutiles, dupliqués ou sans propriétaire.</li>
            <li><strong>Verrouiller</strong> <code>@everyone</code>, puis ouvrir les droits par rôles et catégories.</li>
            <li><strong>Créer</strong> un parcours d'arrivée complet : règlement, présentation, vérification, rôle.</li>
            <li><strong>Configurer</strong> les rôles de notification sans les confondre avec les rôles d'accès.</li>
            <li><strong>Tester</strong> le serveur avec les vues Recrue, Membre, Invité et Modérateur.</li>
            <li><strong>Documenter</strong> le format des sorties et la procédure d'incident dans le salon staff.</li>
            <li><strong>Auditer</strong> la structure tous les trois mois : permissions, bots, invitations, salons inactifs et rôles orphelins.</li>
        </ol>

        <div class="callout callout-info">
            <strong>La structure doit servir le jeu</strong>
            <p>Si une règle, un salon ou une automatisation ne fait pas gagner du temps aux membres et aux officiers, retirez-la. Un bon Discord reste discret : il permet simplement à la guilde de jouer plus souvent et de mieux s'organiser.</p>
        </div>
    `,
};