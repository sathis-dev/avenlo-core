import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors, TextChannel } from 'discord.js';
import { Command } from './index';
import { getSentimentEngine } from '../moderation/SentimentEngine';
import { getUserReputationManager } from '../moderation/UserReputation';
import { AvenloColors, AvenloEmojis, getRedisClient } from '@avenlo/shared';

// ====================================
// TACTICAL SUITE (MODERATOR TIER)
// Focus: Active threat suppression & behavioral forensics
// ====================================

export const tacticalCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('tactical')
        .setDescription('Tactical Moderation Suite')
        .addSubcommand(sub =>
            sub.setName('thermal')
                .setDescription('Initialize 3D Heat Prism Visualization')
        )
        .addSubcommand(sub =>
            sub.setName('shadow')
                .setDescription('Pull 24h Reputation Sparkline & Shadow Score')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('forensic')
                .setDescription('Open CSI Logic Sheet for a specific Event ID')
                .addStringOption(opt => opt.setName('id').setDescription('Incident ID or Message ID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('intercept')
                .setDescription('Isolate user messages for deep AI auditing (60s)')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        ) as any,

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'thermal') {
            await interaction.deferReply({ ephemeral: true });
            const sentimentEngine = getSentimentEngine(interaction.guild.id);
            const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
            const heatMap: { name: string; score: number; status: string }[] = [];

            for (const [id, channel] of channels) {
                const sensitivity = await sentimentEngine.getSensitivityMultiplier(id);
                const heat = sensitivity > 2.0 ? 90 : sensitivity > 1.5 ? 75 : sensitivity > 1.2 ? 50 : 10;
                heatMap.push({
                    name: channel.name,
                    score: heat,
                    status: heat > 80 ? '🔥 CRITICAL' : heat > 60 ? '🟧 HIGH' : heat > 30 ? '🟨 WARM' : '🟦 COOL'
                });
            }

            heatMap.sort((a, b) => b.score - a.score);
            const topChannels = heatMap.slice(0, 10);

            const description = topChannels.map(c => {
                const bar = '█'.repeat(Math.ceil(c.score / 10)).padEnd(10, '░');
                return `**#${c.name}**\n\`${bar}\` ${c.score}% ${c.status}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle('🔥 3D Heat Prism [Tactical View]')
                .setColor(AvenloColors.GREEN)
                .setDescription(description || 'No active heat signatures.')
                .addFields({
                    name: 'Dashboard Telemetry',
                    value: `[View Live 3D Lattice](${process.env.DASHBOARD_URL || 'http://localhost:5173'}/command-center)`,
                    inline: false
                })
                .setFooter({ text: 'Tactical Layer • Real-Time Kinetic Flux' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subcommand === 'shadow') {
            await interaction.deferReply({ ephemeral: false });

            const targetUser = interaction.options.getUser('user', true);
            const reputationManager = getUserReputationManager(interaction.guild.id);
            const state = await reputationManager.getReputationState(targetUser.id);

            let tier = 'Neutral';
            let color: any = AvenloColors.GRAY;
            if (state.score >= 80) { tier = 'Trusted'; color = AvenloColors.GREEN; }
            else if (state.score >= 50) { tier = 'Standard'; color = AvenloColors.BLUE; }
            else if (state.score >= 30) { tier = 'Untrusted'; color = AvenloColors.YELLOW; }
            else { tier = 'Restricted'; color = AvenloColors.RED; }

            const sparkline = generateSparkline(state.recentChanges.map(c => c.delta));

            const embed = new EmbedBuilder()
                .setTitle(`👤 Shadow Identity: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor(color)
                .addFields(
                    { name: 'Shadow Score', value: `\`${state.score}/100\``, inline: true },
                    { name: 'Trust Tier', value: `\`${tier}\``, inline: true },
                    { name: 'Flux', value: `\`${state.sensitivityMultiplier}x\``, inline: true },
                    { name: 'Kinetic Trajectory (24h)', value: sparkline, inline: false },
                    { name: 'Recent Infractions', value: `${state.recentChanges.filter(c => c.delta < 0).length} incidents`, inline: true }
                )
                .setFooter({ text: 'Tactical Forensics • Identity Vector' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subcommand === 'forensic') {
            const id = interaction.options.getString('id', true);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`🔬 CSI Logic Sheet: #${id}`)
                        .setColor(AvenloColors.GREEN)
                        .setDescription(`**Status:** Analyzing forensic vector...\n\nRetrieving AI reasoning and intent gradients for event \`${id}\`.`)
                        .addFields(
                            { name: 'Action', value: 'Open Dashboard for full forensic breakdown', inline: false },
                            { name: 'Link', value: `[Open Forensic Lab](${process.env.DASHBOARD_URL || 'http://localhost:5173'}/forensics/${id})`, inline: false }
                        )
                ],
                ephemeral: true
            });
        }
        else if (subcommand === 'intercept') {
            const target = interaction.options.getUser('user', true);
            const redis = getRedisClient().getClient();

            await redis.set(`intercept:${target.id}`, 'active', 'EX', 60);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎯 Target Intercepted')
                        .setColor(AvenloColors.GREEN)
                        .setDescription(`**User:** ${target}\n**Duration:** 60 seconds\n**Status:** Deep Auditing Active\n\nAll messages from this user are now being routed to the Priority Analyst Stream.`)
                        .setFooter({ text: 'Tactical Isolation Protocol' })
                ],
                ephemeral: false
            });
        }
    }
};

function generateSparkline(deltas: number[]): string {
    if (!deltas || deltas.length === 0) return '`🔵 ─── (Stable)`';
    const chart = deltas.map(d => d > 0 ? '↗️' : d < 0 ? 'xx' : '→').join('');
    return `\`${chart.slice(0, 10)}\``;
}
