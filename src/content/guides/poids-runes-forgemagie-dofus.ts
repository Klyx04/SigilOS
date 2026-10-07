export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Poids des Runes et Guide Ultime de Forgemagie sur Dofus (2026)",
    description:
        "Tableau officiel complet du poids des runes (PWR), règles du reliquat (puits), priorités de passage, over-jet, exotisme et transcendance sur Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Mise à jour Dofus Unity (2026)</strong>
            <p>Sous Dofus Unity (Dofus 3), <strong>le reliquat (puits) s'affiche désormais directement dans l'interface de forgemagie</strong>. Il n'est plus nécessaire de le noter sur un calepin ! Néanmoins, comprendre comment ce reliquat est généré, consommé et optimisé reste la clé absolue pour réussir ses jets parfaits, overs et exotismes.</p>
        </div>

        <p>
            La Forgemagie (FM) est l'un des piliers économiques et compétitifs de Dofus. Que vous cherchiez à façonner un équipement jet parfait, à réaliser un <strong>Over Vitalité</strong>, un <strong>Exotisme PA/PM/PO</strong> ou à poser une <strong>Rune de Transcendance</strong>, maîtriser le <strong>poids des runes (densité ou PWR)</strong> et les mécaniques de probabilités est indispensable pour ne pas gaspiller des millions de kamas.
        </p>

        <h2>1. Les 3 Grands Principes de la Forgemagie</h2>
        <p>
            Chaque tentative de forgemagie repose sur un équilibre mathématique strict dicté par trois piliers fondamentaux : <strong>l'issue</strong>, <strong>la priorité</strong> et <strong>le reliquat</strong>.
        </p>

        <h3>A. L'Issue du Passage</h3>
        <p>
            Lorsqu'une rune est tentée sur un équipement, trois dénouements sont possibles :
        </p>
        <ul>
            <li><strong>Succès Critique (SC) :</strong> La rune passe avec succès. Aucune caractéristique ne baisse et aucun point de reliquat n'est consommé.</li>
            <li><strong>Succès Neutre (SN) :</strong> La rune s'insère sur l'objet, mais le jeu prélève une valeur équivalente à son poids en puisant dans le reliquat disponible, ou à défaut, en réduisant d'autres statistiques de l'objet.</li>
            <li><strong>Échec Critique (EC) :</strong> La rune ne passe pas, et des statistiques ou du reliquat sont perdus pour compenser le choc.</li>
        </ul>

        <div class="callout callout-warning">
            <strong>La règle d'or des Exotismes lourds (PA / PM / PO)</strong>
            <p>Pour toute rune dont la densité unitaire est <strong>supérieure à 20</strong> tentée sur un équipement qui ne possède pas naturellement cette caractéristique (Exotisme), <strong>le Succès Neutre n'existe pas</strong> ! Le taux de passage en Succès Critique est bloqué à <strong>1% fixe</strong> par tentative, peu importe le niveau de métier.</p>
        </div>

        <h3>B. La Priorité de Passage</h3>
        <p>
            Toutes les runes n'ont pas la même facilité d'insertion. Le taux de succès critique d'une rune dépend de trois critères :
        </p>
        <ol class="steps">
            <li><strong>Le poids total de l'objet :</strong> Plus un équipement a des statistiques élevées (poids total proche ou supérieur à son maximum naturel), plus les runes ont du mal à passer en succès critique.</li>
            <li><strong>Le seuil de la caractéristique ciblée :</strong> Plus une ligne se rapproche de 100% de son jet maximum naturel, plus le taux de succès critique de sa rune diminue. Il est donc toujours plus facile de remonter équitablement toutes les lignes faibles d'un objet plutôt que de vouloir maxer une ligne à 100% isolément.</li>
            <li><strong>Le calibre des runes (Simples vs Pa vs Ra) :</strong> Une fois un certain palier de statistiques atteint sur l'item, les runes moyennes (Pa) et supérieures (Ra) bénéficient d'une probabilité de passage nettement supérieure aux runes simples de base.</li>
        </ol>

        <h3>C. Le Reliquat (Puits) : Le Moteur Invisible</h3>
        <p>
            Lorsqu'une rune provoque une baisse sur une statistique lourde (ou saute lors d'un échec), le jeu génère un <strong>reliquat</strong> égal à la différence de densité :
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-emerald-400 border border-zinc-800">
            Reliquat généré = Densité de la statistique perdue - Densité de la rune insérée
        </p>
        <p>
            <em>Exemple concret :</em> Vous tentez une <strong>Rune Pa Ine</strong> (poids 3) sur une amulette, et la ligne <strong>Invocation</strong> (poids 30) saute lors d'un Succès Neutre. Le calcul est immédiat :
        </p>
        <p>
            <strong>30 - 3 = +27 de reliquat disponible.</strong>
        </p>
        <p>
            Ce reliquat de 27 agit comme un bouclier total : vous pouvez enchaîner vos tentatives jusqu'à épuisement de ces 27 points sans qu'aucune autre statistique de l'item ne puisse baisser lors d'un SN ou d'un échec !
        </p>

        <h2>2. Tableau Officiel du Poids des Runes &amp; Over Max (Dofus Unity 2026)</h2>
        <p>
            Voici la grille de référence complète et officielle du poids unitaire (PWR) de toutes les runes de Dofus, accompagnée de la limite maximale théorique d'over (calculée sur la base de la règle des <strong>101 de densité maximum</strong>) :
        </p>

        <div class="overflow-x-auto my-6">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-zinc-700 bg-zinc-900/80">
                        <th class="p-3">Caractéristique</th>
                        <th class="p-3">Rune Simple</th>
                        <th class="p-3">Rune Pa</th>
                        <th class="p-3">Rune Ra</th>
                        <th class="p-3">Poids / pt</th>
                        <th class="p-3 text-amber-400 font-bold">Over Max</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800 text-sm">
                    <!-- PA / PM / PO -->
                    <tr class="bg-rose-950/20">
                        <td class="p-3 font-semibold text-rose-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ga_pa.png" alt="Ga PA" class="w-6 h-6 object-contain" />
                                Point d'Action (Ga PA)
                            </div>
                        </td>
                        <td class="p-3">+1 PA (100 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-rose-400">100</td>
                        <td class="p-3 font-bold text-amber-400">+1 PA</td>
                    </tr>
                    <tr class="bg-emerald-950/20">
                        <td class="p-3 font-semibold text-emerald-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ga_pme.png" alt="Ga PM" class="w-6 h-6 object-contain" />
                                Point de Mouvement (Ga PM)
                            </div>
                        </td>
                        <td class="p-3">+1 PM (90 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-emerald-400">90</td>
                        <td class="p-3 font-bold text-amber-400">+1 PM</td>
                    </tr>
                    <tr class="bg-amber-950/20">
                        <td class="p-3 font-semibold text-amber-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_po.png" alt="PO" class="w-6 h-6 object-contain" />
                                Portée (PO)
                            </div>
                        </td>
                        <td class="p-3">+1 PO (51 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-amber-400">51</td>
                        <td class="p-3 font-bold text-amber-400">+1 PO</td>
                    </tr>

                    <!-- INVO & DOMMAGES GENERIQUES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_invo.png" alt="Invo" class="w-6 h-6 object-contain" />
                                Invocations
                            </div>
                        </td>
                        <td class="p-3">+1 Invo (30 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">30</td>
                        <td class="p-3 font-semibold text-amber-400">+3 Invo</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do.png" alt="Do" class="w-6 h-6 object-contain" />
                                Dommages (génériques)
                            </div>
                        </td>
                        <td class="p-3">+1 Do (20 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">20</td>
                        <td class="p-3 font-semibold text-amber-400">+5 Do</td>
                    </tr>

                    <!-- SPECIALISES % -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do_per.png" alt="% Do" class="w-6 h-6 object-contain" />
                                % Do Sort / Arme / Distance / Mêlée
                            </div>
                        </td>
                        <td class="p-3">+1% (15 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">15</td>
                        <td class="p-3 font-semibold text-amber-400">+6 %</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_re_per_di_me.png" alt="% Ré Di/Me" class="w-6 h-6 object-contain" />
                                % Ré Distance / % Ré Mêlée
                            </div>
                        </td>
                        <td class="p-3">+1% (15 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">15</td>
                        <td class="p-3 font-semibold text-amber-400">+6 %</td>
                    </tr>

                    <!-- SOIN & CRITIQUE -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_soin.png" alt="Soin" class="w-6 h-6 object-contain" />
                                Soins
                            </div>
                        </td>
                        <td class="p-3">+1 Soin (10 PWR)</td>
                        <td class="p-3">+3 Soin (30 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">10</td>
                        <td class="p-3 font-semibold text-amber-400">+10 Soin</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_cri.png" alt="Critique" class="w-6 h-6 object-contain" />
                                Coup Critique (% CC)
                            </div>
                        </td>
                        <td class="p-3">+1% Crit (10 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">10</td>
                        <td class="p-3 font-semibold text-amber-400">+10 %</td>
                    </tr>

                    <!-- RETRAIT & ESQUIVE -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ret_pa.png" alt="Ret" class="w-6 h-6 object-contain" />
                                <img src="/images/guides/fm/rune_esq_pa.png" alt="Esq" class="w-6 h-6 object-contain" />
                                Retrait PA / PM &amp; Esquive PA / PM
                            </div>
                        </td>
                        <td class="p-3">+1 (7 PWR)</td>
                        <td class="p-3">+3 (21 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">7</td>
                        <td class="p-3 font-semibold text-amber-400">+14</td>
                    </tr>

                    <!-- % RESISTANCES ELEMENTAIRES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_prc_re.png" alt="% Ré" class="w-6 h-6 object-contain" />
                                % Résistances (Neutre, Terre, Feu, Eau, Air)
                            </div>
                        </td>
                        <td class="p-3">+1% Ré (6 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">6</td>
                        <td class="p-3 font-semibold text-amber-400">+16 %</td>
                    </tr>

                    <!-- DO ELEMENTAIRES, CRIT, POU, PIEGE, RENVOI -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do_elements.png" alt="Do Élem" class="w-6 h-6 object-contain" />
                                Do Éléments, Do Critique, Do Poussée, Pièges
                            </div>
                        </td>
                        <td class="p-3">+1 Do (5 PWR)</td>
                        <td class="p-3">+3 Do (15 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">5</td>
                        <td class="p-3 font-semibold text-amber-400">+20 Do</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_renv.png" alt="Renv" class="w-6 h-6 object-contain" />
                                Renvoi de Dommages &amp; Arme de Chasse
                            </div>
                        </td>
                        <td class="p-3">+1 Renv / Chasse (5 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">5</td>
                        <td class="p-3 font-semibold text-amber-400">+20</td>
                    </tr>

                    <!-- FUITE & TACLE -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_fui_tac.png" alt="Fuite/Tacle" class="w-6 h-6 object-contain" />
                                Fuite &amp; Tacle
                            </div>
                        </td>
                        <td class="p-3">+1 (4 PWR)</td>
                        <td class="p-3">+3 (12 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">4</td>
                        <td class="p-3 font-semibold text-amber-400">+25</td>
                    </tr>

                    <!-- SAGESSE & PROSPECTION -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_sa.png" alt="Sa" class="w-6 h-6 object-contain" />
                                Sagesse
                            </div>
                        </td>
                        <td class="p-3">+1 Sa (3 PWR)</td>
                        <td class="p-3">+3 Sa (9 PWR)</td>
                        <td class="p-3">+10 Sa (30 PWR)</td>
                        <td class="p-3 font-mono">3</td>
                        <td class="p-3 font-semibold text-amber-400">+33 Sa</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_prospe.png" alt="PP" class="w-6 h-6 object-contain" />
                                Prospection
                            </div>
                        </td>
                        <td class="p-3">+1 PP (3 PWR)</td>
                        <td class="p-3">+3 PP (9 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">3</td>
                        <td class="p-3 font-semibold text-amber-400">+33 PP</td>
                    </tr>

                    <!-- PUISSANCE & RESISTANCES FIXES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_pui.png" alt="Pui" class="w-6 h-6 object-contain" />
                                Puissance &amp; Puissance Pièges
                            </div>
                        </td>
                        <td class="p-3">+1 Pui (2 PWR)</td>
                        <td class="p-3">+3 Pui (6 PWR)</td>
                        <td class="p-3">+10 Pui (20 PWR)</td>
                        <td class="p-3 font-mono">2</td>
                        <td class="p-3 font-semibold text-amber-400">+50 Pui</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_re.png" alt="Ré Fixe" class="w-6 h-6 object-contain" />
                                Résistances Fixes, Ré Crit, Ré Poussée
                            </div>
                        </td>
                        <td class="p-3">+1 Ré (2 PWR)</td>
                        <td class="p-3">+3 Ré (6 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">2</td>
                        <td class="p-3 font-semibold text-amber-400">+50 Ré</td>
                    </tr>

                    <!-- STATS ELEMENTAIRES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_elements.png" alt="Stats" class="w-6 h-6 object-contain" />
                                Stats Élémentaires (Force, Intel, Chance, Agi)
                            </div>
                        </td>
                        <td class="p-3">+1 Stat (1 PWR)</td>
                        <td class="p-3">+3 Stat (3 PWR)</td>
                        <td class="p-3">+10 Stat (10 PWR)</td>
                        <td class="p-3 font-mono">1</td>
                        <td class="p-3 font-semibold text-amber-400">+101 Stat</td>
                    </tr>

                    <!-- STATS SOUS-UNITAIRES -->
                    <tr class="bg-zinc-900/40">
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_vi.png" alt="Vi" class="w-6 h-6 object-contain" />
                                Vitalité
                            </div>
                        </td>
                        <td class="p-3">+5 Vi (1 PWR)</td>
                        <td class="p-3">+15 Vi (3 PWR)</td>
                        <td class="p-3">+50 Vi (10 PWR)</td>
                        <td class="p-3 font-mono">0.2 <span class="text-zinc-500 text-xs">(1 PWR = 5 Vi)</span></td>
                        <td class="p-3 font-semibold text-amber-400">+505 Vi</td>
                    </tr>
                    <tr class="bg-zinc-900/40">
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_pod.png" alt="Pod" class="w-6 h-6 object-contain" />
                                Pods
                            </div>
                        </td>
                        <td class="p-3">+10 Pod (2.5 PWR)</td>
                        <td class="p-3">+30 Pod (7.5 PWR)</td>
                        <td class="p-3">+100 Pod (25 PWR)</td>
                        <td class="p-3 font-mono">0.25 <span class="text-zinc-500 text-xs">(2.5 PWR = 10 Pod)</span></td>
                        <td class="p-3 font-semibold text-amber-400">+404 Pods</td>
                    </tr>
                    <tr class="bg-zinc-900/40">
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ini.png" alt="Ini" class="w-6 h-6 object-contain" />
                                Initiative
                            </div>
                        </td>
                        <td class="p-3">+10 Ini (1 PWR)</td>
                        <td class="p-3">+30 Ini (3 PWR)</td>
                        <td class="p-3">+100 Ini (10 PWR)</td>
                        <td class="p-3 font-mono">0.1 <span class="text-zinc-500 text-xs">(1 PWR = 10 Ini)</span></td>
                        <td class="p-3 font-semibold text-amber-400">+1010 Ini</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>3. Les 3 Profils d'Équipements à Forgemager</h2>
        <p>
            Selon les caractéristiques natives de l'objet, votre stratégie de forgemagie ne sera pas du tout la même. On distingue 3 grandes familles :
        </p>

        <h3>1. Les Items à Concessions</h3>
        <p>
            Ces équipements ne possèdent aucune ligne très lourde (ni PA, ni PM, ni PO) permettant de générer un gros reliquat sécurisant. Pour obtenir un jet exceptionnel sur vos caractéristiques principales, vous devez volontairement <strong>sacrifier une ligne secondaire</strong> peu utile pour votre build (ex: sacrifier le Soin ou la Prospection sur une Ceinture Strigide pour maxer les Résistances Critiques et la Vitalité).
        </p>

        <h3>2. Les Items à Puits (La voie royale)</h3>
        <p>
            Ce sont les objets dotés d'un PA, d'un PM ou d'un PO naturel (ex: Amulette Koutoulou, Cape du Sinistrofu).
        </p>
        <p>
            <strong>La méthode pas-à-pas :</strong>
        </p>
        <ol class="steps">
            <li>Vous travaillez l'item jusqu'à ce que la grosse ligne saute (ex: -1 PA = <strong>100 de reliquat</strong>).</li>
            <li>Avec le poids allégé de 100 points, l'équipement absorbe les runes avec une facilité déconcertante. Vous montez toutes les autres statistiques à leur jet parfait et posez un bel over (ex: Over Vitalité).</li>
            <li>Une fois le reliquat consommé et l'item parfaitement préparé, vous replacez la rune lourde (Ga PA ou Ga PM) en priant pour le Succès Critique !</li>
        </ol>

        <h3>3. Les Items à Brisage Forcé</h3>
        <p>
            Sur des objets très lourds sans stat de puits naturelle (ex: Casque Dragoeuf), les forgemages experts réalisent un « saut artificiel » : ils tentent un <strong>Exo PA ou PM</strong> sur l'objet. Lorsque la rune passe, ils la font sauter volontairement pour s'offrir un puits artificiel massif de 90 ou 100 de densité, permettant de sculpter un jet parfait rarissime.
        </p>

        <h2>4. Overmax, Exotisme et Transcendance</h2>
        <p>
            À quel moment considère-t-on un équipement comme achevé ? Il existe trois finalités majeures :
        </p>
        <ul>
            <li><strong>L'Over :</strong> Dépasser le jet maximum naturel d'une caractéristique présente sur l'objet. La règle du jeu impose que la valeur totale de l'over ne peut excéder <strong>101 de densité</strong> (ex: maximum +505 Vitalité ou +101 Force supplémentaires).</li>
            <li><strong>L'Exotisme (Exo) :</strong> Ajouter une statistique qui n'existe pas sur l'item d'origine (ex: +1 PA sur un Anneau Volkorne). Les lignes exotiques sont limitées à 101 de densité cumulée. Le taux de succès critique pour un Exo PA, PM ou PO est rigoureusement bloqué à <strong>1% (SC)</strong>.</li>
            <li><strong>La Rune de Transcendance :</strong> Une rune spécifique qui s'applique à <strong>100% de réussite</strong> pour finaliser l'équipement, mais qui <strong>verrouille définitivement l'objet</strong> contre toute forgemagie future.</li>
        </ul>

        <div class="callout callout-important">
            <strong>Conditions strictes de la Rune de Transcendance</strong>
            <p>Pour pouvoir poser une Rune de Transcendance, l'équipement <strong>ne doit posséder aucun over et aucun exo préalable</strong> (jet naturel parfait au maximum). De plus, l'apport de la transcendance ne doit pas faire dépasser le plafond de 100 de densité totale d'over sur la caractéristique ciblée.</p>
        </div>

        <div class="callout callout-tip">
            <strong>Astuce des pros : Le lissage d'over</strong>
            <p>Si votre équipement dépasse légèrement son jet max (ex: 213 Vitalité sur un objet à 200 max) et vous empêche de poser une Transcendance, utilisez une petite <strong>Rune Pod (2.5 PWR)</strong> en échec volontaire. L'échec retirera environ 13 Vitalité sans toucher aux autres lignes, ramenant votre item à 200/200 pile pour recevoir la Transcendance !</p>
        </div>

        <h2>5. Optimiser la Montée de Métier Forgemage</h2>
        <p>
            L'expérience (XP) gagnée lors de chaque passage de rune dépend d'une formule mathématique simple :
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-cyan-400 border border-zinc-800">
            XP Métier = Niveau de l'équipement × Densité unitaire de la rune
        </p>
        <p>
            Pour monter vos métiers de forgemagie (Cordomage, Costumage, Joaillomage, etc.) à moindre frais :
        </p>
        <ol class="steps">
            <li><strong>Analysez le ratio Prix / Densité en HDV :</strong> Repérez les runes offrant la plus grosse densité pour le coût le plus faible (généralement Sagesse, Dommages élémentaires, Prospection ou Fuite/Tacle).</li>
            <li><strong>Changez d'item tous les 15 à 20 niveaux :</strong> Plus le niveau de l'item travaillé est élevé, plus le multiplicateur d'XP est conséquent.</li>
            <li><strong>Fusionnez vos runes au concasseur :</strong> 3 runes simples = 1 rune Pa ; 3 runes Pa = 1 rune Ra. Les runes Pa et Ra apportent 3 et 10 fois plus d'XP par clic tout en passant avec d'excellents taux dès que l'item atteint des jets intermédiaires.</li>
        </ol>
    `,
};
