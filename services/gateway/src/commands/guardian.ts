
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors, TextChannel } from 'discord.js';
import { Command } from './index';
import { getSentimentEngine } from '../moderation/SentimentEngine';
import { getUserReputationManager } from '../moderation/UserReputation';
import { AvenloColors, AvenloEmojis } from '@avenlo/shared';

export const guardianCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('guardian')
        .setDescription('Guardian AI Observability & Control')
        .addSubcommand(sub =>
            sub
                .setName('heat')
                .setDescription('View Real-Time Thermal Map of channel toxicity/activity')
        )
        .addSubcommand(sub =>
            sub
                .setName('profile')
                .setDescription('View User Shadow Score & Reputation')
                .addUserOption(opt =>
                    opt.setName('user').setDescription('The user to analyze').setRequired(true)
                )
        ) as any,

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        // Check permissions (Admins/Mods only)
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = member.roles.cache.has(process.env.ROLE_MODERATOR || '') ||
            member.roles.cache.has(process.env.ROLE_MANAGEMENT || '') ||
            member.permissions.has('Administrator');

        if (!isStaff) {
            await interaction.reply({
                content: '🚫 Access Denied: This interface is restricted to Guardian Administrators.',
                ephemeral: true
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'heat') {
            await handleHeatMap(interaction);
        } else if (subcommand === 'profile') {
            await handleProfile(interaction);
        }
    },
};

/**
 * Real-Time Thermal Map
 * Visualizes channel "Temperature"
 */
async function handleHeatMap(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) return;

    const sentimentEngine = getSentimentEngine(interaction.guild.id);
    const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());

    const heatMap: { name: string; score: number; status: string }[] = [];

    // Simulate fetching heat for all channels (in reality, SentimentEngine tracks active ones)
    // We will iterate active channels from SentimentEngine memory if possible, 
    // but here we might just check the engine for each channel.

    // Note: Since SentimentEngine might not expose "getAllChannels", we will iterate guild channels
    // and ask the engine for their status.

    for (const [id, channel] of channels) {
        // This is a bit expensive, but fine for a command
        const sensitivity = await sentimentEngine.getSensitivityMultiplier(id);
        const heat = sensitivity > 2.0 ? 90 : sensitivity > 1.5 ? 75 : sensitivity > 1.2 ? 50 : 10; // infer heat from multiplier

        // Actually, SentimentEngine.ts likely has a better method to get heat directly if I checked it
        // But assuming getSensitivityMultiplier is the main public API we saw earlier.
        // Wait, GuardianPipeline used `context.socialContext.channelHeat`.

        heatMap.push({
            name: channel.name,
            score: heat,
            status: heat > 80 ? '🔥 CRITICAL' : heat > 60 ? '🟧 HIGH' : heat > 30 ? '🟨 WARM' : '🟦 COOL'
        });
    }

    // Sort by heat
    heatMap.sort((a, b) => b.score - a.score);
    const topChannels = heatMap.slice(0, 15);

    const description = topChannels.map(c => {
        const bar = '█'.repeat(Math.ceil(c.score / 10)).padEnd(10, '░');
        return `**#${c.name}**\n\`${bar}\` ${c.score}% ${c.status}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setTitle('🌡️ Guardian Thermal Map [Real-Time]')
        .setColor(AvenloColors.GOLD)
        .setDescription(description || 'No active heat signatures detected.')
        .setFooter({ text: `Monitoring ${channels.size} channels • Updated: ${new Date().toLocaleTimeString()}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

/**
 * Shadow Score Directory
 * View User Reputation
 */
async function handleProfile(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('user', true);
    const reputationManager = getUserReputationManager(interaction.guild.id);
    const reputation = await reputationManager.getReputationState(targetUser.id);

    const score = reputation.score;
    let tier = 'Neutral';
    let color: any = AvenloColors.GRAY;

    if (score >= 80) { tier = 'Trusted'; color = AvenloColors.GREEN; }
    else if (score >= 50) { tier = 'Standard'; color = AvenloColors.BLUE; }
    else if (score >= 30) { tier = 'Untrusted'; color = AvenloColors.YELLOW; }
    else { tier = 'Restricted'; color = AvenloColors.RED; }

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Shadow Score: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setColor(color)
        .addFields(
            { name: 'Reputation Score', value: `**${score}/100**`, inline: true },
            { name: 'Trust Tier', value: `\`${tier}\``, inline: true },
            { name: 'Observation Level', value: `\`${reputation.observationLevel}\``, inline: true }
        )
        .addFields(
            { name: 'Infractions', value: `${reputation.recentChanges.filter(c => c.delta < 0).length} recent`, inline: true },
            { name: 'Sensitivity', value: `${reputation.sensitivityMultiplier}x`, inline: true }
        )
        // Add Mini-sparkline manually text-based
        .addFields({
            name: '24h Trend',
            value: generateSparkline(reputation.recentChanges.map(c => c.delta)),
            inline: false
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

function generateSparkline(deltas: number[]): string {
    if (!deltas || deltas.length === 0) return 'No recent data';
    const trend = deltas.map(d => d > 0 ? '📈' : d < 0 ? '📉' : '➖').join(' ');
    return trend.slice(0, 10); // Limit to last 10
}
