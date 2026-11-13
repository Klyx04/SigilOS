export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Poids des runes Dofus : tableau et puits FM",
    description:
        "Tableau officiel complet du poids des runes (PWR), règles du puits FM (reliquat), calcul des overmax, exotismes 1% SC et transcendance sur Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
    draft: false,
    badgeColor: "amber",
    body: `
        <div class="callout callout-tip">
            <strong>Mise à jour Dofus Unity (Interface FM Moderne)</strong>
            <p>
                Sous Dofus Unity, <strong>le reliquat (puits) s'affiche désormais directement dans l'interface de forgemagie</strong> en temps réel. Il n'est plus nécessaire de le noter sur un calepin. Néanmoins, comprendre comment ce puits est généré, absorbé et optimisé reste la compétence clé pour réussir ses jets parfaits, overs et exotismes.
            </p>
        </div>

        <div class="guide-image-container my-6">
            <div class="flex items-center justify-center gap-4 flex-wrap p-4 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40">
                    <img src="/images/guides/fm/rune_ga_pa.png" alt="Ga PA" class="class-icon w-6 h-6 object-contain" />
                    <span class="text-xs font-bold text-foreground">Ga PA (100)</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40">
                    <img src="/images/guides/fm/rune_ga_pme.png" alt="Ga PM" class="class-icon w-6 h-6 object-contain" />
                    <span class="text-xs font-bold text-foreground">Ga PM (90)</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40">
                    <img src="/images/guides/fm/rune_po.png" alt="PO" class="class-icon w-6 h-6 object-contain" />
                    <span class="text-xs font-bold text-foreground">PO (51)</span>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40">
                    <img src="/images/guides/fm/rune_invo.png" alt="Invo" class="class-icon w-6 h-6 object-contain" />
                    <span class="text-xs font-bold text-foreground">Invo (30)</span>
                </div>
            </div>
            <span class="guide-caption">Les runes nobles de forgemagie — sources principales de génération de reliquat (puits)</span>
        </div>

        <h2>1. Les 3 Issues de Passage d'une Rune</h2>
        <p>
            À chaque tentative d'insertion d'une rune, l'enclume obéit à trois issues possibles déterminées par les probabilités internes du jeu :
        </p>

        <!-- Schéma 3 Issues -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Schéma — Les 3 issues de forgemagie
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">Succès Critique (SC)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        La rune s'insère parfaitement. <strong>Aucune autre caractéristique ne baisse</strong> et <strong>aucun point de reliquat n'est consommé</strong>.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit">Succès Neutre (SN)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        La rune s'insère, mais le jeu prélève une valeur équivalente à son poids en <strong>consommant du reliquat</strong> ou en réduisant d'autres statistiques.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit">Échec Critique (EC)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        La rune ne s'insère pas. De plus, <strong>du puits ou des statistiques sont détruits</strong> pour compenser le choc de l'échec.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-warning">
            <strong>Règle d'or des Exotismes lourds (PA, PM, PO)</strong>
            <p>
                Pour toute rune dont la densité unitaire est <strong>supérieure à 20 PWR</strong> tentée sur un équipement qui ne la possède pas naturellement (Exotisme PA, PM ou PO), <strong>le Succès Neutre n'existe pas</strong>.
            </p>
            <p class="mt-2 text-xs">
                Le taux de passage en Succès Critique est <strong>bloqué à 1% fixe</strong> par tentative, indépendamment du niveau de métier. Toute tentative qui ne passe pas en SC est un Échec Critique qui dégrade l'objet ou consomme du puits.
            </p>
        </div>

        <h2>2. Le Reliquat (Puits FM) et son Calcul</h2>
        <p>
            Le <strong>puits</strong> est une réserve tampon d'énergie créée lorsqu'une statistique lourde diminue ou saute. Ce réservoir absorbe les pertes lors des tentatives suivantes, protégeant l'ensemble des autres lignes de l'équipement.
        </p>

        <!-- Schéma Cycle du Puits avec numéros clairs -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Cycle d'optimisation avec puits naturel
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent/10 text-accent border border-accent/20 w-fit">01</span>
                    <strong class="text-foreground text-sm">Saut de ligne lourde</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">-1 PA libère jusqu'à +100 de puits disponible</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit">02</span>
                    <strong class="text-foreground text-sm">Phase sécurisée</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">Le puits absorbe les pertes sans impacter les autres statistiques</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">03</span>
                    <strong class="text-foreground text-sm">Jets parfaits &amp; over</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">Remontée des caractéristiques et pose de l'over ciblé</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">04</span>
                    <strong class="text-foreground text-sm">Repassage en SC</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">Réinsertion de la rune lourde en Succès Critique</span>
                </div>
            </div>
        </div>

        <h3>Formule mathématique du reliquat généré</h3>
        <p class="font-mono text-sm p-3 rounded-lg border border-border bg-surface my-2">
            Reliquat généré = Densité de la stat perdue - Densité de la rune insérée
        </p>

        <ul class="space-y-1.5 my-3 text-xs">
            <li>
                <span><strong>Saut d'un PA :</strong> Vous passez une rune Ine (poids 1) et le PA saute en SN : <code>100 - 1 = +99 de puits</code>.</span>
            </li>
            <li>
                <span><strong>Saut d'une Invocation :</strong> Vous passez une rune Pa Vi (poids 3) et l'Invo saute en SN : <code>30 - 3 = +27 de puits</code>.</span>
            </li>
            <li>
                <span><strong>Saut d'un PO :</strong> Vous passez une rune Do (poids 20) et le PO saute en SN : <code>51 - 20 = +31 de puits</code>.</span>
            </li>
        </ul>

        <h2>3. Tableau Officiel du Poids des Runes &amp; Over Maximal</h2>
        <p>
            Voici la grille de référence du poids unitaire (PWR) de toutes les runes de Dofus, avec le plafond maximal théorique d'over (calculé selon la règle des <strong>101 points de densité</strong>) :
        </p>

        <div class="overflow-x-auto my-6">
            <table>
                <thead>
                    <tr>
                        <th>Caractéristique</th>
                        <th>Rune Simple</th>
                        <th>Rune Pa</th>
                        <th>Rune Ra</th>
                        <th>Poids / pt</th>
                        <th>Over Max Théorique</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- RUNES MAJEURES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ga_pa.png" alt="" class="class-icon" />
                            <strong>Point d'Action (Ga PA)</strong>
                        </td>
                        <td>+1 PA (100)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">100</td>
                        <td><strong>+1 PA</strong> (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ga_pme.png" alt="" class="class-icon" />
                            <strong>Point de Mouvement (Ga PM)</strong>
                        </td>
                        <td>+1 PM (90)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">90</td>
                        <td><strong>+1 PM</strong> (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_po.png" alt="" class="class-icon" />
                            <strong>Portée (PO)</strong>
                        </td>
                        <td>+1 PO (51)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">51</td>
                        <td><strong>+1 PO</strong> (51 PWR)</td>
                    </tr>

                    <!-- INVO & DO -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_invo.png" alt="" class="class-icon" />
                            <strong>Invocations</strong>
                        </td>
                        <td>+1 Invo (30)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">30</td>
                        <td>+3 Invo (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_do.png" alt="" class="class-icon" />
                            <strong>Dommages Fixes</strong>
                        </td>
                        <td>+1 Do (20)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">20</td>
                        <td>+5 Do (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_do_per.png" alt="" class="class-icon" />
                            <strong>% Dommages Sorts, Armes, Distance, Mêlée</strong>
                        </td>
                        <td>+1% Do (15)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">15</td>
                        <td>+6% Do (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_re_per_di_me.png" alt="" class="class-icon" />
                            <strong>% Résistance Distance, Mêlée</strong>
                        </td>
                        <td>+1% Ré (15)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">15</td>
                        <td>+6% Ré (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_soin.png" alt="" class="class-icon" />
                            <strong>Soins</strong>
                        </td>
                        <td>+1 Soin (10)</td>
                        <td>+3 Soin (30)</td>
                        <td>-</td>
                        <td class="font-mono">10</td>
                        <td>+10 Soin (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_cri.png" alt="" class="class-icon" />
                            <strong>% Coup Critique</strong>
                        </td>
                        <td>+1% Cri (10)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">10</td>
                        <td>+10% Cri (100 PWR)</td>
                    </tr>

                    <!-- RETRAIT & ESQUIVE -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ret_pa.png" alt="" class="class-icon" />
                            <strong>Retrait PA &amp; Retrait PM</strong>
                        </td>
                        <td>+1 Ret (7)</td>
                        <td>+3 Ret (21)</td>
                        <td>-</td>
                        <td class="font-mono">7</td>
                        <td>+14 Ret (98 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_esq_pa.png" alt="" class="class-icon" />
                            <strong>Esquive PA &amp; Esquive PM</strong>
                        </td>
                        <td>+1 Esq (7)</td>
                        <td>+3 Esq (21)</td>
                        <td>-</td>
                        <td class="font-mono">7</td>
                        <td>+14 Esq (98 PWR)</td>
                    </tr>

                    <!-- RESISTANCES & DOMMAGES ELEMENTAIRES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_prc_re.png" alt="" class="class-icon" />
                            <strong>% Résistances Élémentaires</strong>
                        </td>
                        <td>+1% Ré (6)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">6</td>
                        <td>+16% Ré (96 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_do_elements.png" alt="" class="class-icon" />
                            <strong>Dommages Élémentaires, Do Crit, Do Pou</strong>
                        </td>
                        <td>+1 Do (5)</td>
                        <td>+3 Do (15)</td>
                        <td>-</td>
                        <td class="font-mono">5</td>
                        <td>+20 Do (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_renv.png" alt="" class="class-icon" />
                            <strong>Renvoi de Dommages</strong>
                        </td>
                        <td>+1 Renv (5)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">5</td>
                        <td>+20 Renv (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_chasse.png" alt="" class="class-icon" />
                            <strong>Arme de Chasse</strong>
                        </td>
                        <td>+1 Chasse (5)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">5</td>
                        <td>+1 Chasse (5 PWR)</td>
                    </tr>

                    <!-- CARACTERISTIQUES MOYENNES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_fui_tac.png" alt="" class="class-icon" />
                            <strong>Fuite &amp; Tacle</strong>
                        </td>
                        <td>+1 (4)</td>
                        <td>+3 (12)</td>
                        <td>-</td>
                        <td class="font-mono">4</td>
                        <td>+25 Fui/Tac (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_sa.png" alt="" class="class-icon" />
                            <strong>Sagesse</strong>
                        </td>
                        <td>+1 Sa (3)</td>
                        <td>+3 Sa (9)</td>
                        <td>+10 Sa (30)</td>
                        <td class="font-mono">3</td>
                        <td>+33 Sa (99 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_prospe.png" alt="" class="class-icon" />
                            <strong>Prospection</strong>
                        </td>
                        <td>+1 PP (3)</td>
                        <td>+3 PP (9)</td>
                        <td>-</td>
                        <td class="font-mono">3</td>
                        <td>+33 PP (99 PWR)</td>
                    </tr>

                    <!-- PUISSANCE & RESISTANCES FIXES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_pui.png" alt="" class="class-icon" />
                            <strong>Puissance &amp; Puissance Pièges</strong>
                        </td>
                        <td>+1 Pui (2)</td>
                        <td>+3 Pui (6)</td>
                        <td>+10 Pui (20)</td>
                        <td class="font-mono">2</td>
                        <td>+50 Pui (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_re.png" alt="" class="class-icon" />
                            <strong>Résistances Fixes, Ré Crit, Ré Poussée</strong>
                        </td>
                        <td>+1 Ré (2)</td>
                        <td>+3 Ré (6)</td>
                        <td>-</td>
                        <td class="font-mono">2</td>
                        <td>+50 Ré (100 PWR)</td>
                    </tr>

                    <!-- STATS ELEMENTAIRES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_elements.png" alt="" class="class-icon" />
                            <strong>Force, Intelligence, Chance, Agilité</strong>
                        </td>
                        <td>+1 (1)</td>
                        <td>+3 (3)</td>
                        <td>+10 (10)</td>
                        <td class="font-mono">1</td>
                        <td>+101 Stat (101 PWR)</td>
                    </tr>

                    <!-- STATS SOUS-UNITAIRES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_vi.png" alt="" class="class-icon" />
                            <strong>Vitalité</strong>
                        </td>
                        <td>+5 Vi (1)</td>
                        <td>+15 Vi (3)</td>
                        <td>+50 Vi (10)</td>
                        <td class="font-mono">0.2</td>
                        <td>+505 Vi (101 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_pod.png" alt="" class="class-icon" />
                            <strong>Pods</strong>
                        </td>
                        <td>+10 Pod (2.5)</td>
                        <td>+30 Pod (7.5)</td>
                        <td>+100 Pod (25)</td>
                        <td class="font-mono">0.25</td>
                        <td>+404 Pods (101 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ini.png" alt="" class="class-icon" />
                            <strong>Initiative</strong>
                        </td>
                        <td>+10 Ini (1)</td>
                        <td>+30 Ini (3)</td>
                        <td>+100 Ini (10)</td>
                        <td class="font-mono">0.1</td>
                        <td>+1010 Ini (101 PWR)</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>4. Overmax, Exotisme et Transcendance</h2>
        <p>
            Trois mécanismes permettent d'amener un équipement au-delà de ses statistiques de base :
        </p>

        <!-- Schéma Règle des 101 PWR -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                La règle des 101 de densité (PWR)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">1. L'Over</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Dépasser le jet maximal naturel d'une caractéristique présente sur l'objet. La valeur de dépassement ne peut pas excéder <strong>101 de densité</strong> (ex: maximum +505 Vitalité ou +101 Force).
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">2. L'Exotisme (Exo)</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Ajouter une caractéristique absente nativement de l'objet (ex: +1 PA sur un Anneau Volkorne). Taux de passage bloqué à <strong>1% SC fixe</strong>.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">3. La Transcendance</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Rune spéciale appliquée à <strong>100% de réussite</strong>, mais qui <strong>verrouille définitivement l'objet</strong> contre toute forgemagie ultérieure.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-important">
            <strong>Conditions d'application de la Rune de Transcendance</strong>
            <p>
                Pour pouvoir poser une Rune de Transcendance, l'équipement <strong>ne doit posséder aucun over et aucun exo préalable</strong> (jet naturel parfait au maximum). De plus, l'apport de la transcendance ne doit pas faire dépasser le plafond de 100 de densité totale d'over sur la caractéristique ciblée.
            </p>
        </div>

        <div class="callout callout-tip">
            <strong>Technique du lissage d'over à la rune Pod</strong>
            <p>
                Si votre équipement dépasse légèrement son jet max (par exemple 203 Vitalité sur un objet à 200 max) et empêche la pose d'une Transcendance, utilisez une petite <strong>Rune Pod (2.5 PWR)</strong> en échec volontaire. L'échec retirera environ 12 à 13 Vitalité sans toucher aux autres lignes, ramenant l'objet sous le seuil pour valider la Transcendance.
            </p>
        </div>

        <h2>5. Les 3 Profils d'Équipements à Forgemager</h2>
        <p>
            Selon les statistiques d'origine de l'objet, la stratégie de forgemagie diffère :
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 text-xs">
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Items à puits naturel</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    Objets dotés d'un PA, PM ou PO naturel. On fait sauter la grosse ligne pour sécuriser un puits massif (51 à 100), on monte les jets parfaits et l'over, puis on replace la stat lourde en SC.
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Items à concessions</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    Objets sans caractéristique très lourde. Pour maxer les caractéristiques principales, il est souvent nécessaire de <strong>sacrifier une ligne secondaire</strong> peu utile (ex: sacrifier le Soin ou la Prospection).
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Items à brisage forcé</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    Sur des objets très lourds sans puits naturel, tenter un Exo PA (1%), puis le faire sauter volontairement pour s'offrir un <strong>puits artificiel de 100</strong> afin de perfectionner le jet.
                </p>
            </div>
        </div>

        <h2>6. Formule d'XP Métier</h2>
        <p>
            L'expérience engrangée à chaque tentative dépend directement du niveau de l'objet et du poids de la rune :
        </p>
        <p class="font-mono text-sm p-3 rounded-lg border border-border bg-surface my-2">
            XP Métier = Niveau de l'équipement × Poids unitaire (PWR) de la rune
        </p>
        <p class="text-xs text-muted-foreground">
            Pour progresser économiquement jusqu'au niveau 200 : privilégiez les runes de densité 3 à 5 (Sagesse, Fuite, Tacle, Dommages élémentaires) et changez d'équipement tous les 15 à 20 niveaux de métier.
        </p>
    `,
};
