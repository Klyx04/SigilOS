export const guide = {
    slug: "creer-gerer-guilde-dofus-2026",
    title: "Creating and Managing Your Dofus Guild in 2026: The Complete Guide",
    description:
        "Guild mechanics after Updates 3.4 and 3.6: creation, recruitment, ranks, hall, progression, activity tiers, Guildokens and guild raids.",
    publishedAt: "2026-08-02",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Dofus Unity 2026 — Update 3.6</strong>
            <p>This guide is based on the official mechanics after Updates 3.4 and 3.6: the end of automatic XP gifting, weekly missions, activity tiers, Guildokens and guild raids.</p>
        </div>

        <h2>I. Creating Your Guild</h2>

        <div class="flex flex-col sm:flex-row items-start gap-6 my-6 p-5 rounded-2xl bg-zinc-900/40 border border-white/10">
            <div class="flex flex-col gap-3 text-sm text-zinc-300 leading-relaxed">
                <p>Everything starts at the <strong>Guild Temple</strong> in <strong>[0, -8]</strong> (Crackler Mountain). The NPC <strong>Guilda</strong> sells the <strong>Guildalogem for 30,000 kamas</strong>. If you already own one, there is no need to buy another. Creation happens in the next room, through the magic book.</p>
                <ul class="text-xs text-zinc-400 space-y-1 mt-2">
                    <li>• Maximum capacity: <strong>350 members</strong></li>
                    <li>• Maximum level: <strong>20</strong></li>
                    <li>• XP cap per week: <strong>100 points</strong></li>
                </ul>
            </div>
        </div>

        <h2>II. Recruiting and Welcoming</h2>
        <p>From the Members tab, the leader manages the recruitment mode:</p>
        <ul>
            <li><strong>Closed</strong>: no applications, direct contact required.</li>
            <li><strong>Open automatic</strong>: join directly through “Apply”.</li>
            <li><strong>Open manual</strong>: the application is sent, then accepted or refused.</li>
        </ul>

        <h2>III. Ranks and Rights</h2>
        <p>Four default ranks: <strong>Guild Master</strong>, <strong>Officer</strong>, <strong>Initiate</strong> and <strong>On Trial</strong>. The “On Trial” rank cannot be granted any right. Rights are grouped into <strong>5 families</strong>:</p>

        <table>
            <thead>
                <tr>
                    <th>Family of rights</th>
                    <th>Available permissions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Members</strong></td>
                    <td>Recruitment, invitations, managing ranks and rights</td>
                </tr>
                <tr>
                    <td><strong>Activities</strong></td>
                    <td>Missions, purchases, guild hall, raids</td>
                </tr>
                <tr>
                    <td><strong>Log</strong></td>
                    <td>Guild message, internal information</td>
                </tr>
                <tr>
                    <td><strong>Paddock</strong></td>
                    <td>Use, layout, mount management</td>
                </tr>
                <tr>
                    <td><strong>Guild Chest</strong></td>
                    <td>Viewing, depositing, withdrawing</td>
                </tr>
            </tbody>
        </table>

        <h2>IV. The Guild Hall</h2>

        <div class="my-6 rounded-2xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_hall.jpg" alt="Dofus guild hall" class="w-full max-h-64 object-cover" />
        </div>

        <p>Each guild picks its hall among <strong>7 major cities</strong>. You can change it at any time, but with a <strong>1-hour cooldown</strong> between each switch. Halls are <strong>instanced</strong>: only the members of your guild can see each other inside.</p>

        <table>
            <thead>
                <tr>
                    <th>City</th>
                    <th>Coordinates</th>
                    <th>Merchant Room</th>
                    <th>Training Room</th>
                </tr>
            </thead>
            <tbody>
                <tr><td><strong>Amakna</strong></td><td>[-1, -1]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Astrub</strong></td><td>[1, -15]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Bonta</strong></td><td>[-35, -61]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Brakmar</strong></td><td>[-29, 37]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Frigost</strong></td><td>[-76, -34]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Pandala</strong></td><td>[19, -26]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
                <tr><td><strong>Sufokia</strong></td><td>[23, 23]</td><td>Lv. 2</td><td>Lv. 17</td></tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>4 rooms in the hall</strong>
            <p><strong>Main Room</strong> (Zaap) · <strong>Mission Room</strong> (NPC Homer Cenary, expeditions) · <strong>Merchant Room</strong> (from level 2, merchant NPCs + chest) · <strong>Training Room</strong> (from level 17, Poutch Ingball)</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            <div class="rounded-xl overflow-hidden border border-white/10">
                <img src="/images/guides/guilde/guild_hall_int.png" alt="Guild hall interior appearances" class="w-full h-40 object-cover" />
                <p class="text-xs text-zinc-400 p-3">5 interior appearances available per hall — the façade evolves automatically with the guild level.</p>
            </div>
            <div class="rounded-xl overflow-hidden border border-white/10">
                <img src="/images/guides/guilde/guild_niveaux.jpg" alt="Guild levels and bonuses" class="w-full h-40 object-cover" />
                <p class="text-xs text-zinc-400 p-3">Each guild level (max 20) unlocks bonuses for every member.</p>
            </div>
        </div>

        <h2>V. Progressing Your Guild — Tiers and Gauge</h2>
        <p>
            Guild experience comes from <strong>missions</strong>. You must pick an <strong>activity tier</strong>
            that determines the gauge to fill. The gauge resets <strong>every Tuesday at 7 am</strong>.
            The cap is <strong>100 XP per week</strong>.
        </p>

        <div class="my-4 rounded-xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_palier.png" alt="Choosing the activity tier" class="w-full object-cover max-h-48" />
        </div>

        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Tier 1</th>
                    <th>Tier 2</th>
                    <th>Tier 3</th>
                    <th>Tier 4</th>
                    <th>Tier 5</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Recommended active members</strong></td>
                    <td>10</td>
                    <td>30</td>
                    <td>50</td>
                    <td>100</td>
                    <td>150</td>
                </tr>
                <tr>
                    <td><strong>XP/week (Milestone 1)</strong></td>
                    <td>40</td>
                    <td>52</td>
                    <td>64</td>
                    <td>76</td>
                    <td>88</td>
                </tr>
                <tr>
                    <td><strong>Guild Gratitude (Milestone 1)</strong></td>
                    <td>10 to 13</td>
                    <td>13 to 16</td>
                    <td>16 to 19</td>
                    <td>19 to 22</td>
                    <td>22 to 25</td>
                </tr>
                <tr>
                    <td><strong>Activity points required</strong></td>
                    <td>25,000</td>
                    <td>75,000</td>
                    <td>150,000</td>
                    <td>300,000</td>
                    <td>500,000</td>
                </tr>
                <tr>
                    <td><strong>Mission change cost</strong></td>
                    <td>50 Guild Kamas</td>
                    <td>150 Guild Kamas</td>
                    <td>250 Guild Kamas</td>
                    <td>500 Guild Kamas</td>
                    <td>750 Guild Kamas</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-warning">
            <strong>The first milestone matters most</strong>
            <p>It accounts for ~80% of the rewards (XP + Guild Gratitude). Milestones 2, 3 and 4 each only add <strong>4 extra XP</strong>. Your minimum weekly goal: <strong>reach Milestone 1</strong>.</p>
        <h2>VI. Guild Missions</h2>

        <div class="my-4 rounded-xl overflow-hidden border border-white/10">
            <img src="/images/guides/guilde/guild_missions.png" alt="Mission selection interface" class="w-full object-cover max-h-56" />
        </div>

        <div class="callout callout-info">
            <strong>Participation requirement</strong>
            <p>You must have been in the guild for <strong>at least 24 hours</strong> to take part in missions.</p>
        </div>

        <p>12 standard missions per week, spread across several categories: <strong>Dungeon</strong>, <strong>Culling</strong>, <strong>Anomaly</strong>, <strong>Infinite Dreams</strong>, <strong>Guild Contracts</strong> and <strong>Special</strong>. You choose the tier and the categories your guild prefers.</p>
        <ul>
            <li>A character <strong>cannot complete the same mission twice</strong>.</li>
            <li>Flag a mission with the star icon to show your interest.</li>
            <li>A tier change only takes effect <strong>the following week</strong>.</li>
        </ul>

        <h2>VII. Guildokens and Guild Kamas</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            <div class="p-5 rounded-xl bg-zinc-900/70 border border-amber-500/20">
                <strong class="text-amber-300 text-sm block mb-2">🪙 Guildokens</strong>
                <p class="text-xs text-zinc-400">Earned by completing missions. Can be traded for cosmetic rewards (ornaments, titles, hall decoration…) with the Guildoken Lover in the hall.</p>
            </div>
            <div class="p-5 rounded-xl bg-zinc-900/70 border border-purple-500/20">
                <strong class="text-purple-300 text-sm block mb-2">💰 Guild Kamas</strong>
                <p class="text-xs text-zinc-400">Donations: <strong>10,000-kama</strong> increments, max 50,000/week/account (after 24h of membership). 10,000 kamas = 10 Guild Kamas. Used to reroll missions and buy bonuses and raids.</p>
            </div>
        </div>

        <h2>VIII. Guild Raids (Update 3.6)</h2>
        <p>Raids are bought in the guild shop with <strong>Guild Kamas</strong>. You do not need to belong to the organising guild to take part.</p>

        <table>
            <thead>
                <tr>
                    <th>Raid</th>
                    <th>Players</th>
                    <th>Duration</th>
                    <th>Cost</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Eternal Gardens Sanctuary</strong></td>
                    <td>8 to 16</td>
                    <td>~2 hours</td>
                    <td>480 Guild Kamas</td>
                </tr>
                <tr>
                    <td><strong>Gigalodon's Chasm</strong></td>
                    <td>8 to 12</td>
                    <td>~1 hour</td>
                    <td>360 Guild Kamas</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Raid rewards</strong>
            <p>They depend on the score you obtain: resources, XP and Guildokens. Maximum <strong>one raid per week</strong> (not both). Your guild's best score counts for the leaderboard — possible rewards: Guild Gratitude, guild XP and temporary ornaments.</p>
        </div>

        <h2>Organisation Tips</h2>

        <div class="callout callout-tip">
            <strong>Weekly rhythm</strong>
            <p>The week resets on <strong>Tuesday at 7 am</strong>. Share out the 12 missions from the very start of the cycle so you have time to finish the hard objectives.</p>
        </div>

        <div class="callout callout-info">
            <strong>Coordinate your members</strong>
            <p>A character cannot complete the same mission twice. SigilOS tracks this from the dashboard — assign every mission to a group to avoid duplicates and maximise the gauge.</p>
        </div>

        <div class="callout callout-warning">
            <strong>Pick the right tier</strong>
            <p>A tier that is too ambitious creates pointless pressure. Favour a tier where you always reach <strong>Milestone 1</strong> — that is where the rewards are concentrated.</p>
        </div>
    `,
};
