import { GUILD_TIERS } from "./game-data/guild-tiers";

/**
 * Generates a text-based progress bar for Discord embeds.
 * Uses premium-looking characters: ▓ for filled, ░ for empty.
 */
export function generateTextProgressBar(current: number, max: number, size = 15): string {
    const progress = Math.min(Math.max(current / max, 0), 1);
    const filledLength = Math.round(progress * size);
    const emptyLength = size - filledLength;
    
    // High-end aesthetic block characters
    return "▰".repeat(filledLength) + "▱".repeat(emptyLength);
}

/**
 * Formats the milestones (jalons) list for Discord.
 */
export function formatDiscordMilestones(currentXP: number, targetTier: number): string {
    const tier = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS] || GUILD_TIERS[3];
    
    return tier.steps.map(step => {
        const isReached = currentXP >= step.xp;
        const emoji = isReached ? "🟢" : "⚪";
        const label = isReached ? `~~${step.label}~~` : `**${step.label}**`;
        return `${emoji} ${label} — \`${step.xp.toLocaleString()}\` XP`;
    }).join("\n");
}

/**
 * Formats XP and tier progress for Discord.
 */
export function formatDiscordTierProgress(currentXP: number, targetTier: number): string {
    const tier = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS] || GUILD_TIERS[3];
    const percentage = Math.floor(Math.min(100, (currentXP / tier.xpMax) * 100));
    const bar = generateTextProgressBar(currentXP, tier.xpMax);
    
    // Premium multi-line formatting
    return `**${bar}** \`${percentage}%\`\n` +
           `📈 **${currentXP.toLocaleString()}** / **${tier.xpMax.toLocaleString()}** XP`;
}
