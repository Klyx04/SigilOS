export const guide = {
    slug: "raid-gigalodon-dofus-guide",
    title: "Raid Guide: Gigalodon's Chasm (Dofus 3)",
    description:
        "Complete guide to the Gigalodon's Chasm raid in Dofus: the light mechanic, the bosses (Moraympress, Crabinator, Willorka), the puzzles, the Gigalodon fight and the reward track.",
    publishedAt: "2026-09-20",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Guild Raid — Level 200 (8 to 12 Players)</strong>
            <p>Gigalodon's Chasm is a competitive, timed underwater instance (1 hour max to trigger the final fight). This guide breaks down every depth level, the essential management of light, the elimination strategies for the 3 intermediate bosses and how to squeeze the maximum damage out of the Gigalodon to fill the score track.</p>
        </div>

        <h2>I. Overview & Access Conditions</h2>
        <p>
            The Chasm is opened directly from the <strong>Guild Hall</strong> (Guild Shop &gt; Raids tab) by a member holding the required permissions.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/02-achat-raid-boutique.png" alt="Starting the Gigalodon's Chasm raid from the shop" class="guide-image" />
            <span class="guide-caption">Buying and configuring the instance in the guild shop</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Setting</th>
                    <th>Value / Rule</th>
                    <th>Strategic impact</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Start cost</strong></td>
                    <td>360 Guild Kamas</td>
                    <td>Pays for itself as soon as the intermediate guild milestones are reached.</td>
                </tr>
                <tr>
                    <td><strong>Party size</strong></td>
                    <td>8 to 12 players (level 200)</td>
                    <td>Boss fights can be played by up to 12 participants at once.</td>
                </tr>
                <tr>
                    <td><strong>Time limit</strong></td>
                    <td>60 minutes (1 hour)</td>
                    <td>The descent, the puzzles and the chest deposit must be done before the timer runs out. Once engaged, the Gigalodon fight can run past it.</td>
                </tr>
                <tr>
                    <td><strong>Trading in the raid</strong></td>
                    <td>Strictly forbidden</td>
                    <td>Every player must manage their own resources or unique drops.</td>
                </tr>
                <tr>
                    <td><strong>Score cap</strong></td>
                    <td>60,000 points for the full track</td>
                    <td>It combines the resources deposited in the chest and the damage dealt to the Gigalodon.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. The Vital Mechanic: Light and “Dark Thoughts”</h2>
        <p>
            All the way down the abyss, every floor has a light level oscillating between <strong>Intensity 4</strong> (full brightness) and <strong>Intensity 0</strong> (total darkness).
            Every <strong>2 minutes</strong>, the floor loses one intensity step (so it takes 8 minutes to plunge a floor into complete darkness).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/18-luminomachine.jpg" alt="Luminomachine of Gigalodon's Chasm" class="guide-image" />
            <span class="guide-caption">A Luminomachine stands at the entrance and the exit of every floor</span>
        </div>

        <h3>1. Darkness Penalty: “Dark Thoughts”</h3>
        <p>
            With the exception of Willorka and the Gigalodon, all normal monsters as well as the <strong>Moraympress</strong> and the <strong>Crabinator</strong> receive massive buffs indexed on the ambient darkness at the start of their fight:
        </p>

        <table>
            <thead>
                <tr>
                    <th>Light Intensity</th>
                    <th>Monster / Boss Bonus</th>
                    <th>Out-of-combat behaviour</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Level 4</strong></td>
                    <td><strong>No bonus</strong> (optimal neutral state)</td>
                    <td>Monsters are passive.</td>
                </tr>
                <tr>
                    <td><strong>Level 3</strong></td>
                    <td>+20% Health, +100 Power</td>
                    <td>Monsters are passive.</td>
                </tr>
                <tr>
                    <td><strong>Level 2</strong></td>
                    <td>+50% Health, +250 Power</td>
                    <td>Monsters are passive.</td>
                </tr>
                <tr>
                    <td><strong>Level 1</strong></td>
                    <td>+100% Health, +500 Power, +1 MP</td>
                    <td>Monsters are passive.</td>
                </tr>
                <tr>
                    <td><strong>Level 0 (full darkness)</strong></td>
                    <td><strong>+200% Health, +1,000 Power, +2 MP</strong></td>
                    <td><strong>Automatic aggression</strong> from 10 cells away within 5 seconds!</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Feeding the Luminomachines & Salt of the Depths</h3>
        <p>
            To raise the light gauge, deposit <strong>Salt of the Depths</strong> in the <em>Luminomachines</em>. Salt is a reserve <strong>shared by the whole guild</strong> (displayed at the top of the interface), obtained through:
        </p>
        <ul>
            <li><strong>Free mining:</strong> harvestable salt veins are scattered on every floor (they respawn in 5 to 10 min, no profession required).</li>
            <li><strong>Combat drops:</strong> every group killed gives a fixed, equal share of salt to all fighters.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Team achievement — “Salt”</strong>
            <p>If your guild's global reserve simultaneously reaches <strong>100 salt</strong> (without spending any in the meantime), the whole team unlocks the special <em>Salt</em> achievement.</p>
        </div>

        <h2>III. Score Economy: Chest Deposits & Values</h2>
        <p>
            Going down the chasm earns no passive points. The raid score comes only from the mineral treasures and boss relics <strong>physically deposited in the Raid Chest</strong> at the Outpost (-1).
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/04-coffre-du-raid.jpg" alt="Raid Chest at the outpost" class="guide-image" />
            <span class="guide-caption">The deposit chest on floor -1: secure your resources before the final boss</span>
        </div>

        <div class="callout callout-warning">
            <strong>Beware of defeat</strong>
            <p>If a player loses a fight, they are sent back to the entrance and <strong>lose every undeposited resource</strong> they were carrying in their raid bag!</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Resource Type</th>
                    <th>Drop Source</th>
                    <th>Score Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Quartz / Opal / Amazonite</strong></td>
                    <td>Common drop from monsters (floors -1 to -3)</td>
                    <td>2 to 6 pts / unit</td>
                </tr>
                <tr>
                    <td><strong>Aventurine / Lapis / Jet / Onyx</strong></td>
                    <td>Common drop from abyssal monsters (-4 to -5)</td>
                    <td>10 to 30 pts / unit</td>
                </tr>
                <tr>
                    <td><strong>Moraympress Unit</strong></td>
                    <td>Guaranteed 100% drop from the Moraympress boss</td>
                    <td><strong>1,000 points</strong></td>
                </tr>
                <tr>
                    <td><strong>Crabinator Grudge</strong></td>
                    <td>Guaranteed 100% drop from the Crabinator boss</td>
                    <td><strong>5,000 points</strong></td>
                </tr>
                <tr>
                    <td><strong>Willorka Blackness</strong></td>
                    <td>Guaranteed 100% drop from the Willorka boss</td>
                    <td><strong>10,000 points</strong></td>
                </tr>
            </tbody>
        </table>

        <h2>IV. Floor-by-Floor Progression</h2>

        <h3>Floor -1: Explorers' Outpost</h3>
        <p>
            This introductory floor has 5 maps holding 18 groups in total. Once cleared, they do not respawn. This is where the team collects the first salt and has a 1% chance of getting the <em>First Cage Key Fragment</em>. Access to floor -2 opens at [4,3].
        </p>

        <hr />

        <h3>Floor -2: Moraympress Plateau (Boss 1)</h3>
        <p>
            The Moraympress nests at the bottom of the central hole at [4,7]. Before engaging, <strong>raise the light to intensity 4</strong> to strip it of its 200% Health and 1,000 Power!
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/46-boss-mureine.jpg" alt="Moraympress boss" class="guide-image" />
            <span class="guide-caption">The Moraympress and her Murare summons</span>
        </div>

        <ul>
            <li><strong>Health Points:</strong> 51,000 HP (escorted by 3 monsters: Madreporrible, Shebble, Léviatank).</li>
            <li><strong>Key spell — “Disperssssion”:</strong> 700 Water damage, summons up to 2 <em>Murares</em> in contact with players (max 10 per fight).</li>
            <li><strong>Passive — “Impératrice”:</strong> +100 Power for the Moraympress per Murare on the field.</li>
            <li><strong>The “Corroside” poison:</strong> the Murares apply a stacking poison dealing 250 extra Fire damage for every damage line the target suffers.</li>
        </ul>

        <div class="callout callout-tip">
            <strong>Lockdown strategy (Pandawa tank)</strong>
            <p>Isolate and Lock the Moraympress in a corner. By wedging the Moraympress between 2 of her own Murares Locked by a Pandawa or a sturdy Sacrier, the boss can no longer summon or reach your ranged attackers.</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/58-placement-blocage-mureine.jpg" alt="Moraympress blocking placement" class="guide-image" />
            <span class="guide-caption">Corner-blocking technique for the Moraympress behind her summons</span>
        </div>

        <hr />

        <h3>Floor -3: Drowned Cliff & the Luminarium Puzzle</h3>
        <p>
            No mandatory fight. At [4,12] stands the <strong>Luminarium</strong>: a board of 16 lanternfish (4x4 grid), some lit and some unlit, following the <em>Lights Out</em> puzzle principle.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/62-mur-luminarium.jpg" alt="The Luminarium wall" class="guide-image" />
            <span class="guide-caption">The 4x4 grid of lanternfish in the Luminarium</span>
        </div>

        <p><strong>Fast solving method:</strong></p>
        <ol>
            <li>Start from row 1 (top): for every unlit fish, click the fish directly below it (row 2).</li>
            <li>Repeat on row 2 by clicking row 3 to light the unlit lamps above.</li>
            <li>Repeat for row 3 towards row 4.</li>
            <li>Handle the two bottom corners to finish lighting everything and unlock the door to floor -4.</li>
        </ol>

        <hr />

        <h3>Floor -4: Crabinator's Warren (Boss 2 + Memory Puzzle)</h3>
        <p>
            At [9,11], fight the Crabinator (escorted by 5 monsters). You absolutely must bring the light back up to 4 before starting.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/71-boss-execrabe.jpg" alt="Crabinator boss" class="guide-image" />
            <span class="guide-caption">The Crabinator changes element and shape at every HP threshold</span>
        </div>

        <ul>
            <li><strong>The 4 Elemental Forms:</strong> Shell (Earth / Circle), Sea Urchin (Air / Star), Pearl (Fire / Square), Octopus (Water / Cone).</li>
            <li><strong>Memorising the order:</strong> scrupulously note the order in which the 4 forms appear during the fight (the statues at the edge of the map flash blue at every transition).</li>
            <li><strong>Solving the post-fight puzzle:</strong> go down under the water hole and click the 4 statues in the exact order you observed. <em>Every mistake costs the raid -1,000 pts!</em></li>
            <li><strong>The Pincer shortcut:</strong> the player who dropped the <em>Crabinator Pincer</em> must activate the lanternfish at [6,10] to link floor -2 to floor -4.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/89-statues-enigme-execrabe.jpg" alt="Statues of the Crabinator puzzle" class="guide-image" />
            <span class="guide-caption">The statues to activate in the order of the HP thresholds you met</span>
        </div>

        <hr />

        <h3>Floor -5: Abyssal Ossuary (Collecting the Fragments)</h3>
        <p>
            To open the diving cage down to floor -6 at [10,14], the group must gather <strong>4 key fragments</strong>:
        </p>
        <ul>
            <li><strong>Fragment 1:</strong> Common monster drop (floor -1).</li>
            <li><strong>Fragment 2:</strong> Obtained automatically when the Moraympress dies.</li>
            <li><strong>Fragment 3:</strong> Obtained automatically when the Crabinator dies.</li>
            <li><strong>Fragment 4:</strong> Drop from the <em>Hate'Raken</em> monsters on floor -5.</li>
        </ul>

        <div class="callout callout-info">
            <strong>Drop rate optimisation (score-dependent)</strong>
            <p>The drop rate of the 4th fragment depends on the score currently deposited in the chest: 1% below 5,000 pts, 5% at 7,000 pts, 10% at 10,000 pts and <strong>20% above 10,000 pts</strong>. It is therefore strongly recommended to go back up and deposit the Moraympress and Crabinator relics before farming floor -5!</p>
        </div>

        <hr />

        <h3>Floor -6: Willorka's Dark Deep (Boss 3)</h3>
        <p>
            Willorka (62,000 HP) lurks at [11,16]. It is a rooted boss (immovable by conventional spells, but carryable by a Pandawa) that ignores the Dark Thoughts mechanic.
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/103-boss-willorque.jpg" alt="Willorka boss" class="guide-image" />
            <span class="guide-caption">Willorka in the total darkness of the dark deep</span>
        </div>

        <div class="callout callout-tip">
            <strong>Bypass strategy (ignore the Light Count)</strong>
            <p>Do not waste time lighting up or putting out the 10 lanternfish. Carry Willorka with a Pandawa and drop it in an isolated corner with no lantern within 3 Range. Wedge it with 2 characters in contact. Move the rest of the raid away to soak up Sombre Chant and knock down its 62,000 HP to pocket <strong>10,000 points</strong> in one go!</p>
        </div>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/116-blocage-willorque-pandawa.jpg" alt="Willorka blocked by a Pandawa" class="guide-image" />
            <span class="guide-caption">Willorka isolated in a corner by a Pandawa and a sturdy bruiser</span>
        </div>

        <h2>V. The Final Boss: the Gigalodon</h2>
        <p>
            The final fight is started from the Raid Chest at the top of the outpost (-1). It lasts <strong>exactly 3 game turns</strong>. At the start of Turn 4, the automatic <em>“Gigalodoom”</em> spell instantly validates the team's victory. The goal is not to kill the boss, but to <strong>deal it the absolute maximum damage</strong> to pile up score points!
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/118-boss-gigalodon.jpg" alt="Fight against the Gigalodon" class="guide-image" />
            <span class="guide-caption">The Gigalodon emerging from the depths (large hitbox)</span>
        </div>

        <h3>1. The Gigalodon's Mechanics</h3>
        <ul>
            <li><strong>Double Action Turn:</strong> the Gigalodon plays twice per turn (at the very start of the turn, then in the middle of the timeline after the 4th or 6th player).</li>
            <li><strong>Multi-cell hitbox:</strong> it occupies a large red aquatic area. Any targeted cell transmits single-target damage.</li>
            <li><strong>“The Teeth of the Bitter Sea” capture:</strong> NEVER start your turn on the 3 direct melee cells in front of its maw! If you are there, it swallows you (you skip your turn) and places a black glyph. If an ally steps on it, the swallowed player dies on the spot.</li>
            <li><strong>Gigagroan (propagation):</strong> deals 700 Earth damage to any entity standing within 2 Range or less of an ally/summon. <strong>Spread out at least 3 cells from each other!</strong></li>
            <li><strong>Ultrasplash &amp; Spinnafin:</strong> stay on diagonals to avoid the side water cones (Ultrasplash) and move away from the banks so you are not pushed back by Spinnafin.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/131-sort-gigarale-exemple-zones.jpg" alt="Gigagroan propagation zones" class="guide-image" />
            <span class="guide-caption">Spreading out is mandatory: keep at least 3 cells between allies to neutralise Gigagroan</span>
        </div>

        <h3>2. Damage &gt; Bonus Score Conversion Table</h3>
        <table>
            <thead>
                <tr>
                    <th>Cumulative damage (3 turns)</th>
                    <th>Bonus points granted</th>
                    <th>Recommended team target</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>100,000 damage</td>
                    <td>+5,000 points</td>
                    <td>Discovery raid / standard gear</td>
                </tr>
                <tr>
                    <td>250,000 damage</td>
                    <td>+9,000 points</td>
                    <td>Good boost coordination</td>
                </tr>
                <tr>
                    <td>500,000 damage</td>
                    <td>+12,000 points</td>
                    <td>Optimised composition (Eliotrope Portals + Vulnerability)</td>
                </tr>
                <tr>
                    <td><strong>1,000,000 damage</strong></td>
                    <td><strong>+15,000 points (hard cap)</strong></td>
                    <td>Perfect burst (Iop, Pandawa, Rogue/Cra, Nébuleux T1/T3)</td>
                </tr>
            </tbody>
        </table>

        <h2>VI. Rewards & Weekly Track</h2>
        <p>
            Every week, your best recorded score unlocks the milestones on the guild reward track:
        </p>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/133-frise-recompenses.jpg" alt="Gigalodon raid reward track" class="guide-image" />
            <span class="guide-caption">Weekly reward track (milestones from 1,000 to 60,000 pts)</span>
        </div>

        <ul>
            <li><strong>Milestones 1 to 5 (1,000 to 13,000 pts):</strong> Guildokens, guild XP and <em>Chasm Chests</em>.</li>
            <li><strong>Milestones 6 to 10 (19,000 to 60,000 pts):</strong> <em>Majestic Chasm Chests</em>, rare crafting resources, pieces of the <strong>Chasm Set</strong> and a 1% drop chance for the <strong>Minilodon</strong> pet.</li>
            <li><strong>Guild Ranking (Tuesday 6 am):</strong> exclusive Gold/Silver/Bronze Ornaments for members of the cross-server Top 3.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/gigalodon/136-panoplie-du-gouffre.png" alt="Chasm Set" class="guide-image" />
            <span class="guide-caption">Exclusive Chasm Set equipment obtained from the chests</span>
        </div>

        <div class="callout callout-info">
            <strong>Keep training</strong>
            <p>Also read our <a href="/guides/raid-sanctuaire-jardins-eternels-dofus-guide">Eternal Gardens Sanctuary guide</a> and discover the event-management and calendar tools on SigilOS.</p>
        </div>
    `,
};
