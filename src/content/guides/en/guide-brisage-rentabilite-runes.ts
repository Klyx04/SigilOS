export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Dofus Crushing Guide: Rune Profitability (2026)",
    description:
        "Focus formula, crusher rates, break-even threshold calculations, debunking Pa/Ra myths, and batch crushing methods on Dofus Unity.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-10-29",
    draft: false,
    badgeColor: "purple",
    body: `
        <div class="callout callout-tip">
            <strong>Official Rules &amp; Market Realities (Dofus Unity 2026)</strong>
            <p>
                The smithmagic workshop crusher is the <strong>near-exclusive source of rune creation</strong> in Dofus. Its fundamental economic function (documented since devblogs 2.27 and 2.31) is to destroy items to regulate equipment supply in the game. This guide relies on official mechanics, verified community models, and Marketplace realities.
            </p>
        </div>

        <div class="guide-image-container my-6">
            <img src="/images/guides/brisage/concasseur.png" alt="Smithmagic crusher in workshop" class="guide-image max-h-48 object-contain p-2 rounded-xl border border-white/10 bg-zinc-900/50" />
            <span class="guide-caption">The crusher present in the smithmagic workshops of Bonta, Brakmar, and other cities</span>
        </div>

        <h2>1. Fundamental Rules of the Crusher</h2>
        <p>
            Before investing kamas into crafting equipment for crushing, several core rules and historical balance changes must be understood.
        </p>

        <div class="callout callout-danger">
            <strong>Official Rule: Crushed items never generate Pa or Ra runes</strong>
            <p>
                Since <strong>update 2.31</strong>, Ankama explicitly removed direct generation of <strong>Pa</strong> and <strong>Ra</strong> runes (for example <em>Pa Ine, Ra Ine, Pa Fo, Ra Fo, Pa Vi, Ra Vi</em>) when crushing.
            </p>
            <p>
                Regardless of the item level (level 1 or level 200), the crusher produces <strong>only base simple runes</strong>. Pa and Ra tiers are obtained <strong>exclusively via rune fusion (3 for 1)</strong> in the crusher interface.
            </p>
        </div>

        <!-- Visual schema of Pa/Ra fusion -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Rune generation and fusion principle (Update 2.31)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                    <img src="/images/guides/fm/rune_ga_pa.png" alt="Ga PA" class="class-icon w-8 h-8 shrink-0 object-contain" />
                    <div>
                        <strong class="text-foreground block">Ga PA Rune (100 Weight)</strong>
                        <span class="text-muted-foreground text-[11px]">Unique Action Point base rune (not affected by the removal of Pa/Ra tiers).</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/30">
                    <strong class="text-foreground block mb-1">Exclusive workshop fusion (3 for 1):</strong>
                    <div class="flex items-center gap-2 mt-2 font-mono text-xs text-foreground flex-wrap">
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            3× Ine
                        </span>
                        <span class="text-muted-foreground">➔</span>
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold text-sky-400">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            1× Pa Ine
                        </span>
                        <span class="text-muted-foreground">➔</span>
                        <span class="inline-flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded border border-border font-semibold text-amber-400">
                            <img src="/assets/dofus/game-icons/rune.png" alt="" class="w-3.5 h-3.5 object-contain" />
                            1× Ra Ine
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <h3>The myth of guaranteed 500% profit</h3>
        <p>
            Crushing does not represent an automatic dividend. The system was designed by Ankama to <strong>depress an item's yield whenever it is crushed repeatedly</strong> by the player community. Real profitability depends on raw ingredient costs, actual Marketplace rune prices, and your server's current dynamic rate.
        </p>

        <h2>2. How the Game Calculates Rune Yield</h2>
        <p>
            The quantity of runes generated upon crushing an item depends on four primary components:
        </p>
        <ol class="steps">
            <li>
                <strong>Item level:</strong> Overall rune volume increases with the level of the equipment. The 2.31 update rebalanced yields favorably for mid-level brackets (levels 50 to 150).
            </li>
            <li>
                <strong>Actual roll at crushing time:</strong> The game calculates yields from the stats actually present on the destroyed item. An absent stat line generates zero runes (for example, a Caracap missing its AP line produces no Ga PA runes).
            </li>
            <li>
                <strong>Unit weight (PWR) of the stat:</strong> Heavy stats (AP, MP, Range) generate rare runes in small numbers, whereas light stats (Vitality, Initiative) yield large batches.
            </li>
            <li>
                <strong>Dynamic server rate:</strong> The secret multiplier applied to that specific item on your server at the moment of the operation.
            </li>
        </ol>

        <!-- Pipeline Diagram -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Diagram — Crusher Rune Generation Pipeline
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">01</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">1. Item &amp; Real Stats</strong>
                        <span class="text-muted-foreground text-[11px]">Item level and effective stat lines</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">02</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">2. Weight (PWR)</strong>
                        <span class="text-muted-foreground text-[11px]">Unit density of each characteristic</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">03</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">3. Server Rate</strong>
                        <span class="text-muted-foreground text-[11px]">Dynamic secret multiplier per server</span>
                    </div>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/40 flex flex-col items-start gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-muted text-foreground border border-border">04</span>
                    <div>
                        <strong class="text-foreground block mb-0.5">4. Rune Output</strong>
                        <span class="text-muted-foreground text-[11px]">Base runes produced (with or without focus)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="callout callout-warning">
            <strong>Should you mage item rolls before crushing?</strong>
            <p>
                A superior stat roll yields higher theoretical returns. However, investing runes into upgrading an item is only profitable if <strong>the market value of extra runes exceeds the cost of runes consumed during smithmagic</strong>. On low and mid-tier items, this practice almost systematically creates net losses.
            </p>
        </div>

        <h2>3. The Secret Rate: Communicating Vessels</h2>
        <p>
            Each equipment piece possesses an independent dynamic rate calculated on each game server:
        </p>
        <ul>
            <li>
                <strong>Frequently crushed items:</strong> The multiplier drops with every destruction, sometimes reaching extremely low floors (10% to 20%).
            </li>
            <li>
                <strong>Forgotten or unpopular crafts:</strong> Destructions of other items slowly redistribute bonuses across the entire catalog. Neglected recipes can thus climb to elevated rates (frequently observed between 200% and 800%, with community observations up to 4000%).
            </li>
        </ul>

        <!-- Communicating vessels diagram -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Dynamic Behavior of Server Multipliers (Devblog 2.27)
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div class="p-3.5 rounded-lg border border-border">
                    <strong class="text-foreground block mb-1">Massive destruction of a popular item</strong>
                    <p class="text-muted-foreground text-[11px] m-0">
                        Every single item crushed lowers its own rate. Unit profitability diminishes as volume increases.
                    </p>
                </div>
                <div class="p-3.5 rounded-lg border border-border">
                    <strong class="text-foreground block mb-1">Redistribution toward neglected recipes</strong>
                    <p class="text-muted-foreground text-[11px] m-0">
                        Overall server crushing activity feeds bonus multipliers to unexploited items. This is not a fixed timer: without server activity, rates do not increase.
                    </p>
                </div>
            </div>
        </div>

        <div class="callout callout-important">
            <strong>Safety Rule: Single-Unit Test Run</strong>
            <p>
                An item's rate remains completely hidden until a specimen is crushed. Never launch a batch of 20 or 50 crafts without having <strong>crafted and crushed a single test unit first</strong>.
            </p>
            <p class="mt-2 text-xs">
                <strong>Beware of double-counting rates:</strong> runes obtained from your test crush <em>already</em> reflect the server's rate. When valuing received runes, do not apply the chat percentage a second time.
            </p>
        </div>

        <h2>4. The Focus Option and the 50% Rule</h2>
        <p>
            In the crushing interface, you can crush normally or choose a specific <strong>Stat Focus</strong> (for example Vitality Focus, % Water Resistance Focus, AP Reduction Focus).
        </p>

        <div class="callout callout-important">
            <strong>Official Focus Formula (Ankama Devblog)</strong>
            <p class="font-mono text-sm my-2 p-2 rounded bg-muted/60 border border-border">
                Focus Density = Targeted Stat Density + (Total Density of Other Stats ÷ 2)
            </p>
            <p class="text-xs text-muted-foreground m-0">
                With stat focus enabled, all output is converted <strong>exclusively into the chosen rune type</strong>. The selected stat line retains 100% value, whereas all other lines suffer a <strong>50% loss</strong> during conversion.
            </p>
        </div>

        <!-- Focus conversion diagram -->
        <div class="my-6 p-5 rounded-xl border border-border bg-surface">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Numerical Example of Focus Conversion
            </p>
            <div class="space-y-3 text-xs">
                <div class="p-3.5 rounded-lg border border-border bg-muted/20">
                    <div class="flex items-center justify-between font-semibold mb-1">
                        <span class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                            Standard Crushing (No Focus)
                        </span>
                        <span class="font-mono text-foreground">Total = 400 density units distributed</span>
                    </div>
                    <p class="text-muted-foreground text-[11px] m-0">
                        Stat A (100 units) + Stat B (180 units) + Stat C (120 units) = Each generates its respective runes without any penalty.
                    </p>
                </div>
                <div class="p-3.5 rounded-lg border border-border bg-muted/20">
                    <div class="flex items-center justify-between font-semibold mb-1">
                        <span class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Focus Crushing on Stat A
                        </span>
                        <span class="font-mono text-foreground">Total = 250 units of rune A</span>
                    </div>
                    <p class="text-muted-foreground text-[11px] m-0">
                        100 (Stat A kept at 100%) + (180 + 120) ÷ 2 (300 units halved = 150) = <strong>250 units concentrated into rune A</strong>. 150 units of density were destroyed by the penalty.
                    </p>
                </div>
            </div>
        </div>

        <h3>When should you activate stat focus?</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 text-xs">
            <div class="p-4 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2 mb-2 font-bold text-foreground">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>When to enable focus</span>
                </div>
                <p class="text-muted-foreground text-[11px] leading-relaxed m-0">
                    When the equipment features a single high-value market line (such as <strong>% Elemental Resistance</strong> or <strong>AP Reduction</strong>) surrounded by low-value filler stats (Initiative, Pods). The gain on expensive runes easily offsets halving secondary lines.
                </p>
            </div>
            <div class="p-4 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2 mb-2 font-bold text-foreground">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span>When NOT to enable focus</span>
                </div>
                <p class="text-muted-foreground text-[11px] leading-relaxed m-0">
                    When the equipment possesses multiple balanced major stats (such as <strong>AP</strong>, <strong>Range</strong>, <strong>Damage</strong>, and <strong>Summons</strong>). Standard crushing preserves all valuable rune categories without applying the 50% penalty.
                </p>
            </div>
        </div>

        <h2>5. Profitability Model and Break-Even Point</h2>
        <p>
            A high rate alone does not guarantee net income. If an item costs 60,000 kamas to craft and its neutral rune output is worth only 10,000 kamas, a 400% rate still operates at a loss.
        </p>

        <div class="p-4 rounded-xl border border-border bg-surface my-4">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Minimum Break-Even Multiplier Formula (c_min)
            </p>
            <p class="font-mono text-sm p-2 rounded bg-muted/60 border border-border my-1">
                c_min = Crafting Cost ÷ ( Value at 100% × (1 - Marketplace Fee) )
            </p>
            <p class="text-xs text-muted-foreground mt-2 m-0">
                This threshold represents the exact multiplier below which your operation causes a net financial deficit once marketplace listing fees are deducted.
            </p>
        </div>

        <h3>Numerical Simulation</h3>
        <p>
            Consider a mid-tier item with the following economic parameters:
        </p>
        <table>
            <thead>
                <tr>
                    <th>Indicator</th>
                    <th>Value</th>
                    <th>Role in Decision</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Crafting Cost</strong></td>
                    <td class="font-mono">
                        <img src="/assets/dofus/game-icons/kamas.png" alt="" class="class-icon inline-block align-middle mr-1" />
                        40,000 kamas
                    </td>
                    <td>Expenditure to acquire ingredients on the Marketplace.</td>
                </tr>
                <tr>
                    <td><strong>Estimated Value at 100%</strong></td>
                    <td class="font-mono">
                        <img src="/assets/dofus/game-icons/kamas.png" alt="" class="class-icon inline-block align-middle mr-1" />
                        16,000 kamas
                    </td>
                    <td>Theoretical gross yield at a neutral 100% rate.</td>
                </tr>
                <tr>
                    <td><strong>Marketplace Listing Fee</strong></td>
                    <td class="font-mono">2% (0.02)</td>
                    <td>Commercial transaction taxes.</td>
                </tr>
                <tr>
                    <td><strong>Break-Even Threshold (c_min)</strong></td>
                    <td class="font-mono font-semibold">255%</td>
                    <td>Minimum required rate to amortize crafting expenses.</td>
                </tr>
            </tbody>
        </table>

        <ul>
            <li><strong>Tested rate at 160%:</strong> Generates roughly 25,600 kamas in value. Causes an immediate loss of over 14,000 kamas per craft. Abort immediately.</li>
            <li><strong>Tested rate at 260%:</strong> Generates roughly 41,600 kamas in value. Strictly covers costs with negligible profit.</li>
            <li><strong>Tested rate at 600%:</strong> Generates roughly 96,000 kamas in value. Net profit exceeds 50,000 kamas per craft. Green light for calibrated batches.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>Inventory Valuation vs Actual Kamas in Bank</strong>
            <p>
                An estimated inventory total is not realized bank income. Factor in <strong>rune liquidity</strong> (niche runes take days to clear), <strong>re-listing taxes</strong> on price adjustments, and <strong>tied-up capital</strong>.
            </p>
        </div>

        <h2>6. Five-Step Secure Batch Production Method</h2>
        <p>
            Structure your crushing sessions methodically with these five sequential steps:
        </p>
        <ol class="steps">
            <li>
                <strong>Sourcing and prior threshold check:</strong> Identify recipes between level 60 and 150 with abundant, fairly-priced ingredients. Calculate <code>c_min</code> before purchasing resources.
            </li>
            <li>
                <strong>Single-unit test craft:</strong> Craft exactly one unit without severe stat flaws. Crush it immediately (with or without focus). Read the genuine server rate in the chat box.
            </li>
            <li>
                <strong>Direct output valuation:</strong> Evaluate generated runes against current Marketplace unit prices. Deduct craft expenses to verify unit profitability.
            </li>
            <li>
                <strong>Calibrated batch run (5 to 15 units):</strong> Avoid excessive volume. Every unit crushed depresses the server rate. Short batches secure profit margins before the rate sinks below break-even.
            </li>
            <li>
                <strong>Fractional selling and fusion arbitration:</strong> List runes in packs of 10 and 100, spacing your listings to preserve market pricing stability.
            </li>
        </ol>

        <h2>7. Rune Fusion in the Crusher (3 for 1)</h2>
        <p>
            The smithmagic workshop allows combining base runes into higher tiers via the crusher interface:
        </p>
        <pre><code>3 Simple Runes ➔ 1 Pa Rune (e.g., 3 Ine = 1 Pa Ine)
3 Pa Runes ➔ 1 Ra Rune (e.g., 3 Pa Ine = 1 Ra Ine, equaling 9 simple Ine)</code></pre>

        <div class="callout callout-warning">
            <strong>Price arbitration: do not fuse automatically</strong>
            <p>
                Fusion is only profitable if <strong>the higher-tier rune unit price exceeds 3 times the lower-tier unit price</strong> (taking sales tax into account).
            </p>
            <p class="mt-2 text-xs">
                <em>Example:</em> If a Strength rune sells for 140 kamas and Pa Strength sells for 360 kamas, fusing 3 Strength runes (worth 420 kamas individually) produces a <strong>net loss of 60 kamas</strong> per operation. Sell base runes directly.
            </p>
        </div>

        <h2>8. Frequently Asked Questions</h2>

        <h3>Can I obtain an AP rune from an item without native AP?</h3>
        <p>
            No. The crusher strictly calculates runes based on characteristics effectively present on the item at the moment of destruction. An absent characteristic equals zero and generates no runes regardless of multiplier.
        </p>

        <h3>Why did the multiplier drop between my test and my batch?</h3>
        <p>
            This is standard game behavior: each destroyed item applies a localized penalty to its own multiplier to stabilize the economy. Keep batches between 5 and 15 units and recalculate margins after every run.
        </p>

        <h3>Are online crushing calculators 100% accurate?</h3>
        <p>
            They are useful community predictive tools, but Ankama does not release internal rounding algorithms or live server coefficients. Use them for guidance, but rely on your single-unit test craft for definitive verification.
        </p>
    `,
};
