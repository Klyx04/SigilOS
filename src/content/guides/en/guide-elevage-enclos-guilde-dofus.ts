export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Dofus Breeder Guide — 2026 Edition (Unity 3.7)",
    description:
        "The ultimate 2026 Dofus Unity 3.7 breeding guide: capturing, serenity management without waste, 200k gauges, Animakina (sex selection), Optimakina (+20%), cloning with preserved serenity, XP curve and geneton table.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    badgeColor: "amber",
    body: `
        <div class="callout callout-tip">
            <strong>Update 3.7 — Quality of Life & Economic Adjustments</strong>
            <p>This guide incorporates all fixes and balancing from <strong>Update 3.7</strong>:
            <strong>Animakina</strong> (guaranteed 100% sex selection), <strong>Optimakina</strong> boosted to <strong>+20%</strong>,
            <strong>serenity preservation upon cloning</strong>, stable expanded to <strong>500 slots</strong>,
            paddock gauges and catalyst efficiency doubled (6,000 pts / 200,000 max), and new <strong>Geneton rewards up to 500</strong>.</p>
        </div>

        <div class="my-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
                <strong class="text-amber-300 text-sm block">🚀 Interactive Tool Available</strong>
                <p class="text-xs text-zinc-300 mt-1">Simulate target generation chances, calculate paddock durations without serenity overshoot risk and forecast geneton rewards with our dedicated sandbox.</p>
            </div>
            <a href="/elevage" class="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
                Open Breeding Studio 3.7 →
            </a>
        </div>

        <div class="my-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.jpg" alt="The 3 mount families in Dofus" class="rounded-xl w-full max-h-[380px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">The 3 mount families: Dragoturkeys, Seemyools and Rhineetles — levels 1 to 200</span>
        </div>

        <h2>I. The 3 Mount Families & Level Tiers</h2>
        <p>
            In Dofus Unity, mounts no longer gain experience through character combat: they level passively from <strong>level 1 to 200</strong> through the paddock <strong>Manger</strong> gauge.
            Each species has its distinct pedigree tree and stat bonuses:
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/dragodindes.png" alt="Dragoturkeys" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-amber-300 text-sm">Dragoturkeys</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>10 generations (66 coats).</strong> Major bonuses: Vitality (up to 400 at lvl 200), Power, and mono/bi-element stats. The staple of industrial mass breeding.</p>
                <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Dragoturkey stats" class="mt-3 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/muldos.png" alt="Seemyools" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-emerald-300 text-sm">Seemyools</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>6 generations (21 coats).</strong> Signature bonus: <strong>+1 MP</strong> guaranteed from level 100, paired with % resistances and characteristics. Single breeding per mount.</p>
                <img src="/images/guides/elevage/stats_muldos.jpg" alt="Seemyool stats" class="mt-3 rounded border border-white/5 w-full" />
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                <img src="/images/guides/elevage/volkornes.png" alt="Rhineetles" class="h-24 w-auto object-contain mb-2" />
                <strong class="text-rose-300 text-sm">Rhineetles</strong>
                <p class="text-xs text-zinc-400 mt-1"><strong>4 generations (10 coats).</strong> Signature bonus: <strong>+1 AP</strong> guaranteed from level 100, plus critical hits and primary stats. Highly favored in PvP.</p>
                <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Rhineetle stats" class="mt-3 rounded border border-white/5 w-full" />
            </div>
        </div>

        <h2>II. Capturing a Wild Mount</h2>
        <p>
            Since the Unity rework, mount capturing no longer requires completing the Koolich dungeon. The <strong>Mount Taming</strong> spell is automatically granted as soon as you equip a capture net in your combat consumables.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_dragodindes.jpg" alt="Dragoturkey Territory" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-amber-300 text-xs block">Dragoturkey Territory</strong>
                <p class="text-[11px] text-zinc-400 mt-1">Koalak Mountain (Almond, Ginger, Golden). Level 60.</p>
            </div>
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_muldos.jpg" alt="Seemyool Basin" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-emerald-300 text-xs block">Seemyool Basin</strong>
                <p class="text-[11px] text-zinc-400 mt-1">North of Sufokia (Depths). Level 60 monsters accessible without scuba gear.</p>
            </div>
            <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                <img src="/images/guides/elevage/zone_volkornes.jpg" alt="Brakmar Stud Farm" class="rounded-lg w-full h-32 object-cover mb-2" />
                <strong class="text-rose-300 text-xs block">Brakmar Stud Farm</strong>
                <p class="text-[11px] text-zinc-400 mt-1">South of Brakmar walls. Level 60 monsters.</p>
            </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <img src="/images/guides/elevage/filet_universel.png" alt="Capture Nets" class="w-20 h-20 object-contain shrink-0" />
            <div>
                <strong class="text-sm text-foreground block mb-1">The 4 Net Tiers (Breeder Profession):</strong>
                <ul class="text-xs text-zinc-300 space-y-1">
                    <li>• <strong>Universal Capture Net (Level 1):</strong> Captures the targeted mount upon combat victory.</li>
                    <li>• <strong>Multiplier Net (Level 100):</strong> Captures and <em>duplicates</em> the mount (receive 2 identical copies).</li>
                    <li>• <strong>Reinforced Net (Level 150):</strong> Captures in an <strong>AoE circle of radius 3</strong>.</li>
                    <li>• <strong>Reinforced Multiplier Net (Level 200):</strong> Captures in AoE radius 3 <em>and duplicates</em> all captured mounts!</li>
                </ul>
                <p class="text-[11px] text-zinc-400 mt-2"><em>Combat rule:</em> Cast <strong>Mount Taming</strong> on targeted mounts: the state lasts indefinitely until the end of the fight without any turn limit.</p>
            </div>
        </div>

        <h2>III. Paddocks & the Stable (3.7 Rework)</h2>
        <p>
            Private house paddocks are gone. All breeding occurs in the <strong>public paddocks of the Breeders' Village</strong> at <strong>[-18, 0]</strong>, progressively unlocked by your Breeder profession level:
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 my-4 text-center">
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Level 1</span>
                <strong class="text-zinc-200">Beginner</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-18, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Level 40</span>
                <strong class="text-zinc-200">Novice</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-19, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Level 80</span>
                <strong class="text-zinc-200">Apprentice</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-20, 0]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Level 120</span>
                <strong class="text-zinc-200">Initiate</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-20, 2]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-white/10 text-xs">
                <span class="text-zinc-500 block text-[10px]">Level 160</span>
                <strong class="text-zinc-200">Veteran</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-19, 2]</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-900/60 border border-amber-500/30 text-xs bg-amber-500/5">
                <span class="text-amber-400 block text-[10px]">Level 200</span>
                <strong class="text-amber-300">Master</strong>
                <span class="text-[10px] text-amber-400 block font-mono">[-18, 2]</span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/20">
                <strong class="text-cyan-300 text-sm block mb-1">🏠 Stable extended to 500 slots</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    Maximum stable capacity doubled from 250 to <strong>500 mounts</strong>, allowing extensive genetic storage without inventory congestion.
                </p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/20">
                <strong class="text-emerald-300 text-sm block mb-1">⚡ Doubled Catalyst Gauges (200k pts)</strong>
                <p class="text-xs text-zinc-300 leading-relaxed">
                    Paddock maximum capacity reaches <strong>200,000 points</strong> (segmented into 20k, 40k, 60k or 80k depending on paddock). Catalyst yield doubled (a 3,000 point catalyst now yields <strong>6,000 points</strong>).
                </p>
            </div>
        </div>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/jauges_enclos.png" alt="Unity paddock gauges interface" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Paddock control panel for the 5 gauges and associated catalysts</span>
        </div>

        <h2>IV. Mastering Serenity & Making a Mount Fertile</h2>
        <p>
            For a mount to breed, it must display the <strong>Fertile</strong> status.
            This requires maximizing its 3 gauges (<strong>Endurance</strong>, <strong>Maturity</strong>, <strong>Love</strong>).
            Filling these gauges strictly depends on the mount's <strong>Serenity</strong> level (varying between <strong>-5,000 and +5,000</strong>):
        </p>

        <div class="guide-image-container my-6">
            <img src="/images/guides/elevage/smileys_humeur.png" alt="The 4 serenity zones and corresponding mood smileys" class="guide-image max-w-md mx-auto rounded-lg border border-border" />
            <span class="guide-caption">The 4 serenity zones and corresponding mood smileys in game</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Mount Gauge</th>
                    <th>Required Serenity Range</th>
                    <th>Mood Smiley</th>
                    <th>Paddock Machine</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Endurance</strong></td>
                    <td><span class="text-amber-400 font-bold">Negative</span> (-5,000 to -1)</td>
                    <td>Red :C or Blue :(</td>
                    <td><strong>Lightning Thrower</strong> (Yellow Gauge)</td>
                </tr>
                <tr>
                    <td><strong>Maturity</strong></td>
                    <td><span class="text-cyan-400 font-bold">Neutral</span> (-2,000 to +2,000)</td>
                    <td>Blue :( or Purple :)</td>
                    <td><strong>Drinker</strong> (Blue Gauge)</td>
                </tr>
                <tr>
                    <td><strong>Love</strong></td>
                    <td><span class="text-rose-400 font-bold">Positive</span> (+1 to +5,000)</td>
                    <td>Purple :) or Green :D</td>
                    <td><strong>Slapper</strong> (Red Gauge)</td>
                </tr>
                <tr>
                    <td><strong>Serenity</strong></td>
                    <td>Free adjustment</td>
                    <td>—</td>
                    <td><strong>Slapper</strong> (-) / <strong>Petter</strong> (+)</td>
                </tr>
                <tr>
                    <td><strong>Mount XP</strong></td>
                    <td>Any value</td>
                    <td>—</td>
                    <td><strong>Manger</strong> (Beige Gauge)</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>⚠️ 3.7 Warning: The Granularity Trap</strong>
            <p>
                Because catalyst efficiency was doubled, <strong>serenity drifts twice as fast</strong>.
                If you load paddocks without timing your sessions, your mount will shoot past the neutral [-2000, +2000] zone straight into the opposite extreme.
                <strong>Golden rule:</strong> Calculate required catalyst units and pull mounts out as soon as the target range is achieved.
            </p>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 my-6">
            <strong class="text-amber-300 text-sm block mb-2">⚡ The 2-Step Protocol for Rapid Fertility:</strong>
            <ol class="text-xs text-zinc-300 space-y-2 list-decimal pl-4">
                <li>
                    <strong>Phase 1 (Endurance + Maturity simultaneously):</strong> Set serenity between <strong>-2,000 and -1</strong> (Blue Smiley :(). Activate both <strong>Lightning Thrower</strong> and <strong>Drinker</strong>. The mount builds endurance AND maturity in parallel!
                </li>
                <li>
                    <strong>Phase 2 (Love + Finish Maturity):</strong> Pet the mount until serenity is between <strong>0 and +2,000</strong> (Purple Smiley :). Activate the <strong>Slapper</strong> (and Drinker if maturity isn't capped yet). Your mount becomes <strong>Fertile</strong> without ever drifting to the extremes!
                </li>
            </ol>
        </div>

        <h2>V. Breeding & Target Generation Formula (3.7)</h2>
        <p>
            When a fertile male and female of the same family are bred, birth is <strong>instantaneous</strong> (no gestation timer).
            Both parents become immediately <strong>sterile</strong>, yielding 1 baby (or 2 if a parent has the <em>Reproductive</em> ability).
        </p>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/accouplement_interface.jpg" alt="3.7 Breeding Interface" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Breeding interface with sex filters, level bonuses and Makina slot</span>
        </div>

        <p>
            The probability of obtaining the <strong>Target Generation</strong> (highest possible combination from the two pedigree trees) follows a strict formula:
        </p>

        <div class="p-4 rounded-xl bg-zinc-900 border border-white/10 font-mono text-center text-xs sm:text-sm text-amber-300 my-4">
            Probability = 30% (Base) + (Parent 1 Level × 0.15%) + (Parent 2 Level × 0.15%) + Optimakina (+20%)
        </div>

        <div class="callout callout-tip">
            <strong>🎯 The 100% Threshold Without Level 200 Parents (New 3.7)</strong>
            <p>
                With Optimakina increasing from <strong>+10% to +20%</strong> in 3.7, you only need <strong>50%</strong> from parent levels (instead of 60%).
                You reach <strong>guaranteed 100% target generation chance</strong> once cumulative parent levels hit <strong>334</strong>:
            </p>
            <ul class="text-xs text-zinc-300 mt-2 space-y-1">
                <li>• Two <strong>level 167</strong> parents + Optimakina = 30% + 50.1% + 20% = <strong>100% guaranteed</strong>!</li>
                <li>• One <strong>level 200</strong> parent + one <strong>level 134</strong> parent + Optimakina = 30% + 30% + 20.1% + 20% = <strong>100% guaranteed</strong>!</li>
                <li><em>Massive saving:</em> You spare over 40 hours of manger paddock per mount compared to forcing level 200 on both parents.</li>
            </ul>
        </div>

        <h2>VI. Makinas (Complete 3.7 Overhaul)</h2>
        <p>
            Makinas are single-use breeding items crafted by Breeders, inserted during mating (one per cross).
            Their recipes were rebalanced in 3.7 to eliminate overpriced boss drops:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/30 text-center">
                <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-cyan-300 text-sm block">Animakina (New 3.7)</strong>
                <p class="text-xs text-zinc-300 mt-1">Allows you to <strong>guarantee 100% the baby's sex (Male ♂ or Female ♀)</strong>. Permanently ends gender imbalances in bloodlines.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 text-center">
                <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-emerald-300 text-sm block">Optimakina (Boosted 3.7)</strong>
                <p class="text-xs text-zinc-300 mt-1">Grants <strong>+20% probability</strong> (up from 10%) of hitting the target generation during mating.</p>
            </div>
            <div class="p-4 rounded-xl bg-zinc-900/70 border border-purple-500/30 text-center">
                <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                <strong class="text-purple-300 text-sm block">Kromakina</strong>
                <p class="text-xs text-zinc-300 mt-1">Guarantees the <strong>Chameleon</strong> trait on the newborn mount.</p>
            </div>
        </div>

        <h2>VII. Cloning & Profitable Recycling (Serenity Preservation)</h2>
        <p>
            After breeding, mounts turn sterile. The <strong>Cloning</strong> interface lets you merge <strong>two sterile mounts of the same species and generation</strong> to produce one fresh <strong>fertile</strong> mount.
        </p>

        <div class="my-6 text-center">
            <img src="/images/guides/elevage/clonage_interface.jpg" alt="Unity Cloning Interface" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
            <span class="text-xs text-zinc-400 mt-2 block">Cloning interface: merge 2 sterile mounts to reproduce a fertile pivot mount</span>
        </div>

        <div class="callout callout-tip">
            <strong>🔥 Crucial 3.7 Cloning Advantage (Discovered by Liche)</strong>
            <p>
                Unlike older versions where gauges reset randomly, <strong>the cloned mount now inherits the exact serenity of the parent mount</strong>!
                If you clone a mount already calibrated in the neutral zone ([-2000, 0]), your newly fertile mount can be immediately placed in lightning/drinker paddocks without petting!
            </p>
        </div>

        <h2>VIII. Leveling Mounts to 200 (XP & Mangers)</h2>
        <p>
            A mount levels from 1 to 200 by accumulating <strong>867,582 XP</strong> via the Manger gauge.
            XP rate depends on the catalyst Tier placed in the paddock:
        </p>

        <table>
            <thead>
                <tr>
                    <th>Catalyst Tier</th>
                    <th>Breeding Item</th>
                    <th>XP Rate</th>
                    <th>Level 1 → 100 Time</th>
                    <th>Level 1 → 200 Time</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Tier 1</strong></td>
                    <td>Manger Extract (Lvl 5+)</td>
                    <td>10 XP / 10 s</td>
                    <td>~48 hours</td>
                    <td>~241 hours (~10 days)</td>
                </tr>
                <tr>
                    <td><strong>Tier 2</strong></td>
                    <td>Manger Filter (Lvl 55+)</td>
                    <td>20 XP / 10 s</td>
                    <td>~24 hours</td>
                    <td>~120 hours (~5 days)</td>
                </tr>
                <tr>
                    <td><strong>Tier 3</strong></td>
                    <td>Manger Potion (Lvl 105+)</td>
                    <td>30 XP / 10 s</td>
                    <td>~16 hours</td>
                    <td>~80 hours (~3.3 days)</td>
                </tr>
                <tr>
                    <td><strong>Tier 4</strong></td>
                    <td>Manger Elixir (Lvl 155+)</td>
                    <td>40 XP / 10 s</td>
                    <td>~12 hours</td>
                    <td><strong>~60 hours (~2.5 days)</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Wise Ability: Double Speed!</strong>
            <p>A mount with the <strong>Wise</strong> genetic ability doubles all manger XP gains. Level 200 is reached in just <strong>~30 hours</strong> with Tier 4 catalysts!</p>
        </div>

        <h2>IX. Economics, 3.7 Geneton Table & Extraction</h2>
        <p>
            Every mating grants <strong>Genetons</strong>, traded at the Breeders' Village at <strong>[-18, 1]</strong> with NPC <strong>Eugène Éton</strong> for stat scrolls and tourmalines.
            The scale was heavily increased for higher generations:
        </p>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 text-center">
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 1: <strong class="text-zinc-300">1</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 2: <strong class="text-zinc-300">2</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 3: <strong class="text-zinc-300">4</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 4: <strong class="text-zinc-300">8</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 5: <strong class="text-zinc-300">15</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 6: <strong class="text-zinc-300">30</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 7: <strong class="text-zinc-300">60</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-white/10 text-xs">Gen 8: <strong class="text-zinc-300">120</strong></div>
            <div class="p-2 rounded-lg bg-zinc-900 border border-amber-500/30 text-xs text-amber-300">Gen 9: <strong>250</strong></div>
            <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/50 text-xs text-amber-300 font-bold">Gen 10: <strong>500</strong></div>
        </div>

        <p class="text-xs text-zinc-400">
            <em>3.7 Adjustment:</em> NPC resource prices increased from 15 to <strong>30 genetons</strong>, solidifying breeding as the primary production pipeline. Breeding resources were also removed from Nowel Island gifts.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/neurone_dragodinde.png" alt="Dragoturkey Neuron" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Dragoturkey Neuron</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtained by extracting sterile Dragoturkeys (Gen 2+).</span>
                </div>
            </div>
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/ambre_muldo.png" alt="Seemyool Amber" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Seemyool Amber</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtained by extracting sterile Seemyools (Gen 2+).</span>
                </div>
            </div>
            <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                <img src="/images/guides/elevage/corne_volkorne.png" alt="Rhineetle Horn" class="no-zoom w-10 h-10 object-contain shrink-0" />
                <div>
                    <strong class="text-xs text-foreground block">Rhineetle Horn</strong>
                    <span class="text-[11px] text-muted-foreground block">Obtained by extracting sterile Rhineetles (Gen 2+).</span>
                </div>
            </div>
        </div>

        <h2>X. Breeder Almanax Calendar: 13 Essential Dates</h2>
        <p>
            Specific Meridia days radically enhance breeding profit. Mark these 13 essential dates in your calendar:
        </p>

        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Meridia</th>
                    <th>Breeding Bonus & Strategic Impact</th>
                </tr>
            </thead>
            <tbody>
                <tr><td><strong>Jan 10</strong></td><td>Trôma</td><td><strong>Drinkers</strong> effect doubled in paddocks (Maturity ×2).</td></tr>
                <tr><td><strong>Feb 10</strong></td><td>Meash</td><td>100% of newborns gain the <strong>Enduring</strong> ability.</td></tr>
                <tr><td><strong>Mar 10</strong></td><td>Inndo</td><td><strong>Lightning Throwers</strong> effect doubled (Endurance ×2).</td></tr>
                <tr><td><strong>Apr 10</strong></td><td>Nunu</td><td><strong>Slappers</strong> effect doubled (faster serenity drop).</td></tr>
                <tr><td><strong>May 10</strong></td><td>Loumi</td><td>Save <strong>15% crafting ingredients</strong> on breeding items.</td></tr>
                <tr><td><strong>Jun 10</strong></td><td>Jibejan</td><td><strong>Mangers</strong> effect doubled (Mount XP ×2).</td></tr>
                <tr><td><strong>Jul 10</strong></td><td>Jihelair</td><td>100% of newborns gain the <strong>Loving</strong> ability.</td></tr>
                <tr><td><strong>Aug 10</strong></td><td>Rigamix</td><td><strong>25% chance</strong> to craft an extra breeding item.</td></tr>
                <tr><td><strong>Sep 10</strong></td><td>Mau</td><td><strong>Petters</strong> effect doubled (faster serenity rise).</td></tr>
                <tr><td><strong>Oct 10</strong></td><td>Benjo</td><td>100% of newborns gain the <strong>Wise</strong> ability (Lifetime 2× XP!).</td></tr>
                <tr>
                    <td><strong>Oct 12</strong></td>
                    <td><strong>Takeza</strong></td>
                    <td><strong>+20% chance of target generation</strong> across all crosses! The most critical breeding day of the year.</td>
                </tr>
                <tr><td><strong>Nov 10</strong></td><td>Otoul</td><td>100% of newborns gain the <strong>Precocious</strong> ability.</td></tr>
                <tr><td><strong>Dec 10</strong></td><td>Foya</td><td><strong>Slappers</strong> effect doubled (Love ×2).</td></tr>
            </tbody>
        </table>

        <div class="mt-8 p-6 rounded-2xl border border-border bg-surface/60 text-center">
            <h3 class="text-base font-bold text-foreground mb-1.5">Ready to optimize your breeding?</h3>
            <p class="text-xs text-muted-foreground max-w-lg mx-auto mb-4">Access our interactive simulator to test cross probabilities, calculate serenity windows, and track your mount collection.</p>
            <a href="/elevage" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-opacity">
                Launch Breeding Studio 3.7
            </a>
        </div>
    `,
};
