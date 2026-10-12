export const guide = {
    slug: "gerer-discord-guilde-dofus",
    title: "Running Your Dofus Guild's Discord: Architecture, Permissions, Security and Runs",
    description:
        "The definitive field guide to structuring a high-performing Dofus guild Discord: clean channels, fail-closed permissions, anti-phishing defense, managing 3.6 raids, and native SigilOS integration.",
    publishedAt: "2026-08-23",
    updatedAt: "2026-10-02",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>A Discord server must serve the game, not become a second job</strong>
            <p>The goal of a guild Discord is not to stack 40 ghost channels or 8 redundant bots. It must fulfill three essentials: finding information in 5 seconds, organizing a dungeon or raid without friction, and protecting members against account theft. The less noise there is, the more the guild actually plays together.</p>
        </div>

        <h2>I. Architecture: Clean Flows, Zero Dead Channels</h2>
        <p>The most common mistake guild leaders make is creating a channel for every fleeting idea (<code>#fm-weapons</code>, <code>#vulbis-drop</code>, <code>#music</code>). The result: deserted channels that dilute activity and disorient newcomers. Every category must serve a distinct game flow.</p>

        <div class="callout callout-info">
            <strong>The Golden Rule: Thematic Channel + Temporary Threads</strong>
            <p>Rather than creating one channel per dungeon or quest, keep a root channel (e.g., <code>#runs-and-achievements</code>) and open <strong>one thread per run</strong>. Once the dungeon is cleared or the evening ends, the thread is archived automatically: your history remains searchable without cluttering the sidebar.</p>
        </div>

        <h3>1. Recommended Channel Structure for Dofus 2026</h3>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Essential Channels</th>
                    <th>Role & Usage Guidelines</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>📌 01. WELCOME & INFO</strong></td>
                    <td><code>#rules</code><br/><code>#announcements</code><br/><code>#useful-links</code></td>
                    <td><strong>Strictly read-only.</strong> No casual chatter. <code>#announcements</code> is reserved for official guild leader and officer communications (raids, rallies, guild votes).</td>
                </tr>
                <tr>
                    <td><strong>💬 02. GUILD HQ</strong></td>
                    <td><code>#tavern</code><br/><code>#screens-and-drops</code><br/><code>#bot-commands</code></td>
                    <td>The social heartbeat. Accessible only after receiving the <em>Member</em> or <em>Recruit</em> role. Enable a 3-5 second slowmode on the tavern only during major server launches or spam surges.</td>
                </tr>
                <tr>
                    <td><strong>⚔️ 03. RUNS & GOALS</strong></td>
                    <td><code>#runs-and-achievements</code><br/><code>#infinite-dreams</code><br/><code>#guild-raids</code><br/><code>#weekly-missions</code></td>
                    <td>Strictly operational. One run = one thread. The <code>#weekly-missions</code> channel coordinates the 12 weekly guild missions every Tuesday starting at the 7:00 AM reset to secure XP milestones.</td>
                </tr>
                <tr>
                    <td><strong>🔨 04. ECONOMY & CRAFTING</strong></td>
                    <td><code>#crafters-and-crafts</code><br/><code>#archimonster-swap</code><br/><code>#loans-and-chest</code></td>
                    <td>Targeted mutual aid. The <code>#archimonster-swap</code> channel streamlines the Ochre Dofus quest without drowning the general chat in monster lists.</td>
                </tr>
                <tr>
                    <td><strong>🔊 05. VOICE CHANNELS</strong></td>
                    <td><code>🔊 Tavern (Open)</code><br/><code>⚔️ Dungeon 1 (4 slots)</code><br/><code>⚔️ Dungeon 2 (4 slots)</code><br/><code>🐙 Raid (12-16 slots)</code><br/><code>🤫 Focus / Stream</code></td>
                    <td><strong>Always enforce user limits.</strong> A 4-slot dungeon voice channel prevents outside noise during difficult boss fights. Casual chatting belongs in the Tavern.</td>
                </tr>
                <tr>
                    <td><strong>🛡️ 06. STAFF & MODERATION</strong></td>
                    <td><code>#officer-hq</code><br/><code>#applications</code><br/><code>#audit-log</code><br/><code>#phishing-alerts</code></td>
                    <td>Completely hidden from regular members. Discussions regarding recruitment, disciplinary warnings, and disputes must never spill into public view.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Ditching the Voice Channel Graveyard: Dynamic Voice</h3>
        <p>Nothing looks more lifeless than a server cluttered with 12 empty voice channels. Two battle-tested approaches exist:</p>
        <ul>
            <li><strong>Streamlined Static Setup</strong>: 1 open social voice (Tavern), 2 Dungeon channels capped at 4 players, 1 Raid channel, and 1 quiet channel for players streaming their Dofus window.</li>
            <li><strong>Dynamic Voice ("Join to Create")</strong>: A single trigger channel (Hub). When a player joins, the bot immediately spawns an ephemeral voice channel (e.g., <code>🎙️ [Name]'s Dungeon</code>) with the exact user cap. When the last player leaves, the channel deletes itself. Your server remains perpetually clean.</li>
        </ul>

        <h2>II. Security & Permissions: The Fail-Closed Fortress</h2>
        <p>A Dofus guild Discord is a prime target for credential harvesting and account theft. The industry-standard security model is <strong>fail-closed</strong>: by default, any user has zero privileges until explicitly authenticated and verified.</p>

        <h3>1. Locking Down <code>@everyone</code></h3>
        <p>The <code>@everyone</code> role applies automatically to anyone walking through your server doors. If left unconfigured, a compromised bot or rogue user can join at 4 AM and ping your entire guild with a fake Ankama phishing link.</p>

        <table>
            <thead>
                <tr>
                    <th>Discord Permission</th>
                    <th>Mandatory Setting</th>
                    <th>Technical Rationale</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Mention <code>@everyone</code>, <code>@here</code> and all roles</td>
                    <td>🔴 <strong>DISABLED</strong></td>
                    <td>Prevents devastating mass pings during raid attacks or account breaches.</td>
                </tr>
                <tr>
                    <td>Create Invites</td>
                    <td>🔴 <strong>DISABLED</strong></td>
                    <td>Guild staff maintains full control over arrivals and can revoke compromised invites instantly.</td>
                </tr>
                <tr>
                    <td>Send Messages & Attach Files</td>
                    <td>🔴 <strong>DISABLED</strong></td>
                    <td>Grant write access strictly in <code>#introductions</code>. File attachments and images must remain blocked for unverified accounts.</td>
                </tr>
                <tr>
                    <td>Embed Links</td>
                    <td>🔴 <strong>DISABLED</strong></td>
                    <td>Stops phishing link deployment at the server threshold.</td>
                </tr>
                <tr>
                    <td>Manage Roles, Channels, Webhooks, or Messages</td>
                    <td>🔴 <strong>DISABLED</strong></td>
                    <td>No administrative permission should ever be inherited by default.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Discord Role Hierarchy</h3>
        <p>On Discord, vertical role position dictates authority. A role can never moderate, assign, or strip a role positioned above it. Order your roles strictly from top to bottom:</p>

        <ol>
            <li><strong>👑 Guild Master</strong>: Discord Server Owner. Two-Factor Authentication (2FA) is <strong>strictly mandatory</strong>. Never grant this role to anyone else.</li>
            <li><strong>🤖 SigilOS Bot</strong>: Positioned directly beneath the Guild Master to synchronize and grant guild roles without ever needing the dangerous <code>Administrator</code> permission.</li>
            <li><strong>⚔️ Right Hands / Officers</strong>: Run coordination, channel moderation, application reviews. No permissions to modify server infrastructure or security integrations.</li>
            <li><strong>🛡️ Moderators / Organizers</strong>: Message management, timeouts, voice moderation, and event creation.</li>
            <li><strong>⚜️ Guild Member</strong>: Full access to internal channels, voice rooms, screenshot sharing, and reaction roles.</li>
            <li><strong>🌱 Trial Recruit</strong>: Limited access during trial periods (typically 1 to 2 weeks). External links restricted to prevent rogue posts.</li>
            <li><strong>🤝 Guest / Alliance</strong>: Restricted strictly to alliance channels or guest voice rooms. Zero access to the tavern, guild chest, or internal runs.</li>
        </ol>

        <div class="callout callout-warning">
            <strong>Dofus Anti-Phishing Shield: The 3 Scams That Wipe Out Guilds</strong>
            <p>Dofus players face continuous, targeted phishing campaigns on Discord:</p>
            <ul>
                <li><strong>The Compromised Friend Account</strong>: A guild member's Discord account gets stolen. The hacker posts in your chat: <em>"Hey guys, vote for our guild on the Dofus forum to win a free subscription pack: fake-dofus-link.com"</em>. Half the guild clicks, trusting their fellow member.</li>
                <li><strong>The Fake QR Code "Verification" Bot</strong>: A fraudulent bot claims to verify Ankama accounts or age by prompting users to scan a QR code with the Discord mobile app. <strong>Never scan Discord QR codes</strong>: doing so hands over direct session authorization to the attacker.</li>
                <li><strong>Staff Rule of Law</strong>: Legitimate Ankama or SigilOS staff will <strong>NEVER</strong> direct-message you asking for passwords or auth tokens. Disable direct messages from server members in your privacy settings if unsolicited pitches occur.</li>
            </ul>
        </div>

        <h2>III. Onboarding: From Welcome to First Fight</h2>
        <p>New recruits who join a server and wait 24 hours without knowing where to look will simply close Discord and join another guild. Your onboarding must be frictionless and guided.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-onboarding-natif.png" alt="Configuring Discord's native Community Onboarding" class="guide-image" />
            <span class="guide-caption">Enable Discord Community Onboarding: initial welcome questionnaire, notification role selection, and default channels unlocked instantly.</span>
        </div>

        <h3>4 Steps to a Smooth Integration</h3>
        <ol>
            <li><strong>The Welcome Gate</strong>: Newcomers only see <code>#rules</code> and <code>#introductions</code>.</li>
            <li><strong>Standardized Intro Template</strong>: Pin a concise template in <code>#introductions</code>:<br/>
                <code>In-game Name / Class / Level / Server — Main Professions — Active Timeslots — Goals (PvM, Quests, Dreams, Breeding).</code>
            </li>
            <li><strong>Opt-in Notification Roles</strong>: Let members choose their ping preferences via reaction roles: <code>@PvM Runs</code>, <code>@Raids</code>, <code>@Dreams</code>, <code>@Crafters</code>. <strong>Ban <code>@everyone</code> mentions</strong> for routine runs to prevent notification fatigue.</li>
            <li><strong>Profile Link & Role Grant</strong>: An officer validates the intro and assigns the <em>Recruit</em> or <em>Member</em> role.</li>
        </ol>

        <h2>IV. Coordinating Runs: Dungeons, Dreams and 3.6 Raids</h2>
        <p>Nothing dissolves guild enthusiasm faster than messy, unstructured call-outs where 3 people react "down", but nobody knows what classes are available or who brought the dungeon keys.</p>

        <h3>1. The Official Announcement Template</h3>
        <pre><code>⚔️ [RUN] — Dungeon Name or Objective (e.g., Tal Kasha / Zombie Achievement)

📅 Date & Time: Thursday 9:00 PM CET (grouping up at 8:45 PM)
🎯 Objective: Quest completion + Zombie Achievement
👥 Desired Composition:
   1. [Name] - Panda Tank (Leader)
   2. [Name] - Eniripsa / Healer
   3. [Open] - Positioner or AP/MP control (Elio, Sram...)
   4. [Open] - Heavy Damage Dealer (Iop, Cra, Ouginak...)
⏱️ Estimated Duration: 1h15
🎒 Requirements: Dungeon key in inventory, access quest completed
📍 Meeting Place: Dungeon 1 Voice Channel

Registration: React below with your class and intended combat role.</code></pre>

        <h3>2. Managing 3.6 Guild Raids (Gigalodon, Eternal Gardens)</h3>
        <p>With the 8-to-16-player guild raids introduced in Update 3.6, coordinating larger teams on Discord demands military discipline:</p>
        <ul>
            <li><strong>Announce 48h in advance</strong>: Always register <strong>2 reserve players</strong> on a waitlist. A last-minute cancellation at 8:55 PM should not jeopardize an entire 12-person raid.</li>
            <li><strong>10-Minute Pre-Raid Briefing</strong>: Clarify designated tactical roles (who handles summons, who debuffs, who carries keys).</li>
            <li><strong>Systematic Closure</strong>: Once the raid concludes, record the guild score and archive the thread. Outdated sign-ups from previous weeks must never linger.</li>
        </ul>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/sigilos-donjons-quetes.png" alt="SigilOS Dungeons and Quests module with live Discord sync" class="guide-image" />
            <span class="guide-caption">SigilOS Dungeons & Quests module: event cards, class compositions, and live registration synchronized directly with Discord.</span>
        </div>

        <h2>V. What Discord Cannot Do Alone (And How SigilOS Solves It)</h2>
        <p>Discord is unrivaled for instant messaging. But when it comes to tracking raid rosters, knowing which level 200 Magus is online, or trading archimonsters without losing track, <strong>Discord hits a wall</strong>. Pinned lists get outdated, messages vanish in the feed, and officers burn out.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-embed-sigilos-donjon.png" alt="Official SigilOS Discord bot embed with interactive buttons" class="guide-image" />
            <span class="guide-caption">What your guild sees in Discord: automated SigilOS embeds with official artwork, objectives, slot requirements, and interactive action buttons.</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Guild Workflow</th>
                    <th>The Struggle on Discord Alone</th>
                    <th>With the SigilOS Ecosystem</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Run Sign-ups</strong></td>
                    <td>Confusing emoji reactions, class duplicates, zero automated reminders.</td>
                    <td><strong>Interactive embed</strong>: role/class sign-ups, balanced roster visibility, and live calendar synchronization.</td>
                </tr>
                <tr>
                    <td><strong>Ochre Dofus & Archis</strong></td>
                    <td>Dozens of <em>"who has the Blue Piwi archi?"</em> messages flooding general chat.</td>
                    <td><strong>Archimonster Marketplace</strong>: members log possessed, missing, and duplicate souls. The matrix automatically matches mutual trades.</td>
                </tr>
                <tr>
                    <td><strong>Crafter Directory</strong></td>
                    <td>Endless pings in <code>#tavern</code> hunting for an online level 200 Tailor or Smithmagus.</td>
                    <td><strong>Live Directory</strong>: searchable index of all members' professions and levels, accessible in 1 click.</td>
                </tr>
                <tr>
                    <td><strong>Weekly Missions (Tue 7 AM)</strong></td>
                    <td>Manual spreadsheets or Discord notes that nobody bothers to update.</td>
                    <td><strong>12-Mission Tracking</strong>: weekly progression, activity tier calculation, and Guildaton optimization.</td>
                </tr>
                <tr>
                    <td><strong>Activity & Guild Ranks</strong></td>
                    <td>Impossible to separate dedicated contributors from inactive lurkers without manual audits.</td>
                    <td><strong>Discord Activity Ladder</strong>: automated tracking of voice time, streams, and chat participation to recognize guild stalwarts.</td>
                </tr>
                <tr>
                    <td><strong>Security & Succession</strong></td>
                    <td>If the guild master's Discord account gets banned or deleted, guild administration freezes.</td>
                    <td><strong>Fail-safe Auto-Succession</strong>: SigilOS protects guild ownership and seamlessly transitions control to the verified successor.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>SigilOS Technical Guardrails</strong>
            <p>The SigilOS bot strictly enforces the principle of <em>least privilege</em>. It requires no Administrator permission, never logs typing events (<code>GuildMessageTyping</code> disabled), uses end-to-end encrypted API channels, and cleanly archives departed profiles for 12 months.</p>
        </div>

        <h2>VI. Moderation & Crisis Protocol</h2>
        <p>A poorly managed dispute on a public channel can fracture a guild in under 48 hours. Enforce transparent, documented protocols across your officer team.</p>

        <table>
            <thead>
                <tr>
                    <th>Crisis Scenario</th>
                    <th>Immediate Officer Action</th>
                    <th>Root Cause Resolution</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Loot / Paddock / Chest Dispute</strong></td>
                    <td>Isolate the players involved. Halt public bickering in <code>#tavern</code> immediately.</td>
                    <td>Open a <strong>private staff ticket</strong> with the involved parties. Apply written guild rules impartially without favoritism.</td>
                </tr>
                <tr>
                    <td><strong>Compromised Officer Account</strong></td>
                    <td>Immediately revoke all administrative Discord roles from the affected account.</td>
                    <td>Audit recent logs (assigned roles, channel changes, created webhooks). Post a clear advisory in <code>#announcements</code> warning members.</td>
                </tr>
                <tr>
                    <td><strong>Spam Raid or Rogue Bot</strong></td>
                    <td>Activate Discord Security Mode (temporarily locking new message submissions).</td>
                    <td>Ban offending bots, revoke the active invite link, and purge malicious messages using bot commands.</td>
                </tr>
            </tbody>
        </table>

        <h2>VII. Deployment & Quarterly Audit Checklist</h2>
        <p>Whether launching a brand new server or auditing an established guild hub, verify these checkboxes before opening the doors:</p>

        <ol>
            <li>[ ] <strong>@everyone strictly locked down</strong>: mentions disabled, invite creation revoked, link embedding blocked.</li>
            <li>[ ] <strong>Mandatory 2FA</strong> enforced for the Guild Master and all Officers.</li>
            <li>[ ] <strong>Lean category structure</strong>: under 20 channels total, with zero ghost channels inactive for 30+ days.</li>
            <li>[ ] <strong>Calibrated voice limits</strong>: Tavern open, dungeons capped at 4 slots, raids calibrated to 12-16 slots.</li>
            <li>[ ] <strong>Community Onboarding active</strong> with explicit rules and opt-in notification roles.</li>
            <li>[ ] <strong>Staff channels & private tickets configured</strong> for confidential applications and conflict resolution.</li>
            <li>[ ] <strong>SigilOS Bot connected</strong>: role sync operational, run module deployed, and crafter directory populated.</li>
            <li>[ ] <strong>Real-world permission check</strong>: verify visibility using Discord's <em>"View Server as Role"</em> feature (Recruit, Member, Guest).</li>
        </ol>

        <div class="callout callout-tip">
            <strong>Conclusion: Simplicity Breeds Longevity</strong>
            <p>A Dofus guild thrives on its victories, shared memories, and lively voice calls—not on an impenetrable maze of text channels. By pairing a clean, secure Discord setup with the automated organizational power of SigilOS, you give your members the ultimate playground to conquer the World of Twelve together.</p>
        </div>
    `,
} as const;
