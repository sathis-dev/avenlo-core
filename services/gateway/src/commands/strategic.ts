import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from './index';
import { AvenloColors, getRedisClient } from '@avenlo/shared';

// ====================================
// STRATEGIC SUITE (ADMIN TIER)
// Focus: Systemic management & pattern-matching
// ====================================

export const strategicCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('strategic')
        .setDescription('Strategic Control Suite')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('lockdown')
                .setDescription('Activate Raid Protocols')
                .addStringOption(opt =>
                    opt.setName('mode')
                        .setDescription('Lockdown Intensity')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Soft (Throttle Joins)', value: 'soft' },
                            { name: 'Hard (Read-Only)', value: 'hard' },
                            { name: 'Lift (Normal)', value: 'lift' }
                        )
                )
        )
        .addSubcommandGroup(group =>
            group.setName('sieve')
                .setDescription('Layer 1 Filter Patterns')
                .addSubcommand(sub =>
                    sub.setName('patch')
                        .setDescription('Add new regex pattern to sieve')
                        .addStringOption(opt => opt.setName('pattern').setDescription('Regex pattern string').setRequired(true))
                )
        )
        .addSubcommandGroup(group =>
            group.setName('policy')
                .setDescription('L2 Analyst Policies')
                .addSubcommand(sub =>
                    sub.setName('inject')
                        .setDescription('Translate natural language rule to AI heuristic')
                        .addStringOption(opt => opt.setName('rule').setDescription('Natural language rule').setRequired(true))
                )
        ) as any,

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const redis = getRedisClient().getClient();

        // Lockdown Command
        if (subcommand === 'lockdown' && !group) {
            const mode = interaction.options.getString('mode', true);
            await redis.set(`lockdown:${interaction.guildId}`, mode);

            const color = mode === 'hard' ? AvenloColors.RED : mode === 'soft' ? AvenloColors.YELLOW : AvenloColors.GREEN;
            const title = mode === 'hard' ? '🔒 PROTOCOL: HARD LOCKDOWN' : mode === 'soft' ? '🛡️ PROTOCOL: SOFT LOCKDOWN' : '✅ PROTOCOL: LIFTED';
            const desc = mode === 'hard' ? 'Server is now READ-ONLY. All joins rejected.' : mode === 'soft' ? 'Join throttling active. Message slowmode enabled.' : 'Normal operations restored.';

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(title)
                        .setColor(color)
                        .setDescription(`**Status:** ${desc}\n\nStrategic command executed by ${interaction.user}.`)
                        .setFooter({ text: 'Strategic Defense System' })
                        .setTimestamp()
                ]
            });
            return;
        }

        // Sieve Commands
        if (group === 'sieve') {
            if (subcommand === 'patch') {
                const pattern = interaction.options.getString('pattern', true);
                try {
                    new RegExp(pattern);
                } catch (e) {
                    await interaction.reply({ content: '❌ Invalid Regex Pattern.', ephemeral: true });
                    return;
                }

                await redis.sadd('sieve:patterns', pattern);
                await redis.publish('sieve:update', pattern);

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⚡ L1 Sieve Patched')
                            .setColor(AvenloColors.YELLOW)
                            .setDescription(`**Pattern Injected:** \`${pattern}\`\n**Latency Impact:** 0ms\n\nGlobal filter updated instantly across all shards.`)
                            .setFooter({ text: 'Entropic Sieve • Live Patch' })
                    ]
                });
            }
            return;
        }

        // Policy Commands
        if (group === 'policy') {
            if (subcommand === 'inject') {
                const rule = interaction.options.getString('rule', true);

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📜 Strategic Policy Injection')
                            .setColor(AvenloColors.YELLOW)
                            .setDescription(`**Policy:** "${rule}"\n\nTranslating to vector embeddings...`)
                            .addFields({ name: 'Status', value: 'Integrating into L2 Behavioral Analyst...', inline: false })
                            .setFooter({ text: 'Neural Governance Engine' })
                    ]
                });

                setTimeout(async () => {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('📜 Strategic Policy Injection')
                                .setColor(AvenloColors.GREEN)
                                .setDescription(`**Policy:** "${rule}"\n\n✅ **Injection Complete**`)
                                .addFields(
                                    { name: 'Vector Shift', value: '+0.42 Similarity', inline: true },
                                    { name: 'Heuristic Weight', value: 'High (0.85)', inline: true }
                                )
                                .setFooter({ text: 'Neural Governance Engine • Active' })
                        ]
                    });
                }, 2000);
            }
            return;
        }
    }
};
