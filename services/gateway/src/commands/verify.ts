// ====================================
// AVENLO CORE - VERIFY COMMAND
// Slash entrypoint to publish the persistent verification message
// ====================================

import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { createLogger } from '@avenlo/shared';
import {
  buildVerificationEmbed,
  buildVerificationButtons,
  syncQuarantinePermissions,
} from '../handlers/ServerProtection';

const logger = createLogger('verify-command');

export const verifyCommand = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Set up the native verification system in a channel')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Publish (or refresh) the verification embed to the configured channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to post the verification message in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: 'This command must be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    // Permission check
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: 'You need Administrator or Manage Server to set up verification.',
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'The selected channel must be a text channel.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Sync quarantine permissions (ensure #verification is visible only to Quarantine)
      await syncQuarantinePermissions(guild);

      const embed = buildVerificationEmbed();
      const buttons = buildVerificationButtons();

      try {
        const message = await channel.send({
          embeds: [embed],
          components: [buttons],
        });

        await interaction.editReply({
          content: `Verification system posted to <#${channel.id}> (${message.url})`,
        });

        logger.info(
          `${interaction.user.tag} set up verification in #${channel.name} (${guild.name})`
        );
      } catch (err) {
        logger.error('Failed to post verification message:', err);
        await interaction.editReply({
          content: 'Failed to post the verification message. Check bot permissions.',
        });
      }
      return;
    }

    await interaction.reply({
      content: 'Unknown subcommand.',
      ephemeral: true,
    });
  },
};
