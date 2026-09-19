export const guide = {
    slug: "guide-brisage-rentabilite-runes",
    title: "Crushing & Rune Profitability Guide on Dofus (2026)",
    description:
        "How crushing coefficients are calculated, stat focusing and tips to make your item-crushing sessions profitable.",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    draft: false,
    body: `
        <div class="callout callout-tip">
            <strong>Economic Optimisation</strong>
            <p>Crushing is the number one rune-production engine on Dofus. A solid grasp of the coefficients lets you generate millions of kamas from a modest starting investment.</p>
        </div>

        <p>
            Crushing (breaking items down at the crusher in the Smithmagic workshops) is the only way to generate <strong>Smithmagic runes</strong> on Dofus. Understanding how the game calculates the number of runes produced lets you turn ordinary crafts into genuine kama jackpots.
        </p>

        <h2>1. How Does the Crushing Coefficient Work?</h2>
        <p>
            Every crushable item on the server has a <strong>secret coefficient</strong> (a percentage, usually between 20% and several hundred %).
        </p>
        <ul>
            <li><strong>The more rarely an item is crushed on the server:</strong> the higher its coefficient climbs (up to 500%, 1000%+ on forgotten items!).</li>
            <li><strong>The more heavily an item is crushed:</strong> the lower its coefficient drops, until it converges on a minimum threshold.</li>
        </ul>

        <div class="callout callout-info">
            <strong>The Test-Crush Rule</strong>
            <p>Before launching a craft of 50 or 100 copies of an item, <strong>always crush a single copy first</strong> to display its exact coefficient in the information channel!</p>
        </div>

        <h2>2. Item Level Matters</h2>
        <p>
            The level of the destroyed item acts as a <strong>geometric multiplier</strong> on the rune-generation formula:
        </p>
        <table>
            <thead>
                <tr>
                    <th>Level Bracket</th>
                    <th>Runes Produced</th>
                    <th>Rune Rarity</th>
                    <th>Recommendation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Level 1 to 60</strong></td>
                    <td>Very low</td>
                    <td>Basic runes only</td>
                    <td>Keep it for levelling professions or unlocking achievements.</td>
                </tr>
                <tr>
                    <td><strong>Level 61 to 150</strong></td>
                    <td>Medium to high</td>
                    <td>Basic runes and Pa runes</td>
                    <td>Excellent profitability when crafting resources are abundant.</td>
                </tr>
                <tr>
                    <td><strong>Level 151 to 200</strong></td>
                    <td>Very high</td>
                    <td>Pa runes and Ra runes guaranteed</td>
                    <td>The core of profitability: mass production of heavy runes (Vit, stats, Res).</td>
                </tr>
            </tbody>
        </table>

        <h2>3. The Focus Option: Maximising a Single Stat</h2>
        <p>
            In the crushing interface you can pick a <strong>stat focus</strong> (e.g. Vitality Focus, AP Reduction Focus, Water Resistance % Focus):
        </p>
        <p>
            <em>How the focus works:</em> the entire raw crushing value is converted <strong>into the targeted rune only</strong>, at the expense of the item's other runes. It is the perfect tool for mass-producing rare, expensive runes (such as Resistance % runes or heavy stat runes).
        </p>

        <div class="callout callout-warning">
            <strong>When NOT to use a focus?</strong>
            <p>If the crushed item carries several high-value stats (e.g. AP + Range + Summons + Resistance %), crushing without a focus is often more profitable because it produces all those valuable runes with no loss.</p>
        </div>

        <h2>4. Making Your Crushing Sessions Profitable</h2>
        <ol>
            <li><strong>Find low-cost recipes:</strong> compare resource prices on the marketplace with the level of the crafted item.</li>
            <li><strong>Crush test batches:</strong> crush one copy to reveal the server's current coefficient before mass-producing.</li>
            <li><strong>Use the focus wisely:</strong> only enable it when the price of the targeted rune more than covers the runes you give up.</li>
        </ol>
    `,
};
