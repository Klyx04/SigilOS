export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Poids des Runes et Guide Ultime de Forgemagie sur Dofus (2026)",
    description:
        "Tableau complet du poids (PWR) de toutes les runes FM, règles du puits/reliquat, over-jet, exotisme et astuces de forgemagie.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <p>
            La Forgemagie (FM) est l'un des piliers de l'économie et de l'optimisation sur Dofus. Que vous souhaitiez réaliser un Over Vita, un Exotisme PA/PM/PO ou simplement remonter les statistiques d'un équipement après un jet moyen, maîtriser le <strong>poids des runes (PWR)</strong> et la mécanique du <strong>puits (reliquat)</strong> est indispensable.
        </p>

        <h2>Les Fondations : Comment fonctionne la Forgemagie ?</h2>
        <p>
            Chaque tentative de passage de rune sur un équipement consomme une valeur invisible calculée selon le <strong>poids de la rune</strong>. Lorsqu'une rune est tentée, trois résultats sont possibles :
        </p>
        <ul>
            <li><strong>Succès Critique (SC) :</strong> La rune passe parfaitement, aucune statistique ne baisse et aucun puits n'est consommé.</li>
            <li><strong>Succès Neutre (SN) :</strong> La rune passe, mais des statistiques ou du puits sont consommés pour compenser le poids de la rune injectée.</li>
            <li><strong>Échec Critique (EC) :</strong> La rune ne passe pas, et des statistiques ou du puits sont perdus.</li>
        </ul>

        <h2>Tableau Récapitulatif du Poids des Runes (PWR)</h2>
        <p>
            Voici la grille de référence du poids officiel des runes dans Dofus :
        </p>

        <table>
            <thead>
                <tr>
                    <th>Caractéristique</th>
                    <th>Rune Simple</th>
                    <th>Rune Pa</th>
                    <th>Rune Ra</th>
                    <th>Poids Unitaire (PWR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_vi.png" alt="Vi" class="w-6 h-6 object-contain" />
                            <strong>Vitalité</strong>
                        </div>
                    </td>
                    <td>+5 Vi (1 PWR)</td>
                    <td>+15 Vi (3 PWR)</td>
                    <td>+50 Vi (10 PWR)</td>
                    <td>0.2 par point <span class="text-zinc-400 text-xs">(1 PWR = 5 Vi)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pa_fo.png" alt="Fo/Ine/Cha/Age" class="w-6 h-6 object-contain" />
                            <strong>Stats Élémentaires</strong>
                            <span class="text-xs text-zinc-400">(Fo, Ine, Cha, Age)</span>
                        </div>
                    </td>
                    <td>+1 Stat (1 PWR)</td>
                    <td>+3 Stat (3 PWR)</td>
                    <td>+10 Stat (10 PWR)</td>
                    <td>1 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_sa.png" alt="Sa" class="w-6 h-6 object-contain" />
                            <strong>Sagesse</strong>
                        </div>
                    </td>
                    <td>+1 Sa (3 PWR)</td>
                    <td>+3 Sa (9 PWR)</td>
                    <td>+10 Sa (30 PWR)</td>
                    <td>3 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pui.png" alt="Pui" class="w-6 h-6 object-contain" />
                            <strong>Prospection / Puissance</strong>
                        </div>
                    </td>
                    <td>+1 PP (3 PWR) / +1 Pui (2 PWR)</td>
                    <td>+3 PP (9 PWR) / +3 Pui (6 PWR)</td>
                    <td>+10 PP (30 PWR) / +10 Pui (20 PWR)</td>
                    <td>3 (PP) / 2 (Puissance)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_do.png" alt="Do" class="w-6 h-6 object-contain" />
                            <strong>Dommages Élémentaires / Fixes</strong>
                        </div>
                    </td>
                    <td>+1 Do (5 PWR)</td>
                    <td>+3 Do (15 PWR)</td>
                    <td>-</td>
                    <td>5 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_soin.png" alt="Soin" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_esq_pa.png" alt="Esq" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_ret_pa.png" alt="Ret" class="w-6 h-6 object-contain" />
                            <strong>Soins / Esquives / Retraits</strong>
                        </div>
                    </td>
                    <td>+1 Soin/Esq/Ret (10 PWR)</td>
                    <td>+3 (30 PWR)</td>
                    <td>-</td>
                    <td>7 (Soin) / 7 (Retrait/Esquive)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_re.png" alt="Ré" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_prc_re.png" alt="% Ré" class="w-6 h-6 object-contain" />
                            <strong>Résistances Fixes &amp; % Résistance</strong>
                        </div>
                    </td>
                    <td>+1 Ré Fixe (2 PWR) / +1 % Ré (6 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>2 (Fixe) / 6 (% Ré)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_cri.png" alt="Cri" class="w-6 h-6 object-contain" />
                            <strong>Coups Critiques (% CC)</strong>
                        </div>
                    </td>
                    <td>+1 % Crit (10 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>10 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_renv.png" alt="Renv" class="w-6 h-6 object-contain" />
                            <strong>Renvoi de Dommages</strong>
                        </div>
                    </td>
                    <td>+1 Renv (10 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>10 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_ini.png" alt="Ini" class="w-6 h-6 object-contain" />
                            <strong>Initiative</strong>
                        </div>
                    </td>
                    <td>+10 Ini (1 PWR)</td>
                    <td>+30 Ini (3 PWR)</td>
                    <td>+100 Ini (10 PWR)</td>
                    <td>0.1 par point <span class="text-zinc-400 text-xs">(1 PWR = 10 Ini)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pod.png" alt="Pods" class="w-6 h-6 object-contain" />
                            <strong>Pods</strong>
                        </div>
                    </td>
                    <td>+10 Pod (1 PWR)</td>
                    <td>+30 Pod (3 PWR)</td>
                    <td>+100 Pod (10 PWR)</td>
                    <td>0.1 par point <span class="text-zinc-400 text-xs">(1 PWR = 10 Pod)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_invo.png" alt="Invo" class="w-6 h-6 object-contain" />
                            <strong>Invocations</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-cyan-400">+1 Invo</span> (30 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>30 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_po.png" alt="Rune PO" class="w-6 h-6 object-contain" />
                            <strong>Portée (PO)</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-amber-400">+1 PO</span> (51 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>51 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_ga_pme.png" alt="Rune Ga PM" class="w-6 h-6 object-contain" />
                            <strong>Point de Mouvement (PM)</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-emerald-400">+1 PM</span> (90 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>90 par point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_ga_pa.png" alt="Rune Ga PA" class="w-6 h-6 object-contain" />
                            <strong>Point d'Action (PA)</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-rose-400">+1 PA</span> (100 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>100 par point</td>
                </tr>
            </tbody>
        </table>

        <h2>La Notion Cruciale de Puits (Reliquat)</h2>
        <p>
            Lorsqu'une caractéristique lourde (comme un PA, un PM ou de la PO) saute lors d'un échec ou d'un succès neutre, elle génère un <strong>puits résiduel</strong>. Ce puits correspond exactement à la valeur PWR de la statistique perdue.
        </p>
        <p>
            <em>Exemple :</em> Si le PA d'une amulette saute, vous disposez d'un puits de <strong>100 PWR</strong>. Vous pouvez alors remonter toutes les caractéristiques secondaires (Vitalité, Dommages, Résistances) sans subir de pertes collatérales tant que le puits n'est pas épuisé !
        </p>

        <h2>Over-max et Exotisme (Exo)</h2>
        <p>
            Un <strong>Over</strong> consiste à dépasser le jet naturel maximal d'un objet (ex: monter à +350 Vita sur un item qui en donne 300 max). Un <strong>Exo</strong> consiste à ajouter une caractéristique absente de l'objet (ex: +1 PA ou +1% Ré).
        </p>
        <ul>
            <li>Le cumul maximum d'Over ou d'Exo théorique est limité à <strong>101 de poids total</strong> par item.</li>
            <li>Le taux de passage d'un Exo PA (100 PWR) ou PM (90 PWR) sur un item sans puits naturel est de <strong>1% de chance (SC)</strong> par tentative.</li>
        </ul>
    `,
};
