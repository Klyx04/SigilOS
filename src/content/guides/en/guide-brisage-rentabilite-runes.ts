export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Crushing & Rune Profitability Guide on Dofus (2026)",
    description:
        "Mathematical focus formula, secret server rates from 1% to 4,000%, item level brackets, and a step-by-step method to maximize crushing profits on Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Major Economic Powerhouse</strong>
            <p>The crusher located in Smithmagic workshops is the <strong>near-exclusive generator of runes</strong> in the Dofus ecosystem. Mastering the focus formula and server crush rates allows you to secure clean profit margins of 200% to 500% with a modest starting investment.</p>
        </div>

        <p>
            On Dofus, crushing equipment to extract runes is a precise science. Many players crush at random and bleed kamas, whereas a methodical scan of Marketplace resource prices combined with <strong>mathematical crushing rules</strong> reveals limitless gold mines.
        </p>

        <h2>1. How the Game Calculates Rune Yield</h2>
        <p>
            When you insert an item into the crusher, the volume of runes generated is governed by <strong>four decisive factors</strong>:
        </p>
        <ol class="steps">
            <li><strong>Item level:</strong> Higher-level equipment applies an exponential volume multiplier to the rune output.</li>
            <li><strong>Actual stat rolls:</strong> Runes are calculated based on the actual stats of the item at the exact moment it enters the crusher. Items with clean or over-rolled stats yield substantially more runes than broken rolls!</li>
            <li><strong>Unit weight (PWR) of the stat:</strong> Heavy stats (AP, MP, Range) generate rare runes in small batches, whereas light stats (Vitality, Initiative) yield hundreds of runes.</li>
            <li><strong>Secret server crush rate:</strong> The hidden dynamic multiplier applied to that specific item, ranging from <strong>1% to 4,000%</strong>.</li>
        </ol>

        <h2>2. The Secret Rate: From 1% to 4,000%</h2>
        <p>
            Every piece of equipment possesses a <strong>hidden server rate</strong> that fluctuates in real-time following the law of supply and demand:
        </p>
        <ul>
            <li><strong>Massively crushed items:</strong> The rate collapses toward a basement floor (often plunging to 1% or 20%).</li>
            <li><strong>Ignored or forgotten items:</strong> The rate steadily climbs over time. For overlooked recipes, it is common to uncover rates soaring between <strong>300%, 800%, and all the way to the 4,000% hard cap</strong>!</li>
        </ul>

        <div class="callout callout-warning">
            <strong>The Absolute Golden Rule: The 1-Item Test Craft</strong>
            <p><strong>NEVER</strong> start crafting 50 or 100 copies of an item without first <strong>crafting and crushing a single test item</strong>. The chat log immediately reveals the exact server percentage. If the rate is 40%, you avoided a financial catastrophe; if it is 650%, you can proceed with confidence!</p>
        </div>

        <h2>3. The Focus Option: Mathematical Formula &amp; Strategic Decision</h2>
        <p>
            In the crushing interface, you can choose between crushing normally or selecting a <strong>Stat Focus</strong> (e.g. % Fire Resistance Focus, Strength Focus, MP Reduction Focus).
        </p>

        <div class="callout callout-important">
            <strong>The Official Formula for Focus Crushing Density</strong>
            <p class="font-mono text-cyan-300 my-2">
                Focus crushing density = Density of focused stat + (Total density of all other stats / 2)
            </p>
            <p>When focus is enabled, the entire crushing yield is converted <strong>exclusively into the targeted rune</strong>, but all other stats on the item only contribute at <strong>50%</strong> of their value.</p>
        </div>

        <h3>The Fail-Safe Rule: When to Focus?</h3>
        <p>
            Should you tick the focus box or stick with a standard crush? The answer is purely mathematical:
        </p>
        <p class="bg-zinc-900/60 p-4 rounded-lg border border-zinc-800 font-semibold text-emerald-400">
            Enable focus only if the [Market Price / Density] ratio of the target rune is at least 2x higher than the average [Market Price / Density] ratio across all other stats on the item.
        </p>
        <ul>
            <li><strong>When NOT to focus:</strong> When the item features multiple balanced high-value lines (e.g. an item providing AP + Range + 3% Res + 15 Flat Dam). Crushing without focus yields all of these precious runes without suffering the 50% penalty!</li>
            <li><strong>When TO focus:</strong> When the item has only one standout valuable stat (e.g. +4% Water Res worth a fortune in the Marketplace) surrounded by cheap filler lines (minor initiative or base stats). The focus concentrates all the value onto the money-making rune.</li>
        </ul>

        <h2>4. Profitability by Item Level Bracket</h2>
        <p>
            Different item level tiers serve distinct economic purposes:
        </p>

        <div class="overflow-x-auto my-6">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-zinc-700 bg-zinc-900/80 text-sm">
                        <th class="p-3">Level Bracket</th>
                        <th class="p-3">Runes Generated</th>
                        <th class="p-3">Rate Behavior</th>
                        <th class="p-3">Recommended Strategy</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800 text-sm">
                    <tr>
                        <td class="p-3 font-semibold text-zinc-300">Level 1 to 60</td>
                        <td class="p-3">Basic runes only (Vit, Str, Ini...)</td>
                        <td class="p-3">Often very low (10% to 60%) due to massive crafting for leveling professions.</td>
                        <td class="p-3 text-zinc-400">Mainly for achievements or recycling profession grind leftovers. Rarely profitable.</td>
                    </tr>
                    <tr class="bg-emerald-950/20">
                        <td class="p-3 font-bold text-emerald-300">Level 61 to 150 <span class="text-xs bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">The Golden Zone</span></td>
                        <td class="p-3">Basic, Pa, and early Ra runes</td>
                        <td class="p-3 font-semibold text-emerald-400">Exceptional hidden rates (200% to 1,200% on hundreds of forgotten items).</td>
                        <td class="p-3 text-zinc-300"><strong>The core profit driver!</strong> Inexpensive recipes using abundant mob drops. Massive kama multiplier.</td>
                    </tr>
                    <tr class="bg-amber-950/20">
                        <td class="p-3 font-bold text-amber-300">Level 151 to 200</td>
                        <td class="p-3">Guaranteed Pa and Ra runes, Ap Ga, Mp Ga, % Res</td>
                        <td class="p-3 font-semibold text-amber-400">Stable rates (50% to 250%), rarely above 400%.</td>
                        <td class="p-3 text-zinc-300">Mass production of heavy, highly liquid runes. Demands higher starting capital for pebbles and boss essences.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>5. Rune Fusion at the Crusher (3 for 1)</h2>
        <p>
            Inside Smithmagic workshops, the crusher also provides an indispensable utility: <strong>rune fusion</strong>.
        </p>
        <p class="font-mono bg-zinc-900/60 p-3 rounded-lg text-yellow-400 border border-zinc-800">
            3 Simple Runes ➔ 1 Pa Rune (e.g. 3 Int = 1 Pa Int)<br />
            3 Pa Runes ➔ 1 Ra Rune (e.g. 3 Pa Int = 1 Ra Int, equivalent to 9 basic Int runes)
        </p>
        <p>
            <strong>Why fuse your runes?</strong>
        </p>
        <ul>
            <li><strong>Reduce inventory weight:</strong> Thousands of basic runes take up massive pod space.</li>
            <li><strong>Boost Marketplace sales margins:</strong> End-game smithmagi buy almost exclusively Pa and Ra packs. Ra runes often command a premium per 100 units compared to 900 basic runes!</li>
        </ul>

        <h2>6. The 5-Step Professional Crushing Loop</h2>
        <ol class="steps">
            <li><strong>Source low-cost recipes:</strong> Scan Marketplace ingredient prices. Spot level 80 to 140 gear with crafting costs under 30,000 to 50,000 kamas.</li>
            <li><strong>Craft 1 test item:</strong> Craft a single unit and crush it immediately. Check the percentage displayed in the chat log.</li>
            <li><strong>Calculate immediate ROI:</strong> Multiply the estimated rune basket value by the revealed rate. If estimated profit exceeds 150% of the crafting cost, you are good to go.</li>
            <li><strong>Batch craft in moderation (10 to 25 copies):</strong> Do not craft 200 copies at once! Each item crushed reduces the server rate. A batch of 15 to 25 units captures maximum profit before the rate degrades.</li>
            <li><strong>Stagger Marketplace listings:</strong> List your runes in packs of 10 and 100 across multiple sessions to avoid crashing the local market.</li>
        </ol>
    `,
};
