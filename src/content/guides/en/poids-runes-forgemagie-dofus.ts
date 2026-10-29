export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Dofus Rune Weight Guide: Table & Sink FM",
    description:
        "Official reference table for rune weights (PWR), sink rules (reliquat), calculating overmaging, 1% SC exo mages, and transcendence runes on Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
    draft: false,
    badgeColor: "amber",
    body: `
        <div class="callout callout-tip">
            <strong>Dofus Unity Update (Modern Smithmagic Interface)</strong>
            <p>
                In Dofus Unity, <strong>the remaining sink (puits) displays directly inside the smithmagic interface</strong> in real time. Keeping manual notes on scratchpads is no longer required. However, understanding how sink is produced, consumed, and preserved remains the essential skill to master perfect rolls, overmaging, and exotic mages.
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
            <span class="guide-caption">Noble smithmagic runes — primary sources of sink generation (reliquat)</span>
        </div>

        <h2>1. The 3 Rune Mage Attempt Outcomes</h2>
        <p>
            With every single rune application attempt, the anvil produces one of three distinct outcomes dictated by internal probabilities:
        </p>

        <!-- Diagram 3 Outcomes -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Diagram — The 3 Smithmagic Outcomes
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">Critical Success (CS)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        The rune successfully attaches. <strong>No other characteristic is lowered</strong> and <strong>zero sink points are consumed</strong>.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit">Neutral Success (NS)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        The rune attaches, but the engine extracts equivalent weight value by <strong>consuming available sink</strong> or lowering other stat lines.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit">Critical Failure (CF)</span>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        The rune fails to attach. In addition, <strong>stored sink or item characteristics are destroyed</strong> to absorb the shock of failure.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-warning">
            <strong>Golden Rule for Heavy Exos (AP, MP, Range)</strong>
            <p>
                For any rune whose unit density is <strong>greater than 20 PWR</strong> attempted on an item that lacks it naturally (AP, MP, or Range Exo), <strong>Neutral Success does not exist</strong>.
            </p>
            <p class="mt-2 text-xs">
                The Critical Success chance is <strong>strictly locked at 1%</strong> per attempt, regardless of profession level. Any attempt that fails to hit CS results in a Critical Failure that damages stats or burns sink.
            </p>
        </div>

        <h2>2. Sink (Puits FM) and its Formula</h2>
        <p>
            The <strong>sink</strong> is an energy buffer pool created whenever a heavy characteristic drops or gets knocked off. This reservoir cushions stat losses during future attempts, shielding the rest of the item's statistics.
        </p>

        <!-- Diagram Natural Sink Cycle -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Optimization Cycle with Natural Sink
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent/10 text-accent border border-accent/20 w-fit">01</span>
                    <strong class="text-foreground text-sm">Heavy stat loss</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">-1 AP creates up to +100 units of available sink</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit">02</span>
                    <strong class="text-foreground text-sm">Safe tuning phase</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">The sink absorbs losses without eroding other characteristics</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">03</span>
                    <strong class="text-foreground text-sm">Perfect rolls &amp; over</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">Maxing base lines and placing the targeted over</span>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">04</span>
                    <strong class="text-foreground text-sm">CS Reinsertion</strong>
                    <span class="text-muted-foreground text-xs leading-relaxed">Reinserting the heavy rune with a Critical Success</span>
                </div>
            </div>
        </div>

        <h3>Mathematical Formula for Sink Generation</h3>
        <p class="font-mono text-sm p-3 rounded-lg border border-border bg-surface my-2">
            Generated Sink = Density of Lost Characteristic - Density of Inserted Rune
        </p>

        <ul class="space-y-1.5 my-3 text-xs">
            <li>
                <span><strong>AP Drop:</strong> Inserting an Intelligence rune (1 PWR) that drops the native AP on NS: <code>100 - 1 = +99 sink</code>.</span>
            </li>
            <li>
                <span><strong>Summon Drop:</strong> Inserting a Pa Vitality rune (3 PWR) that drops the Summon line on NS: <code>30 - 3 = +27 sink</code>.</span>
            </li>
            <li>
                <span><strong>Range Drop:</strong> Inserting a Damage rune (20 PWR) that drops the native Range on NS: <code>51 - 20 = +31 sink</code>.</span>
            </li>
        </ul>

        <h2>3. Official Rune Weight Table &amp; Theoretical Overmax</h2>
        <p>
            Here is the official reference grid for unit weights (PWR) across all Dofus runes, including the theoretical over ceiling (calculated by the <strong>101 density cap</strong> rule):
        </p>

        <div class="overflow-x-auto my-6">
            <table>
                <thead>
                    <tr>
                        <th>Characteristic</th>
                        <th>Simple Rune</th>
                        <th>Pa Rune</th>
                        <th>Ra Rune</th>
                        <th>Weight / unit</th>
                        <th>Max Theoretical Over</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- RUNES MAJEURES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ga_pa.png" alt="" class="class-icon" />
                            <strong>Action Point (Ga PA)</strong>
                        </td>
                        <td>+1 AP (100)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">100</td>
                        <td><strong>+1 AP</strong> (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ga_pme.png" alt="" class="class-icon" />
                            <strong>Movement Point (Ga PME)</strong>
                        </td>
                        <td>+1 MP (90)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">90</td>
                        <td><strong>+1 MP</strong> (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_po.png" alt="" class="class-icon" />
                            <strong>Range (PO)</strong>
                        </td>
                        <td>+1 Range (51)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono font-bold">51</td>
                        <td><strong>+1 Range</strong> (51 PWR)</td>
                    </tr>

                    <!-- INVO & DO -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_invo.png" alt="" class="class-icon" />
                            <strong>Summons</strong>
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
                            <strong>Flat Damage</strong>
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
                            <strong>% Spell, Weapon, Ranged, Melee Damage</strong>
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
                            <strong>% Ranged, Melee Resistance</strong>
                        </td>
                        <td>+1% Res (15)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">15</td>
                        <td>+6% Res (90 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_soin.png" alt="" class="class-icon" />
                            <strong>Heals</strong>
                        </td>
                        <td>+1 Heal (10)</td>
                        <td>+3 Heal (30)</td>
                        <td>-</td>
                        <td class="font-mono">10</td>
                        <td>+10 Heal (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_cri.png" alt="" class="class-icon" />
                            <strong>% Critical Hit</strong>
                        </td>
                        <td>+1% Crit (10)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">10</td>
                        <td>+10% Crit (100 PWR)</td>
                    </tr>

                    <!-- RETRAIT & ESQUIVE -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_ret_pa.png" alt="" class="class-icon" />
                            <strong>AP &amp; MP Reduction</strong>
                        </td>
                        <td>+1 Red (7)</td>
                        <td>+3 Red (21)</td>
                        <td>-</td>
                        <td class="font-mono">7</td>
                        <td>+14 Red (98 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_esq_pa.png" alt="" class="class-icon" />
                            <strong>AP &amp; MP Parry</strong>
                        </td>
                        <td>+1 Parry (7)</td>
                        <td>+3 Parry (21)</td>
                        <td>-</td>
                        <td class="font-mono">7</td>
                        <td>+14 Parry (98 PWR)</td>
                    </tr>

                    <!-- RESISTANCES & DOMMAGES ELEMENTAIRES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_prc_re.png" alt="" class="class-icon" />
                            <strong>% Elemental Resistances</strong>
                        </td>
                        <td>+1% Res (6)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">6</td>
                        <td>+16% Res (96 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_do_elements.png" alt="" class="class-icon" />
                            <strong>Elemental, Crit, Pushback Damage</strong>
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
                            <strong>Reflected Damage</strong>
                        </td>
                        <td>+1 Refl (5)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">5</td>
                        <td>+20 Refl (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_chasse.png" alt="" class="class-icon" />
                            <strong>Hunting Weapon</strong>
                        </td>
                        <td>+1 Hunt (5)</td>
                        <td>-</td>
                        <td>-</td>
                        <td class="font-mono">5</td>
                        <td>+1 Hunt (5 PWR)</td>
                    </tr>

                    <!-- CARACTERISTIQUES MOYENNES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_fui_tac.png" alt="" class="class-icon" />
                            <strong>Dodge &amp; Lock</strong>
                        </td>
                        <td>+1 (4)</td>
                        <td>+3 (12)</td>
                        <td>-</td>
                        <td class="font-mono">4</td>
                        <td>+25 Dodge/Lock (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_sa.png" alt="" class="class-icon" />
                            <strong>Wisdom</strong>
                        </td>
                        <td>+1 Wis (3)</td>
                        <td>+3 Wis (9)</td>
                        <td>+10 Wis (30)</td>
                        <td class="font-mono">3</td>
                        <td>+33 Wis (99 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_prospe.png" alt="" class="class-icon" />
                            <strong>Prospecting</strong>
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
                            <strong>Power &amp; Trap Power</strong>
                        </td>
                        <td>+1 Pwr (2)</td>
                        <td>+3 Pwr (6)</td>
                        <td>+10 Pwr (20)</td>
                        <td class="font-mono">2</td>
                        <td>+50 Pwr (100 PWR)</td>
                    </tr>
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_re.png" alt="" class="class-icon" />
                            <strong>Fixed, Crit, Pushback Resistances</strong>
                        </td>
                        <td>+1 Res (2)</td>
                        <td>+3 Res (6)</td>
                        <td>-</td>
                        <td class="font-mono">2</td>
                        <td>+50 Res (100 PWR)</td>
                    </tr>

                    <!-- STATS ELEMENTAIRES -->
                    <tr>
                        <td>
                            <img src="/images/guides/fm/rune_elements.png" alt="" class="class-icon" />
                            <strong>Strength, Intelligence, Chance, Agility</strong>
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
                            <strong>Vitality</strong>
                        </td>
                        <td>+5 Vit (1)</td>
                        <td>+15 Vit (3)</td>
                        <td>+50 Vit (10)</td>
                        <td class="font-mono">0.2</td>
                        <td>+505 Vit (101 PWR)</td>
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

        <h2>4. Overmaging, Exotic Mages, and Transcendence</h2>
        <p>
            Three core techniques empower players to push gear statistics past their natural maxima:
        </p>

        <!-- Diagram 101 PWR Rule -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                The 101 Density Rule (PWR)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">1. Overmaging</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Exceeding the natural maximum roll of an existing characteristic on an item. The total overflow value cannot exceed <strong>101 density points</strong> (e.g., maximum +505 Vitality or +101 Strength).
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">2. Exotic Maging (Exo)</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Adding a foreign characteristic naturally absent from the item (e.g., +1 AP on a Volkorne Ring). Success rate is strictly locked at <strong>1% CS</strong>.
                    </p>
                </div>
                <div class="p-4 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                    <strong class="text-foreground text-sm">3. Transcendence</strong>
                    <p class="text-muted-foreground text-xs leading-relaxed m-0">
                        Special runes that attach with a <strong>100% success rate</strong>, but <strong>permanently lock the item</strong> against any further smithmagic modifications.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-important">
            <strong>Requirements for Transcendence Runes</strong>
            <p>
                To attach a Transcendence Rune, the item <strong>must carry zero prior over and zero exotic lines</strong> (at most a perfect natural roll). Additionally, the transcendence bonus must not cause the characteristic's total over to exceed the 100 density limit.
            </p>
        </div>

        <div class="callout callout-tip">
            <strong>Over Shaving Technique with Pod Runes</strong>
            <p>
                If an item slightly overshoots its natural ceiling (for instance 203 Vitality on a 200 max item) and blocks Transcendence, use a minor <strong>Pod Rune (2.5 PWR)</strong> to intentionally trigger a failure. The resulting loss strips roughly 12 to 13 Vitality without affecting other stats, dropping the item back into range.
            </p>
        </div>

        <h2>5. The 3 Item Profiles in Smithmagic</h2>
        <p>
            Depending on native characteristics, optimal smithmagic approaches differ:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 text-xs">
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Items with Natural Sink</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    Gear with native AP, MP, or Range. Knock off the heavy line to secure massive sink (51 to 100), perfect the base stats and over, then reinsert the heavy line via CS.
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Trade-off Items</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    Gear lacking heavy stats. To maximize core combat stats, it is often necessary to <strong>sacrifice secondary lines</strong> (such as Heals or Prospecting).
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface flex flex-col gap-2">
                <strong class="text-foreground text-sm">Forced Sink Items</strong>
                <p class="text-muted-foreground text-xs leading-relaxed m-0">
                    On demanding endgame items lacking natural sink, attempt an Exo AP (1%) and deliberately drop it to obtain an <strong>artificial 100 sink pool</strong> to polish all remaining rolls.
                </p>
            </div>
        </div>

        <h2>6. Profession XP Formula</h2>
        <p>
            Experience awarded per smithmagic attempt scales directly with item level and rune weight:
        </p>
        <p class="font-mono text-sm p-3 rounded-lg border border-border bg-surface my-2">
            Profession XP = Item Level × Rune Unit Weight (PWR)
        </p>
        <p class="text-xs text-muted-foreground">
            To progress cost-effectively to level 200: focus on runes with density between 3 and 5 (Wisdom, Dodge, Lock, Elemental Damage) and upgrade your training item every 15 to 20 profession levels.
        </p>
    `,
};
