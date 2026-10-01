export const guide = {
    slug: "raid-sanctuaire-jardins-eternels-dofus-guide",
    title: "Raid Guide: Eternal Gardens Sanctuary (Dofus 3)",
    description:
        "Complete guide to the Eternal Gardens Sanctuary raid in Dofus: the 4 interconnected puzzles, the 4 guardians, the 60-monster corridor, optimized party setups and strategies against the Scarlet Queen and the Cursed Princess.",
    publishedAt: "2026-09-22",
    updatedAt: "2026-09-30",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Collaborative Guild Raid — Level 200 (8 to 16 Players)</strong>
            <p>The Eternal Gardens Sanctuary is the major cooperative raid in Dofus 3. Built around a <strong>shared instance health pool (20 HP)</strong>, it demands flawless coordination across 4 interconnected puzzle wings, the elimination of 4 zone guardians, a solo combat corridor and a double final showdown against the <strong>Scarlet Queen</strong> and the <strong>Cursed Princess</strong>.</p>
        </div>

        <div class="callout callout-info">
            <strong>🛠️ Public Tools: Raid Studio 3.6 & Detachable Overlay</strong>
            <p>To organize your 16 players and solve the puzzles without losing raid health points, SigilOS provides free interactive tools:</p>
            <ul>
                <li><strong>16-Player Squad Planner:</strong> balance critical roles (Melee Tank, Range DPS, Healer, Placement), assign pairs across the 4 wings and export to Discord in 1 click.</li>
                <li><strong>Solvers for the 4 Sanctuary Puzzles:</strong>
                    <ul>
                        <li>⛵ <em>Naval Battle Solver:</em> twin 4x3 paper boat grids in [19,15] and [21,17].</li>
                        <li>♟️ <em>Belladonna Chess Solver:</em> 11x11 A1..K11 board coordinates for the 4 pieces (Rooks and Bishops).</li>
                        <li>🌸 <em>Items & Flowers Tracker:</em> catalog the 8 items on pedestals I to IV and detect the key colour.</li>
                        <li>🗿 <em>Statues & Guardians Calculator:</em> compare Clos vs Ephedra views, identify the central monster, compute the target protector and heading arrow.</li>
                    </ul>
                </li>
                <li><strong>Always-on-Top In-Game Overlay (PiP):</strong> copy <code>/travel</code> positions in 1 click and run interactive solvers directly in-game without alt-tabbing.</li>
            </ul>
            <p><a href="/raids?raid=sanctuaire"><strong>→ Open Sanctuary Planner & 4 Solvers in Raid Studio 3.6</strong></a></p>
        </div>

        <h2>I. Overview & Core Rules</h2>
        <p>
            The instance is purchased from the Guild Raids tab of the shop by an authorised guild leader or right-hand staff member.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/001-4achat.png" alt="Purchasing the Eternal Gardens Sanctuary raid" class="guide-image" />
            <span class="guide-caption">Starting the raid from the guild menu</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Setting</th>
                    <th>Value / Rule</th>
                    <th>Strategic detail</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Start cost</strong></td>
                    <td>480 Guild Kamas</td>
                    <td>Affordable for every active guild.</td>
                </tr>
                <tr>
                    <td><strong>Party size</strong></td>
                    <td>8 to 16 players (level 200)</td>
                    <td>Lets you split the team across all 4 wings at the same time (4 pairs or 4 quartets).</td>
                </tr>
                <tr>
                    <td><strong>Maximum duration</strong></td>
                    <td>2 hours (120 minutes)</td>
                    <td>The raid ends if the timer runs out or the raid HP reach 0.</td>
                </tr>
                <tr>
                    <td><strong>Score cap</strong></td>
                    <td>50,000 points</td>
                    <td>11 weekly reward milestones.</td>
                </tr>
                <tr>
                    <td><strong>Shared progression</strong></td>
                    <td>Global validation</td>
                    <td>As soon as a member or pair completes a step, it is validated for the whole raid.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. The Survival Gauge: 20 Shared Raid HP</h2>
        <p>
            Your guild starts with a pool of <strong>20 shared team HP</strong>. If this counter drops to zero, the raid fails immediately for everyone.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/003-6vie.png" alt="Team HP counter" class="guide-image" />
            <span class="guide-caption">Shared HP indicator: any combat defeat or puzzle blunder deducts points</span>
        </div>

        <ul>
            <li><strong>Puzzle error:</strong> -1 raid HP.</li>
            <li><strong>Combat defeat:</strong> -1 raid HP <em>per character engaged</em> in the lost fight.</li>
            <li><strong>Puzzle completed:</strong> +1 raid HP (up to the 20 HP maximum cap).</li>
        </ul>

        <h2>III. Overview: The 4 Interconnected Puzzles</h2>
        <p>
            The sanctuary is organized around a <strong>Central Courtyard at [10,15]</strong> branching into 4 separate zones. Each zone holds a puzzle whose solution depends directly on clues or actions performed in another wing:
        </p>
        <pre><code>/travel 10,15</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/015-23enigmes.png" alt="Puzzle layout schematic" class="guide-image" />
            <span class="guide-caption">Interconnections of the 4 wings in the Eternal Gardens Sanctuary</span>
        </div>

        <h3>1. Puzzle 1: Belladonna's Naval Battle (2,000 pts)</h3>
        <p>
            <strong>Zones involved:</strong> Monochrome Work [11,21] + Belladonna's Reserve [19,15] and [21,17].<br />
            <strong>Team Role:</strong> 1 player in the Work clicks on the <strong>6 paper boats</strong> ("Reveal position"). The boats then appear on the two sea grids in the Reserve.
        </p>
        <pre><code>/travel 19,15</code></pre>
        <pre><code>/travel 21,17</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/018-26bataille.jpg" alt="Belladonna naval battle grid" class="guide-image" />
            <span class="guide-caption">4x3 firing grid: combine a letter (column A to D) and a number (row 1 to 3) to shoot</span>
        </div>

        <p>
            Two players (or one player multi-accounting) stand on each of the two Reserve maps. <strong>Map [21,17] starts the firing sequence:</strong> activate a letter and number to fire a cannonball onto the opposing ship's coordinates (e.g. B + 2). Repeat turn by turn until all 6 ships are sunk.
        </p>

        <div class="callout callout-tip">
            <strong>Interactive Boat Solver</strong>
            <p>Use the <strong>Puzzles &gt; Boats</strong> tab in Raid Studio 3.6 or the PiP overlay to click the 4x3 grid and track all 6 ships on the fly.</p>
        </div>

        <hr />

        <h3>2. Puzzle 2: Ephedra's Chessboard (2,000 pts)</h3>
        <p>
            <strong>Zones involved:</strong> Ephedra's Courtyard [12,14] + Belladonna's Reserve [19,15].<br />
            <strong>Team Role:</strong> Talk to Belladonna in Ephedra's Courtyard to awaken the 4 chessboards in the Reserve. Note the 4 pieces glowing in green on the 11x11 board (from A1 to K11):
        </p>
        <pre><code>/travel 12,14</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/108-93tour.jpg" alt="Illuminated chess piece" class="guide-image" />
            <span class="guide-caption">Track the 4 pieces: White Rook, Black Rook, White Bishop, Black Bishop</span>
        </div>

        <p>
            Then engage the 4-player chess combat in Ephedra's Courtyard [12,14]. Each player must stand on the exact cell matching one of the 4 pieces recorded. Once all 4 cells are occupied, pass your turn to complete the trial (+2,000 pts).
        </p>

        <div class="callout callout-warning">
            <strong>Beware of incorrect cells</strong>
            <p>Any wrong cell deducts 1 HP from the raid pool (20 HP max). Use the A1..K11 board picker in the overlay to record positions before starting the fight.</p>
        </div>

        <hr />

        <h3>3. Puzzle 3: The Monochrome Work & Pedestals (2,000 pts)</h3>
        <p>
            <strong>Zones involved:</strong> Protectors' Enclosure [11,21] / [12,20] + Monochrome Work [11,21].<br />
            <strong>Team Role:</strong> Inspect pedestals I through IV in the Protectors' Enclosure. Note down the 2 items on each pedestal (8 items in total: <em>Pencils, Spool, Lantern, Kamas, Arachnee, Candle, Ring, Ruler</em>).
        </p>
        <pre><code>/travel 11,21</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/153-123fleurcamp.jpg" alt="Monochrome Work flowers" class="guide-image" />
            <span class="guide-caption">Activate the paper flowers matching the recorded items in the Monochrome Work</span>
        </div>

        <p>
            Go into the Monochrome Work to activate the 4 corresponding flowers. The final colour that lights up (<strong>Orange, Blue, Red, or Green</strong>) is the crucial key for the Statues puzzle!
        </p>

        <hr />

        <h3>4. Puzzle 4: The Protectors' Enclosure & Statues (2,000 pts)</h3>
        <p>
            <strong>Zones involved:</strong> Protectors' Enclosure [11,19] + Ephedra's Courtyard [12,14].<br />
            <strong>Team Role:</strong> Compare the 4 views of the Enclosure (Top, Bottom, Left, Right) to Ephedra's miniature to identify the monster statue that appeared in the center and the colour discovered in Step 3.
        </p>
        <pre><code>/travel 11,19</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/157-133statues.jpg" alt="Statues of the Protectors Enclosure" class="guide-image" />
            <span class="guide-caption">Verify the central statue and face the correct direction on the designated cell</span>
        </div>

        <p>
            Following the truth table (faithfully reproduced in our interactive solver), you will obtain the target protector's coordinates (<em>Fracamelia, Tritulip, Muguegide, or Dahliane</em>) and the required heading direction. Move to the cell, turn in the right direction, and engage combat to awaken the Enclosure Guardian.
        </p>

        <h2>IV. The 4 Guardians & The Castle Corridor</h2>
        <p>
            Once all 4 puzzles are solved, the 4 zone guardians awaken. Each victory awards <strong>5,000 points</strong> (20,000 pts in total):
        </p>
        <ul>
            <li><strong>Work Watcher:</strong> Air/Earth guardian with AoE pushback.</li>
            <li><strong>Enclosure Guardian:</strong> Armoured protector with shield glyphs.</li>
            <li><strong>Reserve Defender:</strong> Life steal and MP reduction specialist.</li>
            <li><strong>Courtyard Sentry:</strong> Long range non-LoS attacks.</li>
        </ul>

        <h3>The Castle Corridor (10 Rooms / 60 Solo Combats)</h3>
        <p>
            After the 4 guardians fall, the castle gates open at [14,18]. Players step into a series of 10 rooms holding 6 monsters each. Each combat is <strong>strictly solo</strong> (sidekicks are disabled).
        </p>
        <pre><code>/travel 14,18</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/106-87monstres.jpg" alt="The Castle Corridor" class="guide-image" />
            <span class="guide-caption">The 60 corridor monsters: end your turn within 4 range of the monster</span>
        </div>

        <div class="callout callout-warning">
            <strong>Vital Corridor Rules (One-shot risk)</strong>
            <ul>
                <li><strong>2,601+ Initiative mandatory:</strong> Monsters have 2,600 initiative. Equip an Initiative trophy to play first and avoid lethal turn 1 damage.</li>
                <li><strong>"Protectors' Ferocity" Passive:</strong> If you end your turn farther than 4 range from the monster with a clear line of sight, it gains 100% critical hit and doubled damage. Always end within 4 range, or place a static obstacle (tree, cawot, dial) to block LoS!</li>
                <li><strong>Each defeat deducts 1 raid HP:</strong> Do not take unnecessary risks; prioritize life steal and shielding spells.</li>
            </ul>
        </div>

        <h2>V. Final Boss 1: The Scarlet Queen (10,000 pts)</h2>
        <p>
            Located in the tower's underground crypts at [16,20], the Scarlet Queen (50,000 HP, Heavy, Un-erodable) offers a high-intensity 8-player encounter.
        </p>
        <pre><code>/travel 16,20</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/110-95reine.jpg" alt="Scarlet Queen Boss" class="guide-image" />
            <span class="guide-caption">The Scarlet Queen in the deep throne hall</span>
        </div>

        <h3>1. Phase 1: The Dungeons & The "Escaped" State</h3>
        <ul>
            <li><strong>Start in 4 pairs:</strong> Players start locked in pairs across 4 corner cells with 2 monsters sharing damage per cell. Kill all monsters to open all cells simultaneously.</li>
            <li><strong>"Imperial Exile" Spell:</strong> Each turn, the Queen imprisons a random player in a cell. The prisoner loses 10% HP per turn and skips their turn.</li>
            <li><strong>Freeing via the Floracle (5,000 damage):</strong> To free an imprisoned ally, hit the <em>Floracle</em> entity in front of the cell (+100% damage taken).</li>
            <li><strong>Escaped State (Lethal Danger):</strong> Upon release, the freed player carries the <em>Escaped</em> state for 1 turn. If the Queen hits them in melee range with <em>Execution of the Escaped</em>, they take 3,000+ instant damage! <strong>The Pandawa must lock or push the Queen far from escaped players.</strong></li>
            <li><strong>Royal Retribution:</strong> 2-turn delayed spell dealing 2,000 global damage (+1,200 extra damage if allies are still imprisoned). Free your teammates before detonation!</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/131-99floracle.jpg" alt="Floracle in front of the cell" class="guide-image" />
            <span class="guide-caption">Deal 5,000 damage to the Floracle to instantly free your teammate</span>
        </div>

        <h3>2. Phase 2: Princess's Will & The Unlock</h3>
        <p>
            At 1 HP, the Queen heals to full, becomes <strong>invulnerable</strong>, acts <strong>twice per turn</strong> and summons the <em>Princess's Will</em> (30,000 HP).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/138-107epee.jpg" alt="Rooted Pommel and Flowered Blade" class="guide-image" />
            <span class="guide-caption">The Rooted Pommel and Flowered Blade on opposite sides of the map</span>
        </div>

        <div class="callout callout-tip">
            <strong>Queen unlock sequence</strong>
            <ol>
                <li>Kill the <strong>Princess's Will</strong> first to stop heals and MP reductions.</li>
                <li>Destroy the <strong>Rooted Pommel</strong> and the <strong>Flowered Blade</strong> on the opposite borders.</li>
                <li>The Queen's invulnerability drops: unleash your heaviest burst (Iop's Wrath, Rogue bomb walls) to melt her remaining 50,000 HP!</li>
            </ol>
        </div>

        <h2>VI. Final Boss 2: The Cursed Princess (10,000 pts)</h2>
        <p>
            At the top of the castle spire at [18,22] stands the Cursed Princess (50,000 HP, <strong>Permanently Melee Invulnerable</strong>, Heavy, Un-erodable).
        </p>
        <pre><code>/travel 18,22</code></pre>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/152-123fleur.jpg" alt="Cursed Flower in the arena center" class="guide-image" />
            <span class="guide-caption">The Cursed Flower (10,000 HP): switch its control to your side</span>
        </div>

        <h3>1. The Cursed Flower (The Key Ally)</h3>
        <p>
            A 4-cell flower occupies the center. When brought down to 1 HP, it joins your team for <strong>2 full turns</strong>:
        </p>
        <ul>
            <li>Heals your team for <strong>1,200 HP per turn</strong>.</li>
            <li>Grants a massive buff of <strong>+300 Power and +10% Critical Hit</strong> to all allies.</li>
        </ul>

        <h3>2. The Cursed Aura & Petrification</h3>
        <p>
            Starting on Turn 2, any character in the Princess's <strong>direct line of sight</strong> at the start of her turn turns into a <em>Cursed Statue</em> and will suffer instant death on the next turn!
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/157-133statues.jpg" alt="Allies transformed into statues" class="guide-image" />
            <span class="guide-caption">Petrification: break line of sight or hit petrified allies in melee to free them</span>
        </div>

        <h3>3. Phase 2: Queen's Will & The "Floral Incantation" Spell</h3>
        <p>
            At 1 HP, the Princess becomes invulnerable and summons the <em>Queen's Will</em> (30,000 HP).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/166-129glyphe.jpg" alt="Purple glyph for Floral Incantation" class="guide-image" />
            <span class="guide-caption">Step into the purple glyph placed by the Flower to obtain Floral Incantation</span>
        </div>

        <ol>
            <li>Kill the <strong>Queen's Will</strong> to prevent the <em>Family Bond</em> spell (damage sharing).</li>
            <li>Leave the Cursed Flower on the enemy side: it spawns a <strong>purple glyph</strong> on the ground.</li>
            <li>A mobile player steps onto the glyph and gains the <strong>"Floral Incantation"</strong> spell (2 AP, 10 Range non-LoS).</li>
            <li>Cast <em>Floral Incantation</em> once on the Princess (applies the state), then a second time via a new glyph to <strong>remove her invulnerability permanently</strong>.</li>
            <li><strong>Counter "Floral Storm":</strong> The Princess heals 10,000 HP at 6 Bloom increments. Apply Incurable state (Eniripsa or Lesson of Grunob) to negate this heal.</li>
            <li>Finish the Princess <strong>exclusively with ranged spells and attacks</strong> (melee invulnerability remains active until the end!).</li>
        </ol>

        <h3>4. Optimized "Autowin" Strategy: Total MP Removal Confinement</h3>
        <p>
            Faced with the 50,000 HP of the Cursed Princess and her area attacks reaching up to <strong>16 Range</strong>, the safest method consists of stripping all MP to isolate her into a map corner while your 8 fighters group up at the opposite end.
        </p>

        <div class="guide-image-container">
            <img src="/assets/dofus/eclat-entravant.png" alt="Hindering Shard in Guild Hall" class="guide-image" />
            <span class="guide-caption">Hindering Shard: bonus of +30 MP Retraction and +30 AP Retraction for one combat (Guildaton Collector)</span>
        </div>

        <p>
            <strong>Gear &amp; stat prerequisites (300+ MP Retraction):</strong> Two dedicated MP removal classes (ideally an <strong>Enutrof</strong> and a <strong>Sadida</strong>) must reach at least <strong>300 MP Retraction</strong>. Invest all attribute points into Wisdom and consume a <em>Hindering Shard</em> (+30 MP Retraction and +30 AP Retraction for one fight, sold by the Guildaton Collector inside the Guild Hall).
        </p>

        <p>
            <strong>Eroding MP Dodge (Princess has 350 base MP Dodge):</strong> Even with 300+ retraction, stripping 6 MP from a target with 350 dodge requires softening her dodge first using dedicated spells:
        </p>
        <ul>
            <li><strong>Paralyzing Sap (Sadida):</strong> −15 MP dodge for 3 turns.</li>
            <li><strong>Obsolescence (Enutrof):</strong> −20 MP dodge for 2 turns.</li>
            <li><strong>Plaguing Arrow (Cra):</strong> −20 MP dodge for 2 turns.</li>
            <li><strong>Jaw (Ouginak):</strong> −30 MP dodge for 2 turns.</li>
        </ul>

        <p>
            <strong>Mandatory spells on your MP drainers:</strong>
        </p>
        <ul>
            <li><strong>Sadida:</strong> <em>Soothing Bramble, Bush Fire, Wild Grass, Mangrove, Paralyzing Sap, Aggressive Brambles</em>.</li>
            <li><strong>Enutrof:</strong> <em>Obsolescence, Clumsiness, Arm Key</em> (removes 1 unparriable MP every turn for 2 AP), <em>Gold Rush, Sifting, Shovel of the Ancients, Golden Shovel, Tool Box</em> (provides a crucial AP/MP boost to the Sadida to cast more debuffs).</li>
        </ul>

        <p>
            <strong>Initiative order &amp; tactical coordination:</strong>
        </p>
        <ul>
            <li><strong>Initiative 1 &amp; 2:</strong> Both MP drainers (Enutrof first, Sadida right after) act first to pin down the Princess right from the start of the round.</li>
            <li><strong>Initiative 3:</strong> The <strong>Eliotrope</strong> acts immediately after to lay down portal networks: the party can attack and reapply MP drain from long range while staying protected in the opposite corner.</li>
            <li><strong>AP donations:</strong> All party AP buff capabilities must be directed primarily towards the two MP removal characters.</li>
            <li><strong>Round closer (Positioner):</strong> A <strong>Pandawa</strong> placed at the very end of turn initiative pulls back any allies who moved forward to preserve the safe distance (&gt; 16 Range).</li>
            <li><strong>Phase 2 persistence:</strong> Since MP debuffs last for a full game round, the Princess remains locked at 0 MP across both of her consecutive turns in phase 2.</li>
        </ul>

        <h2>VII. Recommended Setups &amp; Synergies (16 Players)</h2>
        <p>
            A well-balanced party composition guarantees success across all 4 wings and both boss encounters:
        </p>

        <table>
            <thead>
                <tr>
                    <th>Class</th>
                    <th>Raid Role</th>
                    <th>Key Spells &amp; Tasks</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/12.png" alt="Pandawa" class="class-icon" width="20" height="20" />
                            Pandawa
                        </span>
                    </td>
                    <td><strong>Core Staple</strong> (Melee Placement &amp; Tank)</td>
                    <td><em>Brewing, Vulnerability, Karcham</em>. Locks the Scarlet Queen in melee and keeps her away from Escaped allies.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/9.png" alt="Cra" class="class-icon" width="20" height="20" />
                            Cra
                        </span>
                    </td>
                    <td><strong>Core Staple</strong> (Pure Ranged DPS)</td>
                    <td><em>Distant Shooting, Destructive Arrow, non-LoS arrows</em>. Primary DPS dealer against the Cursed Princess (melee invulnerable).</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/3.png" alt="Enutrof" class="class-icon" width="20" height="20" />
                            Enutrof
                        </span>
                    </td>
                    <td><strong>MP Drain (Autowin)</strong></td>
                    <td><em>Obsolescence, Arm Key, Clumsiness, Tool Box</em>. Lowers MP dodge by 20, drains 1 unparriable MP per turn for 2 AP, and boosts the Sadida.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/10.png" alt="Sadida" class="class-icon" width="20" height="20" />
                            Sadida
                        </span>
                    </td>
                    <td><strong>MP Drain (Autowin)</strong></td>
                    <td><em>Paralyzing Sap, Soothing Bramble, Wild Grass, Mangrove</em>. Lowers MP dodge by 15 and keeps the Princess rooted at 0 MP.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/16.png" alt="Eliotrope" class="class-icon" width="20" height="20" />
                            Eliotrope
                        </span>
                    </td>
                    <td><strong>Portal Network &amp; Safety</strong></td>
                    <td><em>Portals, Mutual Aid, Focus</em>. Allows applying MP drain and dealing damage from the opposite corner beyond 16 Range.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/18.png" alt="Ouginak" class="class-icon" width="20" height="20" />
                            Ouginak
                        </span>
                    </td>
                    <td><strong>MP Drain &amp; Amp (Optional)</strong></td>
                    <td><em>Jaw, Quarry, Prey</em>. Applies heavy -30 MP dodge debuff for 2 turns to secure MP removal.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/17.png" alt="Huppermage" class="class-icon" width="20" height="20" />
                            Huppermage
                        </span>
                    </td>
                    <td><strong>Top Ranged DPS &amp; Mobility</strong></td>
                    <td><em>Volcano, Elemental Cycle, Polarity</em>. Safely collects the purple Floral Incantation glyphs thanks to high mobility.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/13.png" alt="Rogue" class="class-icon" width="20" height="20" />
                            Rogue
                        </span>
                    </td>
                    <td><strong>Top Burst DPS</strong></td>
                    <td><em>Bomb Wall, Powder, Countdown</em>. Melts the Floracle (5k HP) in one hit and executes the Wills (30k HP).</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/8.png" alt="Iop" class="class-icon" width="20" height="20" />
                            Iop
                        </span>
                    </td>
                    <td><strong>Scarlet Queen Finisher</strong></td>
                    <td><em>Iop's Wrath, Slaughter, Power</em>. Eliminates the Scarlet Queen as soon as the Pommel and Blade are destroyed.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/1.png" alt="Feca" class="class-icon" width="20" height="20" />
                            Feca
                        </span>
                    </td>
                    <td><strong>Support &amp; Protection</strong></td>
                    <td><em>Rampart, Truce, Feca Shield</em>. Prevents raid HP losses from global damage spells like Royal Retribution.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/7.png" alt="Eniripsa" class="class-icon" width="20" height="20" />
                            Eniripsa
                        </span>
                    </td>
                    <td><strong>Support &amp; Healing</strong></td>
                    <td><em>Raid-wide healing, Stimulating Word, Incurable debuff</em>. Cancels the Princess's 10,000 HP heal.</td>
                </tr>
                <tr>
                    <td>
                        <span class="inline-flex items-center gap-2 font-bold text-foreground">
                            <img src="/assets/dofus/classes/14.png" alt="Masqueraider" class="class-icon" width="20" height="20" />
                            Masqueraider
                        </span>
                    </td>
                    <td><strong>Support &amp; Protection</strong></td>
                    <td><em>Plastron, Tortoruga at range, Psychopath Mask</em>. Provides shields to safeguard the 20 shared team HP.</td>
                </tr>
            </tbody>
        </table>

        <h3>Key Gear &amp; Optimizations</h3>
        <ul>
            <li><strong>Hindering Shard (Guild Hall):</strong> Grants +30 MP Retraction and +30 AP Retraction for 1 fight, indispensable to push drainers over the 300 MP retraction threshold.</li>
            <li><strong>300+ MP Retraction Set (Full Wisdom):</strong> Full allocation into Wisdom and specialized gear to overcome the Princess's 350 base MP dodge.</li>
            <li><strong>Initiative Trophy (2,601+ required):</strong> Crucial on every corridor fighter to act before the monsters and avoid lethal turn 1 criticals.</li>
            <li><strong>Nebulous Dofus:</strong> Line up high-damage turns with the Wills (30,000 HP) and vulnerable boss phases.</li>
            <li><strong>Lesson of Grunob or Incurable spells:</strong> Completely counters the 10,000 HP healing of <em>Floral Storm</em> during Princess Phase 2.</li>
        </ul>

        <h2>VIII. Rewards & Weekly Track</h2>
        <p>
            The weekly Sanctuary track features 11 milestones (from 2,000 to 50,000 points):
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/170-149recompenses.jpg" alt="Sanctuary rewards track" class="guide-image" />
            <span class="guide-caption">Weekly reward track of the Eternal Gardens Sanctuary</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Score Reached</th>
                    <th>Key Chests & Rewards</th>
                    <th>Special Loot</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>2,000 to 8,000 pts</td>
                    <td>Guild tokens + Guild XP</td>
                    <td>Base resources</td>
                </tr>
                <tr>
                    <td>13,000 to 28,000 pts</td>
                    <td>Sanctuary Chests</td>
                    <td>Protector flowers, Armour pieces</td>
                </tr>
                <tr>
                    <td>30,000 pts (Tier 9)</td>
                    <td>10 Protector flowers (guaranteed)</td>
                    <td>Legendary craft component</td>
                </tr>
                <tr>
                    <td><strong>40,000 to 50,000 pts</strong></td>
                    <td><strong>Majestic Sanctuary Chests</strong></td>
                    <td>Sanctuary Set, <strong>Thistlecat</strong> (1% pet)</td>
                </tr>
            </tbody>
        </table>

        <div class="guide-image-container">
            <img src="/images/guides/sanctuaire/173-153panoplie-jardins.png" alt="Sanctuary set" class="guide-image" />
            <span class="guide-caption">Complete Eternal Gardens Sanctuary Set</span>
        </div>

        <div class="callout callout-info">
            <strong>Plan your next guild raid</strong>
            <p>Find your roster templates, role assignments and member registrations directly in <a href="/raids?raid=sanctuaire"><strong>Raid Studio 3.6</strong></a> and your SigilOS guild workspace.</p>
        </div>
    `,
};
