// ====================================
// AVENLO CORE - RULES COMMAND
// Slash entrypoint for the Rules v1 Core module.
// All logic lives in handlers/RulesHandler.ts so the same pipeline
// is shared with the dashboard's "Publish to channel" button.
// ====================================

import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
} from 'discord.js';
import { createLogger } from '@avenlo/shared';
import {
  manuallyAcceptRules,
  publishRulesToGuild,
} from '../handlers/RulesHandler';

const logger = createLogger('rules-command');

export const rulesCommand = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('📜 Manage the server rules system')
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publish (or refresh) the rules embed to the configured channel'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('accept')
        .setDescription('Mark yourself as having read & accepted the rules'),
    )
    .setDefaultMemberPermissions(null) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: '❌ This command must be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'publish') {
      // Admin-only at runtime (Discord's `setDefaultMemberPermissions(null)` is a hint,
      // not enforcement, so we double-check here).
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: '❌ You need Manage Server or Administrator to publish rules.',
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await publishRulesToGuild(guild, {
        publishedBy: interaction.user.username,
        forceRepost: false,
      });
      if (!result.ok) {
        await interaction.editReply({ content: `❌ ${result.error}` });
        return;
      }
      await interaction.editReply({
        content: result.edited
          ? `✅ Rules updated in <#${result.channelId}>.`
          : `✅ Rules posted to <#${result.channelId}>.`,
      });
      logger.info(
        `📜 ${interaction.user.tag} ${result.edited ? 'edited' : 'posted'} rules in ${guild.name}`,
      );
      return;
    }

    if (sub === 'accept') {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: '⚠️ Could not locate your member object — rejoin and retry.',
          ephemeral: true,
        });
        return;
      }
      const { memberRoleGranted } = await manuallyAcceptRules(guild, member);
      await interaction.reply({
        content: memberRoleGranted
          ? '✅ Acceptance recorded — you now have the **Member** role.'
          : '✅ Acceptance recorded.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: 'Unknown subcommand.',
      ephemeral: true,
    });
  },
};

/**
 * Legacy export retained for compatibility — older code paths may still import
 * this. New code routes through `RulesHandlers` directly.
 */
export async function handleRulesButton(_interaction: ButtonInteraction): Promise<void> {
  logger.warn(
    'handleRulesButton() is deprecated — route via RulesHandlers in client.ts instead.',
  );
}
