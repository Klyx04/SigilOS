export const guide = {
    slug: "gerer-discord-guilde-dofus",
    title: "Running Your Dofus Guild's Discord: Structure, Permissions and Runs",
    description:
        "The practical guide to building a readable and secure Discord for a Dofus guild: useful channels, roles, permissions, onboarding and organising runs.",
    publishedAt: "2026-08-23",
    updatedAt: "2026-08-23",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>A useful Discord, not a second game to administrate</strong>
            <p>A guild server must make information easy to find, a run easy to join and a decision easy to follow up. The goal is not to stack up channels or bots: it is to cut down on lost messages and on the workload of your officers.</p>
        </div>

        <h2>I. Start With the Flows, Not With the Channels</h2>
        <p>Before creating a category, ask yourself which flow it serves. A guild usually has five stable flows: welcoming, chatting, organising runs, lending a hand and moderating. If a channel has no precise flow, it will probably become a dead channel.</p>

        <div class="callout callout-info">
            <strong>Structural principle</strong>
            <p>One main channel per topic, then one thread per run, help request or order. Threads keep the history of the action without turning <code>#dungeons-and-achievements</code> into a wall of messages.</p>
        </div>

        <h3>1. Recommended Minimum Layout</h3>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Channels</th>
                    <th>Usage rule</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>📌 01. WELCOME</strong></td>
                    <td><code>#rules</code><br/><code>#announcements</code><br/><code>#introductions</code></td>
                    <td>The rules and announcements are read-only. <code>#introductions</code> is the only channel where someone without a guild role can post.</td>
                </tr>
                <tr>
                    <td><strong>💬 02. GUILD LIFE</strong></td>
                    <td><code>#tavern</code><br/><code>#screens-and-drops</code><br/><code>#bot-commands</code></td>
                    <td>Restricted to verified members. Only enable slow mode if the volume justifies it; do not punish an active community by default.</td>
                </tr>
                <tr>
                    <td><strong>⚔️ 03. RUNS</strong></td>
                    <td><code>#dungeons-and-achievements</code><br/><code>#raids</code><br/><code>#infinite-dreams</code><br/><code>#dofus-help</code></td>
                    <td>One run = one thread. The opening message carries the date, the goal, the slots and the requirements; the thread carries the discussion.</td>
                </tr>
                <tr>
                    <td><strong>🔨 04. CRAFTING</strong></td>
                    <td><code>#crafters-and-crafting</code><br/><code>#loans-and-chest</code><br/><code>#internal-trade</code></td>
                    <td>Give every request a pinned format: item, resources, budget, availability and deadline.</td>
                </tr>
                <tr>
                    <td><strong>🔊 05. VOICE</strong></td>
                    <td><code>🔊 Tavern</code><br/><code>⚔️ Dungeon 1 (×4)</code><br/><code>⚔️ Dungeon 2 (×4)</code><br/><code>🐙 Raid (×12)</code><br/><code>🤫 Silent / stream</code></td>
                    <td>Dungeon voice channels have a limit matching the party size. Create the raid voice channel for its real format, not to host the whole server.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Private Categories You Should Not Forget</h3>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Access</th>
                    <th>Content</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>🛡️ STAFF</strong></td>
                    <td>Guild leader, officers and moderators</td>
                    <td><code>#staff</code>, <code>#applications</code>, <code>#moderation-log</code>. Sanctions and applications are never handled in public channels.</td>
                </tr>
                <tr>
                    <td><strong>🤝 ALLIANCE / GUESTS</strong></td>
                    <td>Ally or Guest role only</td>
                    <td>A coordination space that grants no access to conversations, loans or the guild's internal decisions.</td>
                </tr>
                <tr>
                    <td><strong>📚 ARCHIVES</strong></td>
                    <td>Members or staff, depending on the content</td>
                    <td>Old reports, past rules and closed events. Archive: do not delete information that is still useful.</td>
                </tr>
            </tbody>
        </table>

        <h2>II. Permissions: a Closed Baseline, Explicit Access</h2>
        <p>The <code>@everyone</code> role applies to anyone who joins the server. Treat it as the role of an unverified visitor: it must not be able to disrupt the server, invite strangers or reach internal spaces.</p>

        <h3>1. Configuring <code>@everyone</code></h3>
        <table>
            <thead>
                <tr>
                    <th>Permission</th>
                    <th>Setting</th>
                    <th>Why</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Mention <code>@everyone</code>, <code>@here</code> and roles</td>
                    <td>🔴 Disabled</td>
                    <td>Mass pings remain a staff responsibility, or belong to precise notification roles.</td>
                </tr>
                <tr>
                    <td>Create invites</td>
                    <td>🔴 Disabled</td>
                    <td>You keep control over arrivals and can revoke a compromised invite.</td>
                </tr>
                <tr>
                    <td>Send messages and attach files</td>
                    <td>🔴 Disabled by default</td>
                    <td>Only open <code>#introductions</code> if needed. Links and files are not essential before verification.</td>
                </tr>
                <tr>
                    <td>Manage channels, messages, roles or webhooks</td>
                    <td>🔴 Disabled</td>
                    <td>These permissions must never be inherited by accident.</td>
                </tr>
                <tr>
                    <td>View channels and add reactions</td>
                    <td>🟢 Welcome category only</td>
                    <td>The person can read the rules and perform the planned validation action.</td>
                </tr>
            </tbody>
        </table>

        <h3>2. Role Hierarchy</h3>
        <p>The position of roles matters as much as their permissions. A role can only act on roles placed below it. The bot must therefore sit above the roles it is meant to assign, without gaining the Administrator permission for all that.</p>

        <ol>
            <li><strong>👑 Guild leader</strong>: server owner. Enable two-factor authentication and limit access to this role.</li>
            <li><strong>🤖 SigilOS Bot</strong>: only assigns the roles it must manage and only posts in the planned channels.</li>
            <li><strong>⚔️ Right-hand staff</strong>: guild, event and message management. No <code>Administrator</code> for convenience.</li>
            <li><strong>🛡️ Moderators / organisers</strong>: messages, threads, voice channels, events and timeout durations; no global management rights.</li>
            <li><strong>⚜️ Member</strong>: access to internal spaces, voice channels and run channels.</li>
            <li><strong>🌱 Recruit</strong>: limited access during onboarding, in particular no free posting of external links.</li>
            <li><strong>🤝 Ally / guest</strong>: access explicitly limited to the cross-guild category.</li>
        </ol>

        <div class="callout callout-warning">
            <strong>The test that prevents nasty surprises</strong>
            <p>After every important change, use the “View Server As Role” feature in Discord's settings. Check at least what a Recruit, a Member, a Guest and a Moderator can see. A server is secured by its real access rights, not by the list of roles you think you configured.</p>
        <h2>III. Onboarding: Turning a Newcomer Into a Member</h2>
        <p>A newcomer should never have to ask “where do I go?”. Their journey must fit into four steps that are visible from the moment they arrive.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-onboarding-natif.png" alt="Discord welcome process — configuring the starting channels and roles" class="guide-image" />
            <span class="guide-caption">Discord natively provides a welcome process: turn it on to guide every new member from the moment they join your guild server.</span>
        </div>

        <ol>
            <li><strong>Read</strong>: rules, how the guild works and the privacy rule in <code>#rules</code>.</li>
            <li><strong>Introduce yourself</strong>: main character, server, goals and availability in <code>#introductions</code>.</li>
            <li><strong>Get verified</strong>: an officer approves the arrival, or the member gets the Recruit role once the step you defined is done.</li>
            <li><strong>Pick your notifications</strong>: useful notification roles, for example <code>Raids</code>, <code>Dreams</code> or <code>Crafting</code>. Never make a notification role mandatory.</li>
        </ol>

        <div class="callout callout-tip">
            <strong>Do this once</strong>
            <p>Pin an introduction message with a short template: <code>Class / level — goals — playtimes — professions — what I am looking for</code>. You get usable information without turning arrivals into an endless form.</p>
        </div>

        <h2>IV. Runs: an Announcement That Speaks for Itself</h2>
        <p>A run announcement must be understandable without rereading 40 messages. The reader must immediately know whether they can come, when, and what they need to prepare.</p>

        <h3>1. Announcement Template to Reuse</h3>
        <pre><code>⚔️ [DUNGEON / RAID] — Objective name

📅 Date and time: Friday 9:00 pm
🎯 Goal: clear, achievement or farm
👥 Slots: 4 / 8 — roles or classes wanted
⏱️ Estimated duration: 1h30
📍 Meeting point: Raid voice, 10 minutes before
🎒 Requirements: keys, consumables, relevant achievements

Sign-up: react or use the provided button.
Discussion and team composition happen in the thread of this message.</code></pre>

        <h3>2. Dungeons, Achievements and Dreams</h3>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/sigilos-donjons-quetes.png" alt="SigilOS dashboard — Dungeons & Quests with real-time sign-up" class="guide-image" />
            <span class="guide-caption">SigilOS's Dungeons & Quests module: one run per card, with date, composition and a sign-up button wired straight into Discord.</span>
        </div>

        <ul>
            <li><strong>Dungeons and achievements</strong>: create one thread per objective; name it with the dungeon, the achievement and the date so it stays findable.</li>
            <li><strong>Infinite Dreams</strong>: the first message of the thread states the floor, the modifiers, the team and the next resume slot. That is the only information that must survive a break.</li>
            <li><strong>Guild raids (Gigalodon's Chasm, Eternal Gardens Sanctuary)</strong>: announce them 48 hours ahead, plan substitutes on a waiting list and hold a voice briefing 10 minutes before the start.</li>
            <li><strong>After the run</strong>: close the thread with a simple outcome: completed, postponed or to be resumed. That prevents ghost sign-ups.</li>
        </ul>

        <h3>3. Voice Channels: Simple Rules</h3>
        <p>The Tavern voice channel is social. Dungeon voice channels are operational: favour useful information during combat and move side conversations to another channel. The organiser must be able to call out a reminder without fighting the noise.</p>

        <h2>V. Connecting Discord to SigilOS</h2>
        <p>Discord is excellent for chatting; it was not designed to maintain a reliable list of characters, availability, professions or goals all by itself. Connecting it to SigilOS should therefore be seen as cutting down on double data entry, not as adding another layer of bots.</p>

        <div class="guide-image-container">
            <img src="/images/guides/guilde/discord-embed-sigilos-donjon.png" alt="Discord embed from the SigilOS bot — dungeon search announcement with sign-up buttons" class="guide-image" />
            <span class="guide-caption">What your guild sees in Discord: the SigilOS embed automatically posts the dungeon, the date, the targeted achievements, the open slots and the action buttons.</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Need</th>
                    <th>Discord alone</th>
                    <th>With SigilOS</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Runs</strong></td>
                    <td>Manual lists in a message and individual reminders.</td>
                    <td>An event posts a structured announcement, centralises sign-ups and keeps a readable composition.</td>
                </tr>
                <tr>
                    <td><strong>Dofus quests</strong></td>
                    <td>Everyone tracks their own steps separately, with no group view.</td>
                    <td>Interactive matrix (Ochre, Primordial Dofus, Grofus, Dolmanax): instantly group the members stuck at the same place.</td>
                </tr>
                <tr>
                    <td><strong>Crafting</strong></td>
                    <td>Crafters' availability gets lost in the flow.</td>
                    <td>A guild directory filterable by profession and level gives a clear entry point.</td>
                </tr>
                <tr>
                    <td><strong>Loans</strong></td>
                    <td>A message is quickly forgotten and is not a record.</td>
                    <td>Each loan is tracked from dedicated data, with a status and a history.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-info">
            <strong>Integration safeguards</strong>
            <p>The bot only receives the permissions strictly required for its actions. Give it a dedicated command channel and identified announcement channels. Never sync a role that grants more access than the information it is tied to justifies. Test the complete scenario with a test account: linking, role granted, sign-up, opt-out and access removal.</p>
        </div>

        <h2>VI. Moderation: Plan for Incidents Before They Happen</h2>
        <p>The best moderation is predictable. Members must know the rules, officers must know who decides, and incidents must leave a trace the staff can access.</p>

        <table>
            <thead>
                <tr>
                    <th>Situation</th>
                    <th>Immediate response</th>
                    <th>Follow-up</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Spam or raid</strong></td>
                    <td>Temporarily close the public channels, disable invites and apply the appropriate moderation measures.</td>
                    <td>Check the audit log, clean up accesses, then briefly announce that everything is back to normal.</td>
                </tr>
                <tr>
                    <td><strong>Compromised staff account</strong></td>
                    <td>Remove the sensitive roles; review recent changes to roles, channels and webhooks.</td>
                    <td>Change the affected credentials, restore the configuration and document the incident in the staff channel.</td>
                </tr>
                <tr>
                    <td><strong>Public or voice conflict</strong></td>
                    <td>Stop the escalation, separate the participants if needed and move the discussion out of the public channel.</td>
                    <td>Apply the rule everyone knows, not a sanction improvised under pressure.</td>
                </tr>
            </tbody>
        </table>

        <h2>VII. Go-Live Checklist</h2>
        <ol>
            <li><strong>Delete</strong> useless, duplicated or unowned channels.</li>
            <li><strong>Lock down</strong> <code>@everyone</code>, then open rights through roles and categories.</li>
            <li><strong>Create</strong> a complete arrival path: rules, introduction, verification, role.</li>
            <li><strong>Configure</strong> notification roles without confusing them with access roles.</li>
            <li><strong>Test</strong> the server with the Recruit, Member, Guest and Moderator views.</li>
            <li><strong>Document</strong> the run format and the incident procedure in the staff channel.</li>
            <li><strong>Audit</strong> the structure every three months: permissions, bots, invites, inactive channels and orphaned roles.</li>
        </ol>

        <div class="callout callout-info">
            <strong>The structure must serve the game</strong>
            <p>If a rule, a channel or an automation does not save time for members and officers, remove it. A good Discord stays discreet: it simply lets the guild play more often and organise itself better.</p>
        </div>
    `,
};
