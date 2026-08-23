export const guide = {
    slug: "creer-gerer-guilde-dofus-2026",
    title: "Créer et gérer sa guilde Dofus en 2026 : le guide complet",
    description:
        "Les mécaniques de guilde après les mises à jour 3.4 et 3.6 : création, recrutement, rangs, hall, progression, paliers d'activité, Guildatons et raids de guilde.",
    publishedAt: "2026-08-02",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Dofus Unity 2026 — MàJ 3.6</strong>
            <p>Ce guide s'appuie sur les mécaniques officielles après les mises à jour 3.4 et 3.6 : fin du don d'XP automatique, missions hebdomadaires, paliers d'activité, Guildatons et raids de guilde.</p>
        </div>

        <h2>I. Créer sa guilde</h2>

        <div class="flex flex-col sm:flex-row items-start gap-6 my-6 p-5 rounded-2xl bg-zinc-900/40 border border-white/10">
            <div class="flex flex-col gap-3 text-sm text-zinc-300 leading-relaxed">
                <p>Tout commence au <strong>Temple des guildes</strong> en <strong>[0, -8]</strong> (Montagne des Craqueleurs). Le PNJ <strong>Guilda</strong> vend la <strong>Guildalogemme pour 30 000 kamas</strong>. Si vous en avez déjà une, inutile d'en racheter. La création se fait dans la salle suivante via le livre magique.</p>
                <ul class="text-xs text-zinc-400 space-y-1 mt-2">
                    <li>• Capacité maximale : <strong>350 membres</strong></li>
                    <li>• Niveau maximum : <strong>20</strong></li>
                    <li>• Plafond XP/semaine : <strong>100 points</strong></li>
                </ul>
            </div>
        </div>

        <h2>II. Recruter et accueillir</h2>
        <p>Depuis l'onglet Membres, le meneur gère le mode de recrutement :</p>
        <ul>
            <li><strong>Fermé</strong> : aucune candidature, contact direct requis.</li>
            <li><strong>Ouvert automatique</strong> : rejoindre directement via « Postuler ».</li>
            <li><strong>Ouvert manuel</strong> : candidature envoyée, acceptée ou refusée.</li>
        </ul>

        <h2>III. Rangs et Droits</h2>
        <p>Quatre rangs par défaut : <strong>Maître de guilde</strong>, <strong>Officier</strong>, <strong>Initié</strong> et <strong>À l'essai</strong>. Le rang « À l'essai » ne peut recevoir aucun droit. Les droits sont regroupés en <strong>5 familles</strong> :</p>

        <table>
            <thead>
                <tr>
                    <th>Famille de droits</th>
                    <th>Permissions disponibles</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Membres</strong></td>
                    <td>Recrutement, invitations, gestion des rangs et droits</td>
                </tr>
                <tr>
                    <td><strong>Activités</strong></td>
                    <td>Missions, achats, hall de guilde, raids</td>
                </tr>
                <tr>
                    <td><strong>Journal</strong></td>
                    <td>Message de guilde, informations internes</td>
                </tr>
                <tr>
                    <td><strong>Enclos</strong></td>
                    <td>Utilisation, aménagement, gestion des montures</td>
                </tr>
                <tr>
                    <td><strong>Coffre de guilde</strong></td>
                    <td>Consultation, dépôt, retrait</td>
                </tr>
            </tbody>
        </table>

        <h2>IV. Le Hall de Guilde</h2>

        <div class="my-6 rounded-2xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_hall.jpg" alt="Hall de guilde Dofus" class="w-full max-h-64 object-cover" />
        </div>

        <p>Chaque guilde choisit son hall parmi <strong>7 grandes villes</strong>. Changement possible à tout moment mais avec <strong>1 heure d'attente</strong> entre chaque changement. Les halls sont <strong>instanciés</strong> : seuls les membres de votre guilde se voient à l'intérieur.</p>

        <table>
            <thead>
                <tr>
                    <th>Ville</th>
                    <th>Coordonnées</th>
                    <th>Salle Marchands</th>
                    <th>Salle Entraînement</th>
                </tr>
            </thead>
            <tbody>
                <tr><td><strong>Amakna</strong></td><td>[-1, -1]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Astrub</strong></td><td>[1, -15]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Bonta</strong></td><td>[-35, -61]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Brâkmar</strong></td><td>[-29, 37]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Frigost</strong></td><td>[-76, -34]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Pandala</strong></td><td>[19, -26]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
                <tr><td><strong>Sufokia</strong></td><td>[23, 23]</td><td>Niv. 2</td><td>Niv. 17</td></tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>4 salles dans le hall</strong>
            <p><strong>Salle principale</strong> (Zaap) · <strong>Salle des missions</strong> (PNJ Homer Cenaire, expéditions) · <strong>Salle des marchands</strong> (dès niv. 2, PNJ marchands + coffre) · <strong>Salle d'entraînement</strong> (dès niv. 17, Poutch Ingball)</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            <div class="rounded-xl overflow-hidden border border-white/10">
                <img src="/images/guides/guilde/guild_hall_int.png" alt="Apparences du hall de guilde" class="w-full h-40 object-cover" />
                <p class="text-xs text-zinc-400 p-3">5 apparences intérieures disponibles par hall — la façade évolue automatiquement avec le niveau de la guilde.</p>
            </div>
            <div class="rounded-xl overflow-hidden border border-white/10">
                <img src="/images/guides/guilde/guild_niveaux.jpg" alt="Niveaux de guilde et bonus" class="w-full h-40 object-cover" />
                <p class="text-xs text-zinc-400 p-3">Chaque niveau de guilde (max 20) débloque des bonus pour tous les membres.</p>
            </div>
        </div>

        <h2>V. Faire Progresser la Guilde — Paliers et Jauge</h2>
        <p>
            L'expérience de guilde vient des <strong>missions</strong>. Il faut choisir un <strong>palier d'activité</strong>
            qui détermine la jauge à remplir. La jauge est reset <strong>chaque mardi à 7h</strong>.
            Le plafond est <strong>100 XP par semaine</strong>.
        </p>

        <div class="my-4 rounded-xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_palier.png" alt="Choix du palier d'activité" class="w-full object-cover max-h-48" />
        </div>

        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Palier 1</th>
                    <th>Palier 2</th>
                    <th>Palier 3</th>
                    <th>Palier 4</th>
                    <th>Palier 5</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Membres actifs conseillés</strong></td>
                    <td>10</td>
                    <td>30</td>
                    <td>50</td>
                    <td>100</td>
                    <td>150</td>
                </tr>
                <tr>
                    <td><strong>XP/semaine (Jalon 1)</strong></td>
                    <td>40</td>
                    <td>52</td>
                    <td>64</td>
                    <td>76</td>
                    <td>88</td>
                </tr>
                <tr>
                    <td><strong>Reconnaissances (Jalon 1)</strong></td>
                    <td>10 à 13</td>
                    <td>13 à 16</td>
                    <td>16 à 19</td>
                    <td>19 à 22</td>
                    <td>22 à 25</td>
                </tr>
                <tr>
                    <td><strong>Points d'activité requis</strong></td>
                    <td>25 000</td>
                    <td>75 000</td>
                    <td>150 000</td>
                    <td>300 000</td>
                    <td>500 000</td>
                </tr>
                <tr>
                    <td><strong>Coût changement de mission</strong></td>
                    <td>50 k.g.</td>
                    <td>150 k.g.</td>
                    <td>250 k.g.</td>
                    <td>500 k.g.</td>
                    <td>750 k.g.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>Le premier jalon est le plus important</strong>
            <p>Il représente ~80% des récompenses (XP + reconnaissances). Les jalons 2, 3 et 4 ne rapportent chacun que <strong>4 XP supplémentaires</strong>. L'objectif minimal chaque semaine : <strong>atteindre le Jalon 1</strong>.</p>
        </div>

        <h2>VI. Les Missions de Guilde</h2>

        <div class="my-4 rounded-xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_missions.png" alt="Interface de sélection des missions" class="w-full object-cover max-h-56" />
        </div>

        <div class="callout callout-info">
            <strong>Délai de participation</strong>
            <p>Vous devez être dans la guilde depuis <strong>au moins 24 heures</strong> pour participer aux missions.</p>
        </div>

        <p>12 missions classiques par semaine, réparties entre plusieurs catégories : <strong>Donjon</strong>, <strong>Régulation</strong>, <strong>Anomalie</strong>, <strong>Songes Infinis</strong>, <strong>Contrats de guilde</strong> et <strong>Spéciales</strong>. Vous choisissez le rang et les catégories que votre guilde préfère.</p>
        <ul>
            <li>Un personnage <strong>ne peut pas valider deux fois la même mission</strong>.</li>
            <li>Marquez une mission avec l'icône étoile pour signaler votre intérêt.</li>
            <li>Changement de palier effectif <strong>la semaine suivante</strong> uniquement.</li>
        </ul>

        <h2>VII. Guildatons et Kamas de Guilde</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            <div class="p-5 rounded-xl bg-zinc-900/70 border border-amber-500/20">
                <strong class="text-amber-300 text-sm block mb-2">🪙 Guildatons</strong>
                <p class="text-xs text-zinc-400">Gagnés en réalisant des missions. Échangeables contre des récompenses cosmétiques (ornements, titres, décoration du hall…) auprès de l'Amateur de Guildaton dans le hall.</p>
            </div>
            <div class="p-5 rounded-xl bg-zinc-900/70 border border-purple-500/20">
                <strong class="text-purple-300 text-sm block mb-2">💰 Kamas de Guilde</strong>
                <p class="text-xs text-zinc-400">Don : tranches de <strong>10 000 kamas</strong>, max 50 000/semaine/compte (après 24h de membership). 10 000 kamas = 10 kamas de guilde. Servent à changer des missions, acheter des bonus et des raids.</p>
            </div>
        </div>

        <h2>VIII. Les Raids de Guilde (MàJ 3.6)</h2>
        <p>Les raids s'achètent dans la boutique de guilde avec des <strong>kamas de guilde</strong>. Pas besoin d'appartenir à la guilde organisatrice pour y participer.</p>

        <table>
            <thead>
                <tr>
                    <th>Raid</th>
                    <th>Joueurs</th>
                    <th>Durée</th>
                    <th>Coût</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Sanctuaire des Jardins éternels</strong></td>
                    <td>8 à 16</td>
                    <td>~2 heures</td>
                    <td>480 k.g.</td>
                </tr>
                <tr>
                    <td><strong>Gouffre du Gigalodon</strong></td>
                    <td>8 à 12</td>
                    <td>~1 heure</td>
                    <td>360 k.g.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Récompenses de Raid</strong>
            <p>Dépendent du score obtenu : ressources, XP et Guildatons. Maximum <strong>un seul raid par semaine</strong> (pas les deux). Le meilleur score de la guilde est retenu pour le ladder — récompenses possibles : reconnaissances, XP de guilde, ornements temporaires.</p>
        </div>

        <h2>Conseils d'Organisation</h2>

        <div class="callout callout-tip">
            <strong>Rythme hebdomadaire</strong>
            <p>La semaine se réinitialise le <strong>mardi à 7h</strong>. Répartissez les 12 missions dès le début du cycle pour laisser le temps de boucler les objectifs difficiles.</p>
        </div>

        <div class="callout callout-info">
            <strong>Coordonner les membres</strong>
            <p>Un personnage ne peut pas valider deux fois la même mission. SigilOS gère ce suivi depuis le tableau de bord — assignez chaque mission à un groupe pour éviter les doublons et maximiser la jauge.</p>
        </div>

        <div class="callout callout-warning">
            <strong>Bien choisir son palier</strong>
            <p>Un palier trop ambitieux crée de la pression inutile. Privilégiez un palier où vous atteignez systématiquement le <strong>Jalon 1</strong> — c'est là que se concentrent les récompenses.</p>
        </div>
    `,
} as const;