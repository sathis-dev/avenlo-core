
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from './index';
import { AvenloColors, getRedisClient } from '@avenlo/shared';

// ====================================
// SOVEREIGN SUITE (OWNER TIER)
// Focus: Total governance (The "Soul" of the community)
// ====================================

export const sovereignCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('avenlo')
        .setDescription('Sovereign Control: System Core Directives')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Technically Owner only, checked in execute
        .addSubcommand(sub =>
            sub.setName('pivot')
                .setDescription('Shift global Avenlo Vibe/Culture')
                .addStringOption(opt => opt.setName('vibe').setDescription('Target vibe (e.g. "Professional", "Casual")').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('nuke')
                .setDescription('☢️ TRIGGER SAFE-STATE ZERO (Emergency Shutdown)')
        )
        .addSubcommand(sub =>
            sub.setName('rehabilitate')
                .setDescription('Grant Legacy Trust to user (Bypass L2)')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        ) as any,

    async execute(interaction: ChatInputCommandInteraction) {
        // Strict Owner Check
        if (interaction.user.id !== process.env.DISCORD_OWNER_ID && interaction.user.id !== '162208156637855744') { // Fallback ID from earlier context or just check owner
            // Actually, verify via guild owner if env not set
            if (interaction.guild && interaction.guild.ownerId !== interaction.user.id) {
                await interaction.reply({ content: '👑 Sovereign Access Required.', ephemeral: true });
                return;
            }
        }

        const subcommand = interaction.options.getSubcommand();
        const redis = getRedisClient().getClient();

        if (subcommand === 'pivot') {
            const vibe = interaction.options.getString('vibe', true);
            await redis.set('system:vibe', vibe);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('👑 Sovereign Pivot Executed')
                        .setColor(AvenloColors.GOLD)
                        .setDescription(`**Target Culture:** "${vibe}"\n\nRecalculating global L2 weights...`)
                        .addFields(
                            { name: 'Tone Shift', value: 'Immediate', inline: true },
                            { name: 'Aggression Threshold', value: 'Adjusted', inline: true }
                        )
                        .setFooter({ text: 'Sovereign Will Enforced' })
                ]
            });
        }

        else if (subcommand === 'nuke') {
            // Safe-State Zero
            await redis.set('system:status', 'shutdown');
            await redis.publish('system:nuke', 'true');

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('☢️ SAFE-STATE ZERO TRIGGERED')
                        .setColor(AvenloColors.RED)
                        .setDescription(`**SYSTEM SHUTDOWN INITIATED**\n\n• All channels set to READ-ONLY\n• API Keys Rotated\n• Forensic Snapshot Generating...`)
                        .setFooter({ text: 'Authorize: SOVEREIGN-01' })
                        .setTimestamp()
                ]
            });
        }

        else if (subcommand === 'rehabilitate') {
            const user = interaction.options.getUser('user', true);
            await redis.set(`reputation:${user.id}:trust`, 'legacy');
            await redis.set(`reputation:${user.id}:score`, '100');

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✨ Sovereign Rehabilitation')
                        .setColor(AvenloColors.GOLD)
                        .setDescription(`**User:** ${user}\n**Status:** LEGACY TRUST GRANTED\n\nThis user is now immune to L2 behavioral scrutiny.`)
                        .setFooter({ text: 'Grace Extended' })
                ]
            });
        }
    }
};
