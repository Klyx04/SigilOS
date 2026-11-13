export const guide = {
    slug: "guide-elevage-enclos-guilde-dofus",
    title: "Raising mounts in Dofus Unity: Breeder guide for beginners (Update 3.7)",
    description:
        "Where to start: catching a first mount, leveling the breeder profession, paddocks, serenity and mating, up to crosses, cloning and genetons. Up to date for Update 3.7.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
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

        <!-- ── COCKPIT BANNER BREEDING STUDIO ─────────────────────────────── -->
        <div class="my-8 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-950 p-6 shadow-xl">
            <div class="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div class="flex items-center gap-5">
                    <div class="relative w-20 h-20 shrink-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-2 flex items-center justify-center shadow-inner">
                        <img src="/images/guides/elevage/dragodindes.png" alt="Dragoturkey SigilOS Studio" class="no-zoom w-16 h-16 object-contain filter drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)]" />
                    </div>
                    <div>
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold text-[11px] mb-1.5">
                            ✨ Free Interactive Simulator Tool
                        </div>
                        <h3 class="text-lg font-bold text-foreground">Breeding Studio Dofus Unity 3.7</h3>
                        <p class="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                            Test 100% target generation odds (Optimakina + parent levels), simulate paddock XP durations, and prevent mood drift with our paddock timers.
                        </p>
                    </div>
                </div>
                <a href="/elevage" class="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-lg hover:shadow-amber-500/20 hover:scale-[1.02]">
                    <img src="/images/guides/elevage/dragodindes.png" alt="" class="no-zoom w-4 h-4 object-contain" />
                    <span>Launch Breeding Studio 3.7 →</span>
                </a>
            </div>
        </div>

        <!-- ── HEADER BANNER FAMILIES ────────────────────────────────────── -->
        <div class="my-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900/60 p-2 text-center">
            <img src="/images/guides/elevage/montures_types.jpg" alt="The 3 mount families in Dofus" class="rounded-xl w-full max-h-[380px] object-cover" />
            <span class="text-xs text-zinc-400 mt-2 block font-medium">The 3 mount families across 10 generations: Dragoturkeys, Seemyools and Rhineetles — levels 1 to 200</span>
        </div>

        <!-- ── DYNAMIC 6 TABS CONTAINER ───────────────────────────────────── -->
        <div class="guide-tabs my-8" data-default-tab="demarrer">
            <!-- Navigation tab bar -->
            <div class="guide-tab-nav flex flex-wrap border-b border-border gap-2 mb-8 pb-px">
                <button type="button" class="guide-tab-btn active px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-amber-500 bg-amber-500/10 text-foreground transition-all flex items-center gap-2" data-tab="demarrer">
                    <span>🧭 1. Getting Started & Paddocks</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="serenite">
                    <span>⚖️ 2. Serenity & Mood</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="reproduction">
                    <span>🧬 3. Mating & Family Trees</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="rentabilite">
                    <span>🪙 4. Level 200 XP & Genetons</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="almanax">
                    <span>📅 5. Breeder's Almanax</span>
                </button>
                <button type="button" class="guide-tab-btn px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-all flex items-center gap-2" data-tab="succes">
                    <span>🏆 6. Breeding Achievements (1,211 pts)</span>
                </button>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- TAB 1 : GETTING STARTED & PADDOCKS                              -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane" data-pane="demarrer">
                <h2>I. Breeding Foundations in Unity (Updates 3.5 & 3.7)</h2>
                <p>
                    Mount breeding in Dofus Unity has been entirely revamped to remove legacy mechanics.
                    Here are the primary changes:
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-amber-300 block mb-1">❌ No More Certificates</strong>
                        <p class="text-zinc-400 text-[11px]">Mounts are direct equipable inventory items stored in bags or stables without expiration dates.</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-cyan-300 block mb-1">❌ No Fatigue or Energy</strong>
                        <p class="text-zinc-400 text-[11px]">Mounts no longer tire out and do not require energy points to be ridden or bred.</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-emerald-300 block mb-1">⚡ Instant Birth</strong>
                        <p class="text-zinc-400 text-[11px]">No gestation delay: mating instantly yields the newborn mount, while parents become sterile.</p>
                    </div>
                    <div class="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs">
                        <strong class="text-rose-300 block mb-1">🏠 Shared Public Paddocks</strong>
                        <p class="text-zinc-400 text-[11px]">Private paddocks are gone: all activities take place across the 6 Breeder Village public paddocks.</p>
                    </div>
                </div>

                <h3>The 3 Mount Species (10 Generations Each)</h3>
                <p>
                    Unlike legacy game versions, <strong>all 3 mount families now span 10 full generations</strong>. Each family grants a signature bonus starting at level 100:
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/dragodindes.png" alt="Dragoturkeys" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-amber-300 text-sm">Dragoturkeys (66 coats)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 generations.</strong> Signature bonus: <strong>Vitality</strong> (300 at level 100, 400 at level 200), Power and elemental stats. Ideal starting species.</p>
                        <img src="/images/guides/elevage/stats_dragodindes.jpg" alt="Dragoturkey stats" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/muldos.png" alt="Seemyools" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-emerald-300 text-sm">Seemyools (82 coats)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 generations.</strong> Signature bonus: <strong>+1 MP</strong> guaranteed at level 100+, % resistances and stats. Dedicated achievement: <em>Aquatic Generations</em>.</p>
                        <img src="/images/guides/elevage/stats_muldos.jpg" alt="Seemyool stats" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-center flex flex-col items-center">
                        <img src="/images/guides/elevage/volkornes.png" alt="Rhineetles" class="h-24 w-auto object-contain mb-2" />
                        <strong class="text-rose-300 text-sm">Rhineetles (80 coats)</strong>
                        <p class="text-xs text-zinc-400 mt-1"><strong>10 generations.</strong> Signature bonus: <strong>+1 AP</strong> guaranteed at level 100+, critical hits and primary stats. Dedicated achievement: <em>Generation V</em>.</p>
                        <img src="/images/guides/elevage/stats_volkornes.jpg" alt="Rhineetle stats" class="mt-3 rounded border border-white/5 w-full" />
                    </div>
                </div>

                <h3>The 4 Fertility States</h3>
                <ul>
                    <li><strong>Breedable:</strong> mount ready to mate once its 3 personal gauges are filled.</li>
                    <li><strong>Fertile:</strong> immediate mating ready (all 3 gauges at 100%).</li>
                    <li><strong>Sterile:</strong> has completed mating. Cannot mate again, but cloning and extraction remain allowed.</li>
                    <li><strong>Senile:</strong> legacy mounts from pre-3.5: neither mating nor cloning, equipment and XP only.</li>
                </ul>

                <h2>II. Catching Wild Mounts</h2>
                <p>
                    The legacy <em>Mount Taming</em> spell is no longer taught in Koolich dungeon: it is granted automatically by equipping a <strong>capture net</strong> in battle consumables.
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                    <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                        <img src="/images/guides/elevage/zone_dragodindes.jpg" alt="Dragoturkey Territory" class="rounded-lg w-full h-32 object-cover mb-2" />
                        <strong class="text-amber-300 text-xs block">Dragoturkey Territory</strong>
                        <p class="text-[11px] text-zinc-400 mt-1">Koalak Mountain (wild Almond, Ginger, Golden). Level 60.</p>
                    </div>
                    <div class="p-3 rounded-xl bg-zinc-900/60 border border-white/10">
                        <img src="/images/guides/elevage/zone_muldos.jpg" alt="Seemyool Basin" class="rounded-lg w-full h-32 object-cover mb-2" />
                        <strong class="text-emerald-300 text-xs block">Seemyool Basin</strong>
                        <p class="text-[11px] text-zinc-400 mt-1">Sufokia Bay (Abyss). Level 60 monsters accessible without diving.</p>
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
                            <li>• <strong>Universal capture net (Level 1):</strong> Captures target mount at end of battle.</li>
                            <li>• <strong>Multiplying net (Level 100):</strong> Captures and <em>duplicates</em> the mount (receive 2 copies).</li>
                            <li>• <strong>Reinforced net (Level 150):</strong> Captures across a <strong>circle radius of 3</strong>.</li>
                            <li>• <strong>Reinforced multiplying net (Level 200):</strong> Area capture in radius 3 <em>and duplicates</em> all targets!</li>
                        </ul>
                    </div>
                </div>

                <h2>III. Stable & Public Paddocks</h2>
                <p>
                    Breeding logistics occur on the <strong>6 Breeder Village maps at [-18, 0]</strong>, progressively unlocked by breeder profession levels:
                </p>

                <div class="my-4 rounded-xl overflow-hidden border border-white/10">
                    <img src="/images/guides/elevage/enclos_guilde.jpg" alt="Breeder Village paddock" class="w-full h-48 object-cover" />
                </div>

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

                <div class="callout callout-info">
                    <strong>🏠 Stables expanded to 500 slots</strong>
                    <p>In 3.7, player stable capacity was expanded to <strong>500 mount slots</strong>. You can comfortably maintain large genetic lineages without cluttering personal bags.</p>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- TAB 2 : SERENITY & MOOD                                         -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="serenite">
                <h2>I. The 4 Serenity Windows & Smiley Moods</h2>
                <p>
                    To become <strong>Fertile</strong>, a mount must maximize its 3 gauges (<strong>Endurance</strong>, <strong>Maturity</strong>, <strong>Love</strong>).
                    Progress inside these gauges is governed by the mount's <strong>Serenity</strong> (oscillating between <strong>-5,000 and +5,000</strong>):
                </p>

                <div class="guide-image-container my-6 text-center">
                    <img src="/images/guides/elevage/smileys_humeur.png" alt="Mood smileys and serenity zones" class="guide-image max-w-md mx-auto rounded-lg border border-border" />
                    <span class="text-xs text-zinc-400 mt-2 block">The 4 serenity zones and matching in-game smileys</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Mount Gauge</th>
                            <th>Required Serenity Window</th>
                            <th>Associated Smiley</th>
                            <th>Paddock Device</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Endurance</strong></td>
                            <td><span class="text-amber-400 font-bold">Negative</span> (-5,000 to -1)</td>
                            <td>Red :C or Blue :(</td>
                            <td><strong>Lightning Rod (Foudroyeur)</strong> (Yellow gauge)</td>
                        </tr>
                        <tr>
                            <td><strong>Maturity</strong></td>
                            <td><span class="text-cyan-400 font-bold">Neutral</span> (-2,000 to +2,000)</td>
                            <td>Blue :( or Purple :)</td>
                            <td><strong>Drinking Trough (Abreuvoir)</strong> (Blue gauge)</td>
                        </tr>
                        <tr>
                            <td><strong>Love</strong></td>
                            <td><span class="text-rose-400 font-bold">Positive</span> (+1 to +5,000)</td>
                            <td>Purple :) or Green :D</td>
                            <td><strong>Dragobutt (Dragofesse)</strong> (Red gauge)</td>
                        </tr>
                        <tr>
                            <td><strong>Serenity</strong></td>
                            <td>Mood calibration</td>
                            <td>—</td>
                            <td><strong>Slapper (Baffeur)</strong> (-) / <strong>Stroker (Caresseur)</strong> (+)</td>
                        </tr>
                        <tr>
                            <td><strong>Mount XP</strong></td>
                            <td>Any value</td>
                            <td>—</td>
                            <td><strong>Manger (Mangeoire)</strong> (Beige gauge)</td>
                        </tr>
                    </tbody>
                </table>

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/jauges_enclos.png" alt="Paddock gauges interface" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Paddock gauges and injected catalysts control dashboard</span>
                </div>

                <div class="callout callout-warning">
                    <strong>⚠️ Alert 3.7: Serenity Drift Trap</strong>
                    <p>
                        With catalyst efficiency doubled (6,000 pts / 200,000 max), <strong>serenity drifts twice as fast</strong>.
                        Leaving slappers or strokers unattended can push your mount past neutral into opposite extremes.
                    </p>
                </div>

                <div class="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/20 my-6">
                    <strong class="text-amber-300 text-sm block mb-2">⚡ The 2-Step Protocol to Reach Fertility Without Drift:</strong>
                    <ol class="text-xs text-zinc-300 space-y-2 list-decimal pl-4">
                        <li>
                            <strong>Phase 1 (Endurance + Maturity simultaneously):</strong> Calibrate serenity between <strong>-2,000 and -1</strong> (Blue smiley :(). Activate both <strong>Lightning Rod</strong> and <strong>Drinking Trough</strong>. Your mount raises endurance AND maturity together!
                        </li>
                        <li>
                            <strong>Phase 2 (Love + Finish Maturity):</strong> Use a stroker to bring serenity between <strong>0 and +2,000</strong> (Purple smiley :). Activate <strong>Dragobutt</strong> (and Trough if needed). Your mount turns <strong>Fertile</strong> without ever visiting extreme borders!
                        </li>
                    </ol>
                </div>

                <!-- CONTEXTUAL CTA SERENITY TIMER -->
                <div class="my-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">⏱️</span>
                        <div>
                            <strong class="text-xs text-foreground block">Serenity Anti-Drift Simulator</strong>
                            <p class="text-[11px] text-muted-foreground mt-0.5">Calculate catalyst steps and exact duration before boundary crossing in Breeding Studio.</p>
                        </div>
                    </div>
                    <a href="/elevage" class="shrink-0 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-950 font-semibold text-xs hover:bg-cyan-400 transition-colors">
                        Open Timer →
                    </a>
                </div>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- TAB 3 : MATING, FAMILY TREES & MAKINAS                          -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="reproduction">
                <h2>I. Immediate Mating & Target Generation Odds</h2>
                <p>
                    Mating is triggered directly from the stable between fertile male and female mounts of the same species.
                    Birth is <strong>immediate</strong> and parents turn <strong>sterile</strong>.
                </p>

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/accouplement_interface.jpg" alt="Mating interface Unity 3.7" class="rounded-xl mx-auto max-h-[300px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Mating interface featuring Makina catalyst insertion</span>
                </div>

                <p>Probability to obtain the <strong>Target Generation</strong> (highest among both lineages) follows this formula:</p>

                <div class="p-4 rounded-xl bg-zinc-900 border border-white/10 font-mono text-center text-xs sm:text-sm text-amber-300 my-4">
                    Chance = 30% (Base) + (Parent 1 Level × 0.15%) + (Parent 2 Level × 0.15%) + Optimakina (+20%) + Takeza (+20%)
                </div>

                <div class="callout callout-tip">
                    <strong>🎯 The 100% Guaranteed Cap with Optimakina (Update 3.7)</strong>
                    <p>
                        With Optimakina boosted to <strong>+20%</strong> (up from 10%), only <strong>50%</strong> remains to be covered by parent levels.
                        You reach <strong>100% guaranteed target odds</strong> once both parents' levels sum up to <strong>334</strong>:
                    </p>
                    <ul class="text-xs text-zinc-300 mt-2 space-y-1">
                        <li>• Two <strong>level 167</strong> parents + Optimakina = 30% + 50.1% + 20% = <strong>100% guaranteed</strong>!</li>
                        <li>• One <strong>level 200</strong> parent + one <strong>level 134</strong> parent + Optimakina = 30% + 30% + 20.1% + 20% = <strong>100% guaranteed</strong>!</li>
                        <li><em>Massive saving:</em> No need to level both parents to 200 to secure target generation climbs.</li>
                    </ul>
                </div>

                <!-- CONTEXTUAL CTA CROSSINGS -->
                <div class="my-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🎯</span>
                        <div>
                            <strong class="text-xs text-foreground block">Test your two mounts live</strong>
                            <p class="text-[11px] text-muted-foreground mt-0.5">Check odds and compute level targets in our Breeding Studio Cross Calculator.</p>
                        </div>
                    </div>
                    <a href="/elevage" class="shrink-0 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-xs hover:bg-amber-400 transition-colors">
                        Test my crosses →
                    </a>
                </div>

                <h2>II. The 3 Makinas (3.7 Overhaul)</h2>
                <p>Consumable catalysts crafted by breeders (one Makina per mating):</p>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/30 text-center">
                        <img src="/images/guides/elevage/animakina.png" alt="Animakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-cyan-300 text-sm block">Animakina (Update 3.7)</strong>
                        <p class="text-xs text-zinc-300 mt-1">Allows <strong>guaranteed 100% baby sex choice (Male ♂ or Female ♀)</strong>. Permanently ends gender bottlenecks.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 text-center">
                        <img src="/images/guides/elevage/optimakina.png" alt="Optimakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-emerald-300 text-sm block">Optimakina (+20%)</strong>
                        <p class="text-xs text-zinc-300 mt-1">Grants <strong>+20% bonus chance</strong> (up from 10%) to obtain target generation during mating.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-zinc-900/70 border border-purple-500/30 text-center">
                        <img src="/images/guides/elevage/kromakina.png" alt="Kromakina" class="h-16 w-auto mx-auto mb-2" />
                        <strong class="text-purple-300 text-sm block">Kromakina</strong>
                        <p class="text-xs text-zinc-300 mt-1">Transfers the <strong>Chameleon</strong> trait with 100% certainty (mount adopts character clothing colors).</p>
                    </div>
                </div>

                <h2>III. Family Trees & Pure Lineages</h2>
                <p>
                    Since Update 3.5, <strong>the genealogy tree stops at grandparents</strong> (only 2 generations of ancestry, meaning 6 ancestors for the future newborn).
                    Wild-caught mounts have an empty tree with no ancestors.
                </p>

                <div class="my-4 text-center">
                    <img src="/images/guides/elevage/arbre_genetique.jpg" alt="Dofus mount family tree" class="rounded-xl mx-auto max-h-[280px] border border-white/10" />
                    <span class="text-xs text-zinc-400 mt-2 block">Simplified genetic tree (Parents and Grandparents only)</span>
                </div>

                <div class="p-4 rounded-xl bg-zinc-900/70 border border-white/10 text-xs text-zinc-300 space-y-1.5 my-4">
                    <strong class="text-amber-300 block mb-1">Why purify lineages?</strong>
                    <p>• Parents hold the primary weight in newborn coat determination, while grandparents exert a secondary influence.</p>
                    <p>• A <strong>pure lineage</strong> mount has parents and grandparents belonging to the exact same breed.</p>
                    <p>• Crossing two pure lineage parents secures color transmission without risk of regressing to an earlier unwanted breed from a mixed ancestor.</p>
                </div>

                <h2>IV. The 6 Major Genetic Capacities</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Capacity</th>
                            <th>In-Game Effect</th>
                            <th>Breeding Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Reproductive</strong></td>
                            <td>Gives <strong>1 additional newborn</strong> per litter (2 babies instead of 1).</td>
                            <td>Essential trait for mass breeding: double yield per generation climb. Also works on males.</td>
                        </tr>
                        <tr>
                            <td><strong>Wise (Sage)</strong></td>
                            <td>Manger paddock XP gain <strong>multiplied by 2</strong>.</td>
                            <td>Reaches level 200 in only ~30 hours with Tier 4 catalysts.</td>
                        </tr>
                        <tr>
                            <td><strong>Chameleon</strong></td>
                            <td>Mount adopts player character colors when ridden.</td>
                            <td>High market value in public trade marketplaces (100% via Kromakina).</td>
                        </tr>
                        <tr>
                            <td><strong>Precocious</strong></td>
                            <td>Maturity gains <strong>doubled</strong> in paddock.</td>
                            <td>Greatly speeds up filling the blue gauge (Maturity).</td>
                        </tr>
                        <tr>
                            <td><strong>In Love</strong></td>
                            <td>Love gains <strong>doubled</strong> in paddock.</td>
                            <td>Halves time needed for positive red gauge (Love).</td>
                        </tr>
                        <tr>
                            <td><strong>Enduring</strong></td>
                            <td>Endurance gains <strong>doubled</strong> in paddock.</td>
                            <td>Halves time needed for negative yellow gauge (Endurance).</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- ════════════════════════════════════════════════════════════════ -->
            <!-- TAB 4 : LEVEL 200 XP, PROFIT & ACHIEVEMENTS                     -->
            <!-- ════════════════════════════════════════════════════════════════ -->
            <div class="guide-tab-pane hidden" data-pane="rentabilite">
                <h2>I. Raising a Mount to Level 200 (Manger XP)</h2>
                <p>
                    Mounts advance from level 1 to level 200 by earning <strong>867,582 XP</strong> via the Manger paddock device.
                    Throughput scales with catalyst tiers:
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>Catalyst Tier</th>
                            <th>Breeding Catalyst</th>
                            <th>XP Rate</th>
                            <th>Level 1 → 100</th>
                            <th>Level 1 → 200</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tier 1</strong></td>
                            <td>Manger extract (Lvl 5+)</td>
                            <td>10 XP / 10 s</td>
                            <td>~48 hours</td>
                            <td>~241 hours (~10 days)</td>
                        </tr>
                        <tr>
                            <td><strong>Tier 2</strong></td>
                            <td>Manger philtre (Lvl 55+)</td>
                            <td>20 XP / 10 s</td>
                            <td>~24 hours</td>
                            <td>~120 hours (~5 days)</td>
                        </tr>
                        <tr>
                            <td><strong>Tier 3</strong></td>
                            <td>Manger potion (Lvl 105+)</td>
                            <td>30 XP / 10 s</td>
                            <td>~16 hours</td>
                            <td>~80 hours (~3.3 days)</td>
                        </tr>
                        <tr>
                            <td><strong>Tier 4</strong></td>
                            <td>Manger elixir (Lvl 155+)</td>
                            <td>40 XP / 10 s</td>
                            <td>~12 hours</td>
                            <td><strong>~60 hours (~2.5 days)</strong></td>
                        </tr>
                    </tbody>
                </table>

                <div class="callout callout-info">
                    <strong>Wise Trait: Doubled Speed!</strong>
                    <p>Mounts bearing the <strong>Wise</strong> genetic trait double all manger XP gains. Level 200 is reached in <strong>~30 hours flat</strong> with Tier 4!</p>
                </div>

                <h2>II. Profitable Mount Cloning & Recycling</h2>
                <p>
                    The <strong>Cloning</strong> panel fuses <strong>two sterile mounts of the same species and generation</strong> to recreate one <strong>breedable</strong> mount.
                </p>

                <div class="my-6 text-center">
                    <img src="/images/guides/elevage/clonage_interface.jpg" alt="Unity cloning interface" class="rounded-xl mx-auto max-h-[280px] border border-white/10 shadow-lg" />
                    <span class="text-xs text-zinc-400 mt-2 block">Cloning interface: merging 2 sterile mounts into 1 breedable pivot</span>
                </div>

                <div class="callout callout-tip">
                    <strong>🔥 Crucial Cloning Advantage in 3.7</strong>
                    <p>
                        Unlike legacy versions, <strong>cloned mounts preserve the exact serenity value of the model mount</strong>!
                        Cloning a mount calibrated in neutral range ([-2,000, 0]) allows direct placement into lightning rods and troughs without stroker detours.
                    </p>
                </div>

                <h2>III. Geneton Rewards 3.7 & Extraction</h2>
                <div class="my-6 p-4 rounded-xl border border-border bg-surface/50 flex flex-col sm:flex-row items-center gap-4">
                    <img src="/images/guides/elevage/geneton.png" alt="Geneton Dofus 3.7" class="no-zoom w-14 h-14 object-contain shrink-0" />
                    <div>
                        <strong class="text-xs text-foreground uppercase tracking-wider block">The Geneton — 3.7 Breeding Currency</strong>
                        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Introduced in Update 3.7, <strong>Genetons</strong> reward genetic progress. They are automatically awarded upon mating whenever the newborn surpasses <strong>all ancestors</strong> in both lineages. Exchange them at the Breeder Village at <strong>[-18, 1]</strong> with NPC <strong>Eugene Eton</strong> for stat scrolls and tourmalines.
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 text-center font-mono text-xs">
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 1</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +2
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 2</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +4
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 3</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +8
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 4</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +16
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 5</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +30
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 6</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +60
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 7</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +120
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 8</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +240
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 9</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +500
                        </span>
                    </div>
                    <div class="p-2.5 rounded-lg bg-surface/50 border border-border flex items-center justify-between px-3">
                        <span class="text-muted-foreground">Gen 10</span>
                        <span class="inline-flex items-center gap-1 font-bold text-foreground">
                            <img src="/images/guides/elevage/geneton.png" alt="" class="no-zoom w-3.5 h-3.5 object-contain" />
                            +500
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 my-6">
                    <div class="p-3.5 rounded-xl border border-border bg-surface/50 flex items-center gap-3">
                        <img src="/images/guides/elevage/geneton.png" alt="Geneton" class="no-zoom w-10 h-10 object-contain shrink-0" />
                        <div>
                            <strong class="text-xs text-foreground block">Geneton</strong>
                            <span class="text-[11px] text-muted-foreground block">Awarded when newborn surpasses genetic ancestors.</span>
                        </div>
                    </div>
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
            </div>
            <!-- END PANE 4 : LEVEL 200 XP & GENETONS -->

            <!-- ========================================== -->
            <!-- 📅 TAB 5 : BREEDER'S ALMANAX CALENDAR      -->
            <!-- ========================================== -->
            <div class="guide-tab-pane hidden" data-pane="almanax">
                <h2>I. Breeder Almanax Calendar: 13 Key Dates (Verified Dofus 3.7)</h2>
                <p>The Almanax sets the tempo of the breeding year with pivotal bonuses. In 3.7, with mounts leveling up to 200 and industrial production of Fuels and Makinas, certain days are essential economic milestones.</p>

                <div class="my-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-muted-foreground leading-relaxed">
                    <strong class="text-foreground">⚠️ Dofus 3 Correction & Legacy Wikis:</strong>
                    Several outdated community guides incorrectly state <em>October 12</em> for the rising generation bonus. In Dofus 3 (verified via official Almanax data), <strong>Takeza is a dynamic holiday tied to Canadian Thanksgiving (the 2nd Monday of October)</strong>: in 2027 it takes place on <strong>Monday, October 11, 2027</strong> (+20% target generation chance with 4x Onion Shepherd's Pie). October 12 is a Divine Dimensions bonus with no breeding link. In addition, crafting bonuses (May 10 and August 10) now apply directly to <strong>Paddock Fuel and Makinas</strong> in 3.7.
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date (2027)</th>
                            <th>Meridia</th>
                            <th>Official Tribute</th>
                            <th>Breeding Bonus 3.7</th>
                            <th>Breeder Strategy & Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>January 10</strong></td>
                            <td>Troma</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-janvier-ceinture-celerite.png" alt="Celerity Belt" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>1x Celerity Belt</code></span>
                                </div>
                            </td>
                            <td><strong>Drinking Troughs</strong> effect doubled</td>
                            <td>Maturity ×2 in the neutral zone (-2,000 to +2,000). Accelerates rideability threshold.</td>
                        </tr>
                        <tr>
                            <td><strong>February 10</strong></td>
                            <td>Meash</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-fevrier-pic-dragodinde-doree.png" alt="Golden Dragoturkey Spike" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>6x Golden Dragoturkey Spike</code></span>
                                </div>
                            </td>
                            <td>100% babies <strong>Enduring</strong></td>
                            <td>Permanent accelerated endurance gain for all offspring born on this day.</td>
                        </tr>
                        <tr>
                            <td><strong>March 10</strong></td>
                            <td>Inndo</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-mars-petit-extrait-foudroyeur.png" alt="Small Lightning Thrower Extract" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>5x Small Lightning Thrower Extract</code></span>
                                </div>
                            </td>
                            <td><strong>Lightning Throwers</strong> effect doubled</td>
                            <td>Endurance ×2 in negative mood. Cuts mount preparation cycles in half.</td>
                        </tr>
                        <tr>
                            <td><strong>April 10</strong></td>
                            <td>Nunu</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-avril-anneau-fortifiant.png" alt="Fortifying Ring" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>2x Fortifying Ring</code></span>
                                </div>
                            </td>
                            <td><strong>Slappers</strong> effect doubled</td>
                            <td>2× faster mood drop towards the negative pole (endurance).</td>
                        </tr>
                        <tr>
                            <td><strong>May 10</strong></td>
                            <td>Loumi</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-mai-petit-extrait-baffeur.png" alt="Small Slapper Extract" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>5x Small Slapper Extract</code></span>
                                </div>
                            </td>
                            <td><strong>15% ingredient economy</strong> on crafts</td>
                            <td><strong>Massive 3.7 Economy:</strong> Save 15% of your resources when mass-crafting paddock Fuels and Makinas.</td>
                        </tr>
                        <tr>
                            <td><strong>June 10</strong></td>
                            <td>Jibejan</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-juin-lailait-amande.png" alt="Almond Lailait" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>1x Almond Lailait</code></span>
                                </div>
                            </td>
                            <td><strong>Mangers</strong> effect doubled (XP ×2)</td>
                            <td><strong>3.7 Essential:</strong> Halves the time needed to level breeders to 200 (stacks with Wise to reach lvl 200 in ~30h!).</td>
                        </tr>
                        <tr>
                            <td><strong>July 10</strong></td>
                            <td>Jihelair</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-juillet-arc-sifflant.png" alt="Whistling Bow" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>1x Whistling Bow</code></span>
                                </div>
                            </td>
                            <td>100% babies <strong>In Love</strong></td>
                            <td>Accelerated love gain to prepare continuous breeding cycles.</td>
                        </tr>
                        <tr>
                            <td><strong>August 10</strong></td>
                            <td>Rigamix</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-aout-petit-extrait-mangeoire.png" alt="Small Manger Extract" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>5x Small Manger Extract</code></span>
                                </div>
                            </td>
                            <td><strong>+25% duplicate craft chance</strong></td>
                            <td><strong>Maximum Profit:</strong> 25% free bonus Makinas (Optimakina, Animakina) and Fuels when crafting!</td>
                        </tr>
                        <tr>
                            <td><strong>September 10</strong></td>
                            <td>Mau</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-septembre-petit-extrait-caresseur.png" alt="Small Stroker Extract" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>5x Small Stroker Extract</code></span>
                                </div>
                            </td>
                            <td><strong>Strokers</strong> effect doubled</td>
                            <td>2× faster mood increase towards the positive pole (love).</td>
                        </tr>
                        <tr>
                            <td><strong>October 10</strong></td>
                            <td>Benjo</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-octobre-dent-dragodinde.png" alt="Dragoturkey Tooth" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>6x Dragoturkey Tooth</code></span>
                                </div>
                            </td>
                            <td>100% babies <strong>Wise</strong> (XP ×2 for life)</td>
                            <td><strong>The Queen Ability in 3.7:</strong> Doubles manger and combat XP permanently. A Wise mount reaches lvl 200 twice as fast.</td>
                        </tr>
                        <tr class="bg-primary/5">
                            <td><strong>October 11, 2027</strong><br/><span class="text-[10px] text-muted-foreground font-mono">2nd Monday of Oct</span></td>
                            <td><strong>Takeza</strong></td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/11-octobre-parmentier-oignon.png" alt="Onion Shepherd's Pie" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>4x Onion Shepherd's Pie</code></span>
                                </div>
                            </td>
                            <td><strong>+20% target generation chance</strong></td>
                            <td><strong>Most Important Day of the Year:</strong> Stacking with Optimakina (+20%) and parent levels (+30%) guarantees 100% breeding success without maxing both parents to level 200.</td>
                        </tr>
                        <tr>
                            <td><strong>November 10</strong></td>
                            <td>Otoul</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-novembre-goujon.png" alt="Gudgeon" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>40x Gudgeon</code></span>
                                </div>
                            </td>
                            <td>100% babies <strong>Precocious</strong></td>
                            <td>Faster maturity gain in troughs for future generations.</td>
                        </tr>
                        <tr>
                            <td><strong>December 10</strong></td>
                            <td>Foya</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <img src="/images/guides/elevage/almanax/10-decembre-queue-dragodinde-sauvage.png" alt="Wild Dragoturkey Tail" class="no-zoom w-6 h-6 object-contain shrink-0" />
                                    <span><code>6x Wild Dragoturkey Tail</code></span>
                                </div>
                            </td>
                            <td><strong>Dragobutts</strong> effect doubled</td>
                            <td>Love ×2 in positive mood. Maxes out love gauges in record time.</td>
                        </tr>
                    </tbody>
                </table>

                <h2>II. Strategic Tribute Stockpiling</h2>
                <p>Experienced breeders build their stocks weeks in advance. Nearing Takeza (October 11) or duplicate crafting days (August 10), tribute market prices (e.g., Onion Shepherd's Pie) skyrocket on the marketplace. Crafting and storing ingredients early unlocks massive profit margins.</p>
            </div>
            <!-- END PANE 5 : ALMANAX -->

            <!-- ========================================== -->
            <!-- 🏆 TAB 6 : BREEDING ACHIEVEMENTS (1,211 PTS)-->
            <!-- ========================================== -->
            <div class="guide-tab-pane hidden" data-pane="succes">
                <h2>I. Complete Overview of Unity Breeding Achievements (1,211 Points)</h2>
                <p>Breeding in Dofus 3 is one of the game's most lucrative and prestigious achievement lines, granting a total of <strong>1,211 achievement points</strong> across 4 major families: General (161 pts), Dragoturkeys (350 pts), Seemyools (350 pts), and Rhineetles (350 pts).</p>

                <!-- ORNAMENT REWARD SCORECARD -->
                <div class="my-6 p-5 rounded-2xl border border-amber-500/30 bg-surface/80 flex flex-col md:flex-row items-center gap-6">
                    <div class="w-20 h-20 shrink-0 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-2">
                        <img src="/images/guides/elevage/achievements/ornement-dragomaitre.png" alt="Imposing Dragomaster Ornament" class="no-zoom w-16 h-16 object-contain" />
                    </div>
                    <div class="flex-1 text-center md:text-left">
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                            Ultimate Reward
                        </div>
                        <h3 class="text-base font-bold text-foreground">« Imposing Dragomaster » Ornament & Title</h3>
                        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Unlocked by completing the master achievement <strong>« Who's The Daddy? »</strong> (100 pts). Requires 1,000 births, wild captures, and the 10 generations meta-achievements for all 3 species.
                        </p>
                    </div>
                    <div class="flex items-center gap-4 shrink-0 text-center">
                        <div class="p-3 rounded-xl border border-border bg-surface/50 min-w-24">
                            <span class="text-xl font-bold font-mono text-foreground block">1,211</span>
                            <span class="text-[10px] text-muted-foreground uppercase font-semibold">Total Points</span>
                        </div>
                    </div>
                </div>

                <!-- 1. GENERAL & BIRTHS -->
                <h2>II. General Breeding & Birth Milestones (161 Points)</h2>
                <p>These achievements complete automatically across all your matings and mount species:</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
                    <div class="p-3.5 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/naissance-1.png" alt="" class="no-zoom w-10 h-10 object-contain shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                <strong class="text-xs text-foreground">Did She Eat Too Much?</strong>
                                <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">1 pt</span>
                            </div>
                            <span class="text-[11px] text-muted-foreground block">Give birth to 1 mount.</span>
                        </div>
                    </div>
                    <div class="p-3.5 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/naissance-10.png" alt="" class="no-zoom w-10 h-10 object-contain shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                <strong class="text-xs text-foreground">Matron</strong>
                                <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">10 pts</span>
                            </div>
                            <span class="text-[11px] text-muted-foreground block">Give birth to 10 mounts.</span>
                        </div>
                    </div>
                    <div class="p-3.5 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/naissance-100.png" alt="" class="no-zoom w-10 h-10 object-contain shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                <strong class="text-xs text-foreground">Midwife</strong>
                                <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">20 pts</span>
                            </div>
                            <span class="text-[11px] text-muted-foreground block">Give birth to 100 mounts.</span>
                        </div>
                    </div>
                    <div class="p-3.5 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/naissance-1000.png" alt="" class="no-zoom w-10 h-10 object-contain shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                <strong class="text-xs text-foreground">One More Push!</strong>
                                <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">30 pts</span>
                            </div>
                            <span class="text-[11px] text-muted-foreground block">Give birth to 1,000 mounts.</span>
                        </div>
                    </div>
                    <div class="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 flex items-center gap-3 md:col-span-2">
                        <img src="/images/guides/elevage/achievements/trophee-or.png" alt="" class="no-zoom w-12 h-12 object-contain shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                <strong class="text-xs text-foreground font-bold">Who's The Daddy? (Meta-Achievement)</strong>
                                <span class="text-xs font-mono font-bold text-amber-500 bg-amber-500/20 px-2.5 py-0.5 rounded">100 pts</span>
                            </div>
                            <span class="text-[11px] text-muted-foreground block mt-0.5">Complete: One More Push, Wild Captures, From Generation to Generation, Aquatic Generations, and Generation R.</span>
                        </div>
                    </div>
                </div>

                <!-- 2. DRAGOTURKEYS -->
                <h2>III. Dragoturkeys: The 10 Generations (350 Points)</h2>
                <p>Capture wild species and breed all varieties across all 10 generations (66 distinct breeds):</p>

                <div class="space-y-2.5 my-4">
                    <div class="p-3 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/capture-dragodinde.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                        <div class="min-w-0 flex-1 flex items-center justify-between">
                            <div>
                                <strong class="text-xs text-foreground block">Just a Sample</strong>
                                <span class="text-[11px] text-muted-foreground">Capture wild Dragoturkeys (Almond, Ginger, Golden) using the Mount Taming spell.</span>
                            </div>
                            <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">10 pts</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-2.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Second Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 2 breeds (10 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-3.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Third Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 3 breeds (20 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-4.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Fourth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 4 breeds (20 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-5.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Fifth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 5 breeds (30 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-6.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Sixth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 6 breeds (30 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-7.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Seventh Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 7 breeds (40 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-8.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Eighth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 8 breeds (40 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-9.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Ninth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 9 breeds (50 pts)</span>
                            </div>
                        </div>
                        <div class="p-2.5 rounded-lg border border-border bg-surface/30 flex items-center gap-2.5">
                            <img src="/images/guides/elevage/achievements/generation-10.png" alt="" class="no-zoom w-7 h-7 object-contain shrink-0" />
                            <div class="min-w-0 flex-1">
                                <span class="text-xs font-semibold text-foreground block">Tenth Generation</span>
                                <span class="text-[10px] text-muted-foreground">All Gen 10 breeds (50 pts)</span>
                            </div>
                        </div>
                    </div>

                    <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="/images/guides/elevage/achievements/trophee-or.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                            <div>
                                <strong class="text-xs text-foreground block">From Generation to Generation (Meta Dragoturkeys)</strong>
                                <span class="text-[11px] text-muted-foreground">Give birth to all generations of Dragoturkeys.</span>
                            </div>
                        </div>
                        <span class="text-xs font-mono font-bold text-amber-500 bg-amber-500/20 px-2.5 py-0.5 rounded">50 pts</span>
                    </div>
                </div>

                <!-- 3. SEEMYOOLS -->
                <h2>IV. Seemyools: The Underwater Depths (350 Points)</h2>
                <p>Capture wild specimens in Sufokia Abysses and breed all 10 generations (82 breeds):</p>

                <div class="space-y-2.5 my-4">
                    <div class="p-3 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/capture-muldo.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                        <div class="min-w-0 flex-1 flex items-center justify-between">
                            <div>
                                <strong class="text-xs text-foreground block">Marine Sampling</strong>
                                <span class="text-[11px] text-muted-foreground">Capture all 4 wild Seemyools (Golden, Ebony, Indigo, Crimson) in Abyssal zones.</span>
                            </div>
                            <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">10 pts</span>
                        </div>
                    </div>
                    
                    <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="/images/guides/elevage/achievements/trophee-or.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                            <div>
                                <strong class="text-xs text-foreground block">Aquatic Generations (Meta Seemyools)</strong>
                                <span class="text-[11px] text-muted-foreground">Validate births for Seemyool Generations 2 to 10 (290 cumulative pts).</span>
                            </div>
                        </div>
                        <span class="text-xs font-mono font-bold text-amber-500 bg-amber-500/20 px-2.5 py-0.5 rounded">50 pts</span>
                    </div>
                </div>

                <!-- 4. RHINEETLES -->
                <h2>V. Rhineetles: The Wild Peaks (350 Points)</h2>
                <p>Track rare wild Rhineetles on mountain peaks and unlock all 10 generations (80 breeds):</p>

                <div class="space-y-2.5 my-4">
                    <div class="p-3 rounded-xl border border-border bg-surface/40 flex items-center gap-3">
                        <img src="/images/guides/elevage/achievements/capture-volkorne.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                        <div class="min-w-0 flex-1 flex items-center justify-between">
                            <div>
                                <strong class="text-xs text-foreground block">Horned Sampling</strong>
                                <span class="text-[11px] text-muted-foreground">Capture all 4 wild Rhineetles (Almond, Golden, Ebony, Indigo).</span>
                            </div>
                            <span class="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">10 pts</span>
                        </div>
                    </div>
                    
                    <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <img src="/images/guides/elevage/achievements/trophee-or.png" alt="" class="no-zoom w-8 h-8 object-contain shrink-0" />
                            <div>
                                <strong class="text-xs text-foreground block">Generation R (Meta Rhineetles)</strong>
                                <span class="text-[11px] text-muted-foreground">Validate births for Rhineetle Generations 2 to 10 (290 cumulative pts).</span>
                            </div>
                        </div>
                        <span class="text-xs font-mono font-bold text-amber-500 bg-amber-500/20 px-2.5 py-0.5 rounded">50 pts</span>
                    </div>
                </div>

                <!-- 5. STRATEGY -->
                <h2>VI. Optimization Strategy: Rushing 1,211 Points</h2>
                <ul>
                    <li><strong>Pure Line Rule:</strong> Always keep a pure breeding pair for each unlocked color. Heterogeneous ancestry ruins your chances of producing high-tier offspring.</li>
                    <li><strong>Takeza Mating Day:</strong> Plan your toughest generation unlocks (Gen 8, 9, 10) during the Takeza bonus (+20%) combined with Optimakina (+20%) for guaranteed 100% success.</li>
                    <li><strong>1,000 Births Grinding:</strong> Catch wild generation 1 Dragoturkeys in Koalak Mountain (instant level 60 fights). Their gauges fill up quickly using low-tier fuel extracts. Since births are instant upon mating, systematically clone sterile parents (2 sterile parents = 1 fresh fertile mount) to loop births and hit the 1,000 threshold at minimum cost without mount shortage.</li>
                </ul>

                <!-- FINAL GRAND STUDIO CTA -->
                <div class="mt-8 p-6 rounded-2xl border border-border bg-surface/60 text-center">
                    <h3 class="text-base font-bold text-foreground mb-1.5">Ready to optimize your breeding?</h3>
                    <p class="text-xs text-muted-foreground max-w-lg mx-auto mb-4">Open our interactive simulator to calculate crossing odds, check serenity windows, and track all 10 generations.</p>
                    <a href="/elevage" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background font-semibold text-xs hover:opacity-90 transition-opacity">
                        <img src="/images/guides/elevage/dragodindes.png" alt="" class="no-zoom w-4 h-4 object-contain" />
                        <span>Launch Breeding Studio 3.7</span>
                    </a>
                </div>
            </div>
            <!-- END PANE 6 : ACHIEVEMENTS -->
        </div>
    `,
};
