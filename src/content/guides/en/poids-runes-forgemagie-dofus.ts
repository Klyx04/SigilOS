export const guide = {
    slug: "poids-runes-forgemagie-dofus",
    title: "Rune Weight & Ultimate Smithmagic Guide on Dofus (2026)",
    description:
        "Official complete rune weight (PWR) table, residual (well) mechanics, roll priorities, over-maging, exoticism and transcendence on Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Dofus Unity Update (2026)</strong>
            <p>On Dofus Unity (Dofus 3), <strong>residual well points are now displayed natively in real-time inside the Smithmagic interface</strong>. You no longer need to calculate it manually on paper! However, mastering how this residual is generated, consumed, and prioritized remains the absolute secret to succeeding in perfect rolls, over-maging, and exoticism.</p>
        </div>

        <p>
            Smithmagic (FM) is one of the pillars of the economy and high-end optimization on Dofus. Whether you want to craft a perfect roll, land a massive <strong>Vitality Over</strong>, secure an <strong>AP/MP/Range Exo</strong>, or apply a <strong>Transcendence Rune</strong>, mastering <strong>rune weight (density or PWR)</strong> is essential to avoid wasting millions of kamas.
        </p>

        <h2>1. The 3 Core Pillars of Smithmagic</h2>
        <p>
            Every smithmagic attempt follows a strict mathematical balance governed by three foundational mechanics: <strong>the outcome</strong>, <strong>the priority</strong>, and <strong>the residual</strong>.
        </p>

        <h3>A. The Attempt Outcome</h3>
        <p>
            When a rune is applied to an item, three outcomes are possible:
        </p>
        <ul>
            <li><strong>Critical Success (CS):</strong> The rune lands cleanly. No stat drops and no residual points are consumed.</li>
            <li><strong>Neutral Success (NS):</strong> The rune lands, but the game deducts a value equal to its weight from the available residual well, or lowers other stats on the item to balance the insertion.</li>
            <li><strong>Critical Failure (CF):</strong> The rune fails, and residual points or existing stats are lost.</li>
        </ul>

        <div class="callout callout-warning">
            <strong>The Golden Rule for Heavy Exos (AP / MP / Range)</strong>
            <p>For any rune with a unit weight <strong>above 20 PWR</strong> attempted on an item that does not naturally possess that stat (Exoticism), <strong>Neutral Success does not exist</strong>! The Critical Success chance is strictly locked at <strong>1% flat</strong> per attempt, regardless of your job level.</p>
        </div>

        <h3>B. Stat &amp; Rune Priority</h3>
        <p>
            Not all runes have the same success rate. The Critical Success chance of any attempt depends on three factors:
        </p>
        <ol class="steps">
            <li><strong>Total item weight:</strong> The heavier an item's current stats relative to its natural maximum, the harder it is for runes to land as Critical Success.</li>
            <li><strong>Stat completion threshold:</strong> As a stat approaches 100% of its natural maximum, its critical success rate drops sharply. It is always much easier to bring all low lines up together rather than maxing out one single stat line in isolation.</li>
            <li><strong>Rune tier (Normal vs Pa vs Ra):</strong> Once a stat reaches medium-to-high values on an item, medium (Pa) and superior (Ra) runes enjoy significantly better landing rates than basic runes.</li>
        </ol>

        <h3>C. The Residual (Well): The Invisible Engine</h3>
        <p>
            When a rune causes a heavy stat to drop (or break upon failure), the game stores a <strong>residual well</strong> equal to the density difference:
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-emerald-400 border border-zinc-800">
            Residual generated = Density of dropped stat - Density of inserted rune
        </p>
        <p>
            <em>Concrete Example:</em> You attempt a <strong>Pa Int Rune</strong> (weight 3) on an amulet, and the <strong>Summons</strong> line (weight 30) drops on a Neutral Success. The calculation is instant:
        </p>
        <p>
            <strong>30 - 3 = +27 available residual points.</strong>
        </p>
        <p>
            This 27-point pool acts as an absolute buffer: you can make successive attempts until these 27 points are exhausted without any other stat dropping on neutral successes or critical failures!
        </p>

        <h2>2. Official Rune Weight &amp; Theoretical Over Max Table (Dofus Unity 2026)</h2>
        <p>
            Here is the complete and official reference table for unit weights (PWR) across all runes in Dofus, along with the theoretical maximum over-roll (based on the official cap of <strong>101 maximum density</strong>):
        </p>

        <div class="overflow-x-auto my-6">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-zinc-700 bg-zinc-900/80">
                        <th class="p-3">Characteristic</th>
                        <th class="p-3">Simple Rune</th>
                        <th class="p-3">Pa Rune</th>
                        <th class="p-3">Ra Rune</th>
                        <th class="p-3">PWR / unit</th>
                        <th class="p-3 text-amber-400 font-bold">Over Max</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800 text-sm">
                    <!-- AP / MP / RANGE -->
                    <tr class="bg-rose-950/20">
                        <td class="p-3 font-semibold text-rose-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ga_pa.png" alt="Ap Ga" class="w-6 h-6 object-contain" />
                                Action Point (Ap Ga)
                            </div>
                        </td>
                        <td class="p-3">+1 AP (100 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-rose-400">100</td>
                        <td class="p-3 font-bold text-amber-400">+1 AP</td>
                    </tr>
                    <tr class="bg-emerald-950/20">
                        <td class="p-3 font-semibold text-emerald-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ga_pme.png" alt="Mp Ga" class="w-6 h-6 object-contain" />
                                Movement Point (Mp Ga)
                            </div>
                        </td>
                        <td class="p-3">+1 MP (90 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-emerald-400">90</td>
                        <td class="p-3 font-bold text-amber-400">+1 MP</td>
                    </tr>
                    <tr class="bg-amber-950/20">
                        <td class="p-3 font-semibold text-amber-300">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_po.png" alt="Range" class="w-6 h-6 object-contain" />
                                Range
                            </div>
                        </td>
                        <td class="p-3">+1 Range (51 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono font-bold text-amber-400">51</td>
                        <td class="p-3 font-bold text-amber-400">+1 Range</td>
                    </tr>

                    <!-- SUMMONS & GENERIC DAMAGE -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_invo.png" alt="Sum" class="w-6 h-6 object-contain" />
                                Summons
                            </div>
                        </td>
                        <td class="p-3">+1 Sum (30 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">30</td>
                        <td class="p-3 font-semibold text-amber-400">+3 Sum</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do.png" alt="Dam" class="w-6 h-6 object-contain" />
                                Damage (Generic flat)
                            </div>
                        </td>
                        <td class="p-3">+1 Dam (20 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">20</td>
                        <td class="p-3 font-semibold text-amber-400">+5 Dam</td>
                    </tr>

                    <!-- SPECIALIZED % -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do_per.png" alt="% Dam" class="w-6 h-6 object-contain" />
                                % Spell / Weapon / Ranged / Melee Dam
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
                                <img src="/images/guides/fm/rune_re_per_di_me.png" alt="% Ranged/Melee Res" class="w-6 h-6 object-contain" />
                                % Ranged Res / % Melee Res
                            </div>
                        </td>
                        <td class="p-3">+1% (15 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">15</td>
                        <td class="p-3 font-semibold text-amber-400">+6 %</td>
                    </tr>

                    <!-- HEALS & CRITICAL -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_soin.png" alt="Hea" class="w-6 h-6 object-contain" />
                                Heals
                            </div>
                        </td>
                        <td class="p-3">+1 Hea (10 PWR)</td>
                        <td class="p-3">+3 Hea (30 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">10</td>
                        <td class="p-3 font-semibold text-amber-400">+10 Hea</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_cri.png" alt="Crit" class="w-6 h-6 object-contain" />
                                % Critical Hit (% Crit)
                            </div>
                        </td>
                        <td class="p-3">+1% Crit (10 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">10</td>
                        <td class="p-3 font-semibold text-amber-400">+10 %</td>
                    </tr>

                    <!-- AP / MP REDUCTION & LOSS RES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_ret_pa.png" alt="Ap Red" class="w-6 h-6 object-contain" />
                                <img src="/images/guides/fm/rune_esq_pa.png" alt="Ap Res" class="w-6 h-6 object-contain" />
                                AP / MP Reduction &amp; Loss Res
                            </div>
                        </td>
                        <td class="p-3">+1 (7 PWR)</td>
                        <td class="p-3">+3 (21 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">7</td>
                        <td class="p-3 font-semibold text-amber-400">+14</td>
                    </tr>

                    <!-- % ELEMENTAL RESISTANCE -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_prc_re.png" alt="% Res" class="w-6 h-6 object-contain" />
                                % Resistance (Neutral, Earth, Fire, Water, Air)
                            </div>
                        </td>
                        <td class="p-3">+1% Res (6 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">6</td>
                        <td class="p-3 font-semibold text-amber-400">+16 %</td>
                    </tr>

                    <!-- ELEMENTAL DAMAGE, CRIT, PUSHBACK, TRAP -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_do_elements.png" alt="Elem Dam" class="w-6 h-6 object-contain" />
                                Elemental Dam, Crit Dam, Pushback Dam, Traps
                            </div>
                        </td>
                        <td class="p-3">+1 Dam (5 PWR)</td>
                        <td class="p-3">+3 Dam (15 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">5</td>
                        <td class="p-3 font-semibold text-amber-400">+20 Dam</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_renv.png" alt="Dam Ref" class="w-6 h-6 object-contain" />
                                Damage Reflected &amp; Hunting Weapon
                            </div>
                        </td>
                        <td class="p-3">+1 Ref / Hunt (5 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">5</td>
                        <td class="p-3 font-semibold text-amber-400">+20</td>
                    </tr>

                    <!-- DODGE & LOCK -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_fui_tac.png" alt="Dodge/Lock" class="w-6 h-6 object-contain" />
                                Dodge &amp; Lock
                            </div>
                        </td>
                        <td class="p-3">+1 (4 PWR)</td>
                        <td class="p-3">+3 (12 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">4</td>
                        <td class="p-3 font-semibold text-amber-400">+25</td>
                    </tr>

                    <!-- WISDOM & PROSPECTING -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_sa.png" alt="Wis" class="w-6 h-6 object-contain" />
                                Wisdom
                            </div>
                        </td>
                        <td class="p-3">+1 Wis (3 PWR)</td>
                        <td class="p-3">+3 Wis (9 PWR)</td>
                        <td class="p-3">+10 Wis (30 PWR)</td>
                        <td class="p-3 font-mono">3</td>
                        <td class="p-3 font-semibold text-amber-400">+33 Wis</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_prospe.png" alt="Pp" class="w-6 h-6 object-contain" />
                                Prospecting
                            </div>
                        </td>
                        <td class="p-3">+1 Pp (3 PWR)</td>
                        <td class="p-3">+3 Pp (9 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">3</td>
                        <td class="p-3 font-semibold text-amber-400">+33 Pp</td>
                    </tr>

                    <!-- POWER & FLAT RESISTANCES -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_pui.png" alt="Pow" class="w-6 h-6 object-contain" />
                                Power &amp; Trap Power
                            </div>
                        </td>
                        <td class="p-3">+1 Pow (2 PWR)</td>
                        <td class="p-3">+3 Pow (6 PWR)</td>
                        <td class="p-3">+10 Pow (20 PWR)</td>
                        <td class="p-3 font-mono">2</td>
                        <td class="p-3 font-semibold text-amber-400">+50 Pow</td>
                    </tr>
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_re.png" alt="Flat Res" class="w-6 h-6 object-contain" />
                                Flat Res, Crit Res, Pushback Res
                            </div>
                        </td>
                        <td class="p-3">+1 Res (2 PWR)</td>
                        <td class="p-3">+3 Res (6 PWR)</td>
                        <td class="p-3">-</td>
                        <td class="p-3 font-mono">2</td>
                        <td class="p-3 font-semibold text-amber-400">+50 Res</td>
                    </tr>

                    <!-- ELEMENTAL STATS -->
                    <tr>
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_elements.png" alt="Stats" class="w-6 h-6 object-contain" />
                                Elemental Stats (Strength, Intel, Chance, Agi)
                            </div>
                        </td>
                        <td class="p-3">+1 Stat (1 PWR)</td>
                        <td class="p-3">+3 Stat (3 PWR)</td>
                        <td class="p-3">+10 Stat (10 PWR)</td>
                        <td class="p-3 font-mono">1</td>
                        <td class="p-3 font-semibold text-amber-400">+101 Stat</td>
                    </tr>

                    <!-- SUB-UNIT STATS -->
                    <tr class="bg-zinc-900/40">
                        <td class="p-3 font-medium">
                            <div class="flex items-center gap-2">
                                <img src="/images/guides/fm/rune_vi.png" alt="Vit" class="w-6 h-6 object-contain" />
                                Vitality
                            </div>
                        </td>
                        <td class="p-3">+5 Vit (1 PWR)</td>
                        <td class="p-3">+15 Vit (3 PWR)</td>
                        <td class="p-3">+50 Vit (10 PWR)</td>
                        <td class="p-3 font-mono">0.2 <span class="text-zinc-500 text-xs">(1 PWR = 5 Vit)</span></td>
                        <td class="p-3 font-semibold text-amber-400">+505 Vit</td>
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

        <h2>3. The 3 Profiles of Gear to Smithmage</h2>
        <p>
            Depending on an item's base stat profile, your smithmaging strategy will differ significantly. There are 3 main gear families:
        </p>

        <h3>1. Concession Items</h3>
        <p>
            These items feature no heavy stat (no AP, MP, or Range) to provide a large safety well. To reach top-tier numbers on your primary stats, you must deliberately <strong>sacrifice an unneeded secondary line</strong> (e.g. sacrificing Heals or Prospecting on a Strigide Belt to maximize Critical Resistance and Vitality).
        </p>

        <h3>2. Well Items (The Optimal Path)</h3>
        <p>
            These are items endowed with a natural AP, MP, or Range line (e.g. Koutoulou Amulet, Sinistrofu Cloak).
        </p>
        <p>
            <strong>The Step-by-Step Method:</strong>
        </p>
        <ol class="steps">
            <li>Work on the item until the heavy stat drops (e.g. -1 AP = <strong>100 residual points</strong>).</li>
            <li>With 100 weight lifted off the item, it absorbs lower runes with remarkable ease. Bring all other stats to perfect rolls and push a clean over (e.g. Over Vitality).</li>
            <li>Once the residual is exhausted and other stats are pristine, replace the heavy rune (Ap Ga or Mp Ga) and aim for the Critical Success!</li>
        </ol>

        <h3>3. Forced-Break Items</h3>
        <p>
            On very heavy gear without a natural well stat (e.g. Dragonegg Helmet), expert smithmagi perform a "forced break": they attempt an <strong>AP or MP Exo</strong>. Once it lands, they deliberately knock it off with other runes to harvest an artificial well of 90 or 100 density, unlocking an otherwise impossible near-perfect roll.
        </p>

        <h2>4. Overmax, Exoticism, and Transcendence</h2>
        <p>
            When is an item truly completed? There are three main final milestones:
        </p>
        <ul>
            <li><strong>The Over:</strong> Exceeding the natural maximum of a characteristic already present on the item. The game engine caps total over at <strong>101 maximum density</strong> (e.g. maximum +505 Vitality or +101 Strength).</li>
            <li><strong>Exoticism (Exo):</strong> Adding a stat that is not naturally on the base item (e.g. +1 AP on a Volkorne Ring). Exotic stats are capped at 101 cumulative density. The Critical Success chance for heavy AP, MP, or Range exos is locked at <strong>1% flat (CS)</strong>.</li>
            <li><strong>The Transcendence Rune:</strong> A special rune with a <strong>100% success rate</strong> that finalizes the item, but <strong>permanently locks it</strong> from any future smithmagic.</li>
        </ul>

        <div class="callout callout-important">
            <strong>Strict Conditions for Transcendence Runes</strong>
            <p>To apply a Transcendence Rune, the item <strong>must have zero prior over and zero exotic stats</strong> (at most a natural perfect roll). Furthermore, the transcendence stat must not exceed the 100 total over density ceiling on that line.</p>
        </div>

        <div class="callout callout-tip">
            <strong>Pro Tip: Smoothing Out an Over</strong>
            <p>If your item accidentally exceeds its maximum roll (e.g. 213 Vitality on an item capped at 200) and blocks you from applying a Transcendence Rune, deliberately fail a low <strong>Pod Rune (2.5 PWR)</strong>. The failure will chip away roughly 13 Vitality without hurting other lines, bringing you back to a crisp 200/200 ready for Transcendence!</p>
        </div>

        <h2>5. Fast-Tracking Smithmagus Job Leveling</h2>
        <p>
            Job experience gained on each rune attempt follows a straightforward formula:
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-cyan-400 border border-zinc-800">
            Job XP = Item Level × Unit Rune Density
        </p>
        <p>
            To power-level your Smithmagus professions (Shoemagus, Tailormagus, Jewellermagus, etc.) cost-effectively:
        </p>
        <ol class="steps">
            <li><strong>Monitor Marketplace Price / Density ratios:</strong> Spot runes that offer high density at low unit prices (typically Wisdom, Elemental Damage, Prospecting, or Dodge/Lock).</li>
            <li><strong>Upgrade your target item every 15 to 20 levels:</strong> Higher item levels act as direct XP multipliers per attempt.</li>
            <li><strong>Fuse your runes at the crusher:</strong> 3 normal runes = 1 Pa rune; 3 Pa runes = 1 Ra rune. Pa and Ra runes deliver 3x and 10x more XP per click while boasting high landing rates on mid-range rolls.</li>
        </ol>
    `,
};
