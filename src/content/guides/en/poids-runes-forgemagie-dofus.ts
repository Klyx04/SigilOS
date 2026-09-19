export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Rune Weight & Ultimate Smithmagic Guide on Dofus (2026)",
    description:
        "Complete weight (PWR) table for every Smithmagic rune, the rules of the well/residual, over-rolling, exoticism and Smithmagic tips.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <p>
            Smithmagic (FM) is one of the pillars of economy and optimisation on Dofus. Whether you want to land an Over Vita, an AP/MP/Range Exo or simply bring an item's stats back up after a mediocre roll, mastering <strong>rune weight (PWR)</strong> and the <strong>well (residual)</strong> mechanic is essential.
        </p>

        <h2>The Foundations: How Does Smithmagic Work?</h2>
        <p>
            Every attempt to apply a rune to an item consumes an invisible value calculated from the <strong>rune's weight</strong>. When a rune is attempted, three outcomes are possible:
        </p>
        <ul>
            <li><strong>Critical Success (CS):</strong> the rune lands perfectly, no stat drops and no well is consumed.</li>
            <li><strong>Neutral Success (NS):</strong> the rune lands, but stats or well points are consumed to offset the weight of the injected rune.</li>
            <li><strong>Critical Failure (CF):</strong> the rune fails, and stats or well points are lost.</li>
        </ul>

        <h2>Rune Weight Reference Table (PWR)</h2>
        <p>
            Here is the reference grid for the official rune weights in Dofus:
        </p>

        <table>
            <thead>
                <tr>
                    <th>Characteristic</th>
                    <th>Rune</th>
                    <th>Pa Rune</th>
                    <th>Ra Rune</th>
                    <th>Unit Weight (PWR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_vi.png" alt="Vit" class="w-6 h-6 object-contain" />
                            <strong>Vitality</strong>
                        </div>
                    </td>
                    <td>+5 Vit (1 PWR)</td>
                    <td>+15 Vit (3 PWR)</td>
                    <td>+50 Vit (10 PWR)</td>
                    <td>0.2 per point <span class="text-zinc-400 text-xs">(1 PWR = 5 Vit)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pa_fo.png" alt="Str/Int/Cha/Agi" class="w-6 h-6 object-contain" />
                            <strong>Elemental stats</strong>
                            <span class="text-xs text-zinc-400">(Str, Int, Cha, Agi)</span>
                        </div>
                    </td>
                    <td>+1 stat (1 PWR)</td>
                    <td>+3 stat (3 PWR)</td>
                    <td>+10 stat (10 PWR)</td>
                    <td>1 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_sa.png" alt="Wis" class="w-6 h-6 object-contain" />
                            <strong>Wisdom</strong>
                        </div>
                    </td>
                    <td>+1 Wis (3 PWR)</td>
                    <td>+3 Wis (9 PWR)</td>
                    <td>+10 Wis (30 PWR)</td>
                    <td>3 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pui.png" alt="Pow" class="w-6 h-6 object-contain" />
                            <strong>Prospecting / Power</strong>
                        </div>
                    </td>
                    <td>+1 Pp (3 PWR) / +1 Pow (2 PWR)</td>
                    <td>+3 Pp (9 PWR) / +3 Pow (6 PWR)</td>
                    <td>+10 Pp (30 PWR) / +10 Pow (20 PWR)</td>
                    <td>3 (Prospecting) / 2 (Power)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_do.png" alt="Dam" class="w-6 h-6 object-contain" />
                            <strong>Elemental / flat damage</strong>
                        </div>
                    </td>
                    <td>+1 Dam (5 PWR)</td>
                    <td>+3 Dam (15 PWR)</td>
                    <td>-</td>
                    <td>5 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_soin.png" alt="Hea" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_esq_pa.png" alt="Dod" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_ret_pa.png" alt="Red" class="w-6 h-6 object-contain" />
                            <strong>Heals / Dodges / Reductions</strong>
                        </div>
                    </td>
                    <td>+1 Hea/Dod/Red (10 PWR)</td>
                    <td>+3 (30 PWR)</td>
                    <td>-</td>
                    <td>7 (Heals) / 7 (Reduction/Dodge)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_re.png" alt="Res" class="w-6 h-6 object-contain" />
                            <img src="/images/guides/fm/rune_prc_re.png" alt="Res %" class="w-6 h-6 object-contain" />
                            <strong>Flat Resistances &amp; Resistance %</strong>
                        </div>
                    </td>
                    <td>+1 flat Res (2 PWR) / +1% Res (6 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>2 (flat) / 6 (Res %)</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_cri.png" alt="Cri" class="w-6 h-6 object-contain" />
                            <strong>Critical Hits (% Crit)</strong>
                        </div>
                    </td>
                    <td>+1% Crit (10 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>10 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_renv.png" alt="Ref" class="w-6 h-6 object-contain" />
                            <strong>Reflected Damage</strong>
                        </div>
                    </td>
                    <td>+1 Ref (10 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>10 per point</td>
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
                    <td>0.1 per point <span class="text-zinc-400 text-xs">(1 PWR = 10 Ini)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_pod.png" alt="Pod" class="w-6 h-6 object-contain" />
                            <strong>Pods</strong>
                        </div>
                    </td>
                    <td>+10 Pod (1 PWR)</td>
                    <td>+30 Pod (3 PWR)</td>
                    <td>+100 Pod (10 PWR)</td>
                    <td>0.1 per point <span class="text-zinc-400 text-xs">(1 PWR = 10 Pod)</span></td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_invo.png" alt="Sum" class="w-6 h-6 object-contain" />
                            <strong>Summons</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-cyan-400">+1 Sum</span> (30 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>30 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_po.png" alt="Range Rune" class="w-6 h-6 object-contain" />
                            <strong>Range</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-amber-400">+1 Range</span> (51 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>51 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_ga_pme.png" alt="Mp Ga Rune" class="w-6 h-6 object-contain" />
                            <strong>Movement Point (MP)</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-emerald-400">+1 MP</span> (90 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>90 per point</td>
                </tr>
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="/images/guides/fm/rune_ga_pa.png" alt="Ap Ga Rune" class="w-6 h-6 object-contain" />
                            <strong>Action Point (AP)</strong>
                        </div>
                    </td>
                    <td><span class="font-bold text-rose-400">+1 AP</span> (100 PWR)</td>
                    <td>-</td>
                    <td>-</td>
                    <td>100 per point</td>
                </tr>
            </tbody>
        </table>

        <h2>The Crucial Notion of the Well (Residual)</h2>
        <p>
            When a heavy characteristic (such as an AP, an MP or Range) drops during a failure or a neutral success, it generates a <strong>residual well</strong>. That well is exactly equal to the PWR value of the lost stat.
        </p>
        <p>
            <em>Example:</em> if an amulet's AP drops, you have a <strong>100 PWR</strong> well available. You can then bring all the secondary stats back up (Vitality, Damage, Resistances) with no collateral loss as long as the well is not exhausted!
        </p>

        <h2>Over-max and Exoticism (Exo)</h2>
        <p>
            An <strong>Over</strong> means exceeding an item's natural maximum roll (e.g. pushing to +350 Vita on an item that gives 300 max). An <strong>Exo</strong> means adding a characteristic the item does not have (e.g. +1 AP or +1% Res).
        </p>
        <ul>
            <li>The theoretical maximum total of Over or Exo is capped at <strong>101 total weight</strong> per item.</li>
            <li>The landing rate of an Exo AP (100 PWR) or MP (90 PWR) on an item with no natural well is <strong>1% chance (CS)</strong> per attempt.</li>
        </ul>
    `,
};
