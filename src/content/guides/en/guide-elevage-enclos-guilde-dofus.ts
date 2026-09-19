export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Dofus Breeder Guide — 2026 Edition (Unity 3.7)",
    description:
        "The complete 2026 Dofus breeding guide: capturing, making mounts fertile, breeding, levelling mounts through the Manger gauge, genealogy, Makinas, cloning and the 3.7 changes (500-slot stable, double-strength fuels).",
    publishedAt: "2026-08-17",
    updatedAt: "2026-09-18",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>2026 Edition — Dofus Unity 3.7+ (back-to-school update)</strong>
            <p>This guide covers breeding in full after the major <strong>Update 3.7</strong> changes: the stable extended to 500 slots, paddock gauges and catalyst efficiency doubled, fast bulk transfer, breeding filters and trophy markers for achievements.</p>
        </div>

        <div class="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.png" alt="The 3 mount families in Dofus" class="rounded-xl w-full max-h-[360px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">The 3 mount families: Dragoturkeys, Seemyools and Rhineetles — levels 1 to 200</span>
        </div>

        <h2>I. The 3 Mount Families</h2>
        <p>Dofus has <strong>3 mount species</strong>, each ranging from <strong>level 1 to 200</strong>:</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/dragodindes.png" alt="Dragoturkeys" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-amber-300 text-sm">Dragoturkeys</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>10 generations.</strong> Stat bonus depending on the coat (Vitality, Strength, Agility…). Ideal for mass breeding.</p>
                <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Dragoturkey stats" class="mt-2 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/muldos.png" alt="Seemyools" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-emerald-300 text-sm">Seemyools</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>6 generations.</strong> Bonus: +1 MP (level 100+). A single breeding per individual.</p>
                <img src="/images/guides/elevage/stats_muldos.jpg" alt="Seemyool stats" class="mt-2 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/volkornes.png" alt="Rhineetles" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-rose-300 text-sm">Rhineetles</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>4 generations.</strong> Bonus: +1 AP (level 100+). Highly sought after in PvP.</p>
                <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Rhineetle stats" class="mt-2 rounded border border-white/5 w-full" />
            </div>
        </div>

        <h2>II. Capturing a Wild Mount</h2>
        <div class="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <img src="/images/guides/elevage/filet_capture.png" alt="Capturing Net" class="w-20 h-20 object-contain shrink-0" />
            <div>
                <p class="text-sm text-zinc-300 leading-relaxed">
                    Buy a <strong>Capturing Net</strong> from the NPC Kito at the Breeder Village (<strong>[-17, 0]</strong>). Equip it and cast the <em>Mount Taming</em> spell before the killing blow on the wild mount in combat.
                </p>
                <ul class="text-xs text-zinc-400 mt-2 space-y-1">
                    <li>• <strong>Dragoturkeys:</strong> Koalak Mountain and surroundings.</li>
                    <li>• <strong>Seemyools:</strong> Sufokia (Depths).</li>
                    <li>• <strong>Rhineetles:</strong> Stubbyob territory.</li>
                </ul>
            </div>
        <h2>III. Paddocks & the Stable (3.7 Changes)</h2>
        <p>
            Mount XP and conditioning happen in <strong>paddocks</strong> (public or guild-owned).
            Even at <strong>level 1 of the Breeder profession</strong> you gain access to the <strong>Beginner Paddock</strong> at <strong>[-18, 0]</strong>.
            As you level the profession you unlock roomier paddocks and stronger catalysts.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/20">
                <strong class="text-cyan-300 text-sm block mb-1">🏠 Stable extended to 500 slots</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    Since <strong>Update 3.7</strong>, the maximum stable capacity goes from 250 to <strong>500 mounts</strong>, making bulk storage and complex family trees far easier to manage.
                </p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/20">
                <strong class="text-emerald-300 text-sm block mb-1">⚡ Bulk transfer & drag-and-drop</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    No more moving mounts one by one: you can move <strong>an entire paddock</strong> to another paddock or to the stable with a simple drag-and-drop, or through the quick-transfer option.
                </p>
            </div>
        </div>

        <div class="callout callout-info">
            <strong>How gauge consumption works</strong>
            <p>The gauge drains at the same rate whether the paddock holds one mount or several. Always fill it to the maximum allowed to get the most out of your catalysts!</p>
        </div>

        <h2>IV. The Gauges — Making a Mount Fertile</h2>
        <p>Before a mount can breed it must be <strong>Fertile</strong>. That means filling its <strong>Endurance</strong> and <strong>Love</strong> gauges, after first setting the <strong>Serenity</strong> gauge:</p>

        <table>
            <thead>
                <tr>
                    <th>Gauge</th>
                    <th>Required Serenity</th>
                    <th>Item / Catalyst</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Endurance</strong></td>
                    <td><span class="text-amber-400 font-bold">Negative</span> (&lt; 0)</td>
                    <td>Lightning Throwers</td>
                </tr>
                <tr>
                    <td><strong>Maturity</strong></td>
                    <td><span class="text-zinc-400 font-bold">Neutral</span> (-2000 to +2000)</td>
                    <td>Drinking Troughs</td>
                </tr>
                <tr>
                    <td><strong>Love</strong></td>
                    <td><span class="text-rose-400 font-bold">Positive</span> (&gt; 0)</td>
                    <td>Dragobutts</td>
                </tr>
                <tr>
                    <td><strong>XP (Manger)</strong></td>
                    <td>Any value</td>
                    <td>Manger catalysts (4 tiers)</td>
                </tr>
                <tr>
                    <td><strong>Serenity</strong></td>
                    <td>—</td>
                    <td>Slappers (lower) / Patters (raise)</td>
                </tr>
            </tbody>
        </table>

        <h2>V. XP & Catalysts — 3.7 Rework (Doubled Efficiency)</h2>
        <p>
            <strong>Update 3.7</strong> brought a huge quality-of-life boost to restocking:
        </p>
        <ul class="text-sm text-zinc-300 space-y-2 mb-4">
            <li>• <strong>Double yield:</strong> every catalyst that used to fill 3,000 points now fills <strong>6,000 points</strong>!</li>
            <li>• <strong>Gauge cap at 200,000 pts:</strong> total paddock capacity now reaches <strong>200,000 points</strong> (split into 20k, 40k, 60k or 80k segments depending on the paddock). You refill half as often.</li>
            <li>• <em>Market note:</em> the old Dragoturkey deposits can no longer be crafted and are bound to disappear for good.</li>
        </ul>

        <table>
            <thead>
                <tr><th>Tier</th><th>Catalyst</th><th>XP gained</th><th>Time before empty</th></tr>
            </thead>
            <tbody>
                <tr><td><strong>Tier 1</strong></td><td>Manger Extract</td><td>1 XP / 10 s</td><td>~11h06</td></tr>
                <tr><td><strong>Tier 2</strong></td><td>Manger Philtre</td><td>2 XP / 10 s</td><td>~4h09</td></tr>
                <tr><td><strong>Tier 3</strong></td><td>Manger Potion</td><td>3 XP / 10 s</td><td>~1h51</td></tr>
                <tr><td><strong>Tier 4</strong></td><td>Manger Elixir</td><td>4 XP / 10 s</td><td>~42 min</td></tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>Time to reach level 200</strong>
            <p>It takes <strong>867,582 XP</strong> to reach level 200. With a permanent Tier 4 Manger: <strong>~60 hours</strong>. With regular Tier 2 upkeep: <strong>~120 to 150 hours</strong>. A mount with the <em>Wise</em> ability gains XP twice as fast!</p>
        </div>

        <h2>VI. Breeding & the Family Tree</h2>
        <p>After breeding, both parents become <strong>sterile</strong>. You then have several options:</p>
        <ul>
            <li><strong>Sell on the marketplace</strong> (after gaining XP to raise their value).</li>
            <li><strong>Equip</strong> them on your character for their stats.</li>
            <li><strong>Extract the resources</strong> — the mount is consumed to obtain crafting materials.</li>
            <li><strong>Clone</strong> it to recover a fertile mount with the same genealogy.</li>
        </ul>

        <div class="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 my-4">
            <strong class="text-purple-300 text-sm block mb-1">🏆 Achievement tracking in the genealogy tree (new in 3.7)</strong>
            <p class="text-xs text-zinc-300 leading-relaxed">
                A <strong>trophy</strong> icon now appears next to the mounts and coats you have not yet obtained or owned in your family tree. It is the perfect tool for targeting the crossings you are missing and completing your breeding achievements without an external spreadsheet.
            </p>
        </div>

        <div class="callout callout-info">
            <strong>Cloning</strong>
            <p>Combine <strong>two mounts of the same generation and the same type</strong> in the cloning interface. Both are consumed and you get one of them back <strong>fertile</strong>, with the same gender and the same genealogy — but with reset gauges and no special ability.</p>
        </div>

        <h2>VII. Target Generation and Odds</h2>
        <p>
            During a breeding, the baby has a <strong>base 30% chance</strong> of being the target generation
            (the highest combination possible from both family trees). This probability is increased by:
        </p>
        <ul>
            <li><strong>+0.15% per level of each parent</strong> (both added together). Two level 200 parents → +60%.</li>
            <li><strong>+10% with an Optimakina.</strong></li>
        </ul>

        <div class="callout callout-tip">
            <strong>Optimal Combo</strong>
            <p>Two <strong>level 200</strong> parents + <strong>Optimakina</strong> = 30% + 60% + 10% = <strong>100%</strong> chance of getting the target generation!</p>
        </div>

        <h2>VIII. Makinas & the Breeding Interface (3.7)</h2>
        <p>
            Consumables crafted by Breeders, used <strong>during a breeding</strong> (one only per breeding, optional).
            <em>New in 3.7:</em> the selection interface now includes <strong>filters by type and generation</strong> as well as a <strong>colour code</strong> identifying the generation of the current breeding.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-cyan-300 text-sm block">Animakina</strong>
                <p class="text-xs text-zinc-400 mt-1">Gives the baby a <strong>random ability</strong>: In Love, Hardy, Precocious, Wise or Reproductive.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-purple-300 text-sm block">Kromakina</strong>
                <p class="text-xs text-zinc-400 mt-1">The baby gains the <strong>Chameleon</strong> ability — a coat that changes at random.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-center">
                <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-emerald-300 text-sm block">Optimakina</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>+10%</strong> chance of getting the target generation for this breeding.</p>
            </div>
        </div>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/craft_objets.png" alt="Craftable breeding items" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Paddock catalysts and breeding equipment craftable by Breeders (Handymen)</span>
        </div>
    `,
};
