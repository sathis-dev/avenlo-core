// ====================================
// AVENLO CORE - RULES COMMAND
// Beautiful Server Rules System
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('rules-command');

// Server channels
const RULES_CHANNEL_ID = '1382631780825305088';

// ====================================
// RULES CONTENT
// ====================================

const RULES = [
  {
    emoji: '🤝',
    title: 'Respect Everyone',
    description: 'Treat all members with respect. No harassment, hate speech, discrimination, or personal attacks. We\'re all here to learn and grow together.',
  },
  {
    emoji: '💬',
    title: 'Keep It Clean',
    description: 'No NSFW content, excessive profanity, or inappropriate material. This is a professional creative studio environment.',
  },
  {
    emoji: '🚫',
    title: 'No Spam or Self-Promotion',
    description: 'Avoid spam, excessive caps, repeated messages, or unsolicited self-promotion. Use designated channels for sharing your work.',
  },
  {
    emoji: '🔒',
    title: 'Protect Privacy',
    description: 'Never share personal information about yourself or others. Respect everyone\'s privacy and keep conversations appropriate.',
  },
  {
    emoji: '📢',
    title: 'Use Channels Correctly',
    description: 'Post content in the appropriate channels. Check channel descriptions if you\'re unsure where something belongs.',
  },
  {
    emoji: '🤖',
    title: 'Follow Bot Rules',
    description: 'Don\'t abuse bots or commands. Report bugs through tickets instead of exploiting them.',
  },
  {
    emoji: '⚠️',
    title: 'No Controversial Topics',
    description: 'Avoid heated discussions about politics, religion, or other divisive topics. Keep the focus on creativity and development.',
  },
  {
    emoji: '👮',
    title: 'Listen to Staff',
    description: 'Follow instructions from moderators and admins. Their decisions are final. If you disagree, use the ticket system.',
  },
];

// ====================================
// EMBED BUILDERS
// ====================================

function buildHeaderEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.PURPLE)
    .setAuthor({
      name: 'AVENLO STUDIO',
      iconURL: AvenloBranding.iconUrl,
    })
    .setTitle('📜 COMMUNITY GUIDELINES')
    .setDescription(
      `Welcome to **Avenlo Studio**! 🎨\n\n` +
      `To maintain a positive and productive environment, ` +
      `please read and follow these community guidelines.\n\n` +
      `*Failure to comply may result in warnings, mutes, or bans.*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setThumbnail(AvenloBranding.iconUrl);
}

function buildRulesEmbed(rulesSet: typeof RULES, startNum: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(AvenloColors.CYAN);

  let description = '';
  rulesSet.forEach((rule, index) => {
    const num = startNum + index;
    description += `### ${rule.emoji} Rule ${num}: ${rule.title}\n`;
    description += `> ${rule.description}\n\n`;
  });

  embed.setDescription(description);
  return embed;
}

function buildQuickLinksEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle('🔗 Quick Navigation')
    .setDescription(
      `**📢 Welcome Center**\n` +
      `> <#1382631780825305085> — Welcome new members\n` +
      `> <#1382631780825305088> — Server rules\n` +
      `> <#1382631780825305089> — Server information\n` +
      `> <#1382631780825305090> — Self-assign roles\n\n` +
      `**🎨 Avenlo Showcase**\n` +
      `> <#1382631782087860227> — Studio announcements\n` +
      `> <#1382631782087860228> — Our completed work\n` +
      `> <#1382631782087860229> — Active projects\n\n` +
      `**📞 Support Hub**\n` +
      `> <#1382631783031468035> — Support tickets\n` +
      `> <#1382631783031468036> — FAQ & Knowledge Base\n` +
      `> <#1382631783031468037> — Bug reports\n` +
      `> <#1382631783031468038> — Suggestions`
    );
}

function buildConsequencesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.RED)
    .setTitle('⚖️ Moderation Actions')
    .setDescription(
      `Our moderation team enforces rules fairly:\n\n` +
      `**🟡 Warning** — First offense / Minor violation\n` +
      `> A friendly reminder to follow the rules\n\n` +
      `**🟠 Timeout** — Repeated violations\n` +
      `> Temporary restriction from chatting\n\n` +
      `**🔴 Kick** — Serious violations\n` +
      `> Removal with ability to rejoin\n\n` +
      `**⛔ Ban** — Severe or repeated violations\n` +
      `> Permanent removal from the server\n\n` +
      `*All actions are logged and reviewed by AI moderation.*`
    );
}

function buildFooterEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.PURPLE)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ **By being in this server, you agree to these rules.**\n\n` +
      `Questions? Create a ticket in <#1382631783031468035>\n\n` +
      `*Last updated: December 2025*`
    )
    .setFooter({
      text: `${AvenloBranding.footer} • Community Guidelines`,
      iconURL: AvenloBranding.iconUrl,
    })
    .setTimestamp();
}

function buildRulesButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rules:accept')
      .setLabel('✅ I Agree to the Rules')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('rules:ticket')
      .setLabel('🎫 Have Questions?')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🌐 Website')
      .setStyle(ButtonStyle.Link)
      .setURL(AvenloBranding.website),
  );
}

// ====================================
// COMMAND HANDLER
// ====================================

export const rulesCommand = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('📜 Post the server rules to the rules channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option
        .setName('refresh')
        .setDescription('Clear and re-post all rules')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const refresh = interaction.options.getBoolean('refresh') ?? true;
    
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get the rules channel
      const rulesChannel = interaction.guild?.channels.cache.get(RULES_CHANNEL_ID) as TextChannel;
      
      if (!rulesChannel) {
        await interaction.editReply({
          content: '❌ Rules channel not found! Please check the channel ID.',
        });
        return;
      }

      // Clear existing messages if refresh is true
      if (refresh) {
        try {
          const messages = await rulesChannel.messages.fetch({ limit: 100 });
          const botMessages = messages.filter(msg => msg.author.id === interaction.client.user?.id);
          
          if (botMessages.size > 0) {
            await rulesChannel.bulkDelete(botMessages, true);
            logger.info(`Cleared ${botMessages.size} old rule messages`);
          }
        } catch (error) {
          logger.warn('Could not clear old messages:', error);
        }
      }

      // Build all embeds
      const embeds = [
        buildHeaderEmbed(),
        buildRulesEmbed(RULES.slice(0, 4), 1),  // Rules 1-4
        buildRulesEmbed(RULES.slice(4), 5),     // Rules 5-8
        buildQuickLinksEmbed(),
        buildConsequencesEmbed(),
        buildFooterEmbed(),
      ];

      // Send header embed
      await rulesChannel.send({ embeds: [embeds[0]] });
      
      // Send rules embeds
      await rulesChannel.send({ embeds: [embeds[1]] });
      await rulesChannel.send({ embeds: [embeds[2]] });
      
      // Send quick links
      await rulesChannel.send({ embeds: [embeds[3]] });
      
      // Send consequences
      await rulesChannel.send({ embeds: [embeds[4]] });
      
      // Send footer with buttons
      await rulesChannel.send({ 
        embeds: [embeds[5]], 
        components: [buildRulesButtons()] 
      });

      logger.info(`Rules posted to #${rulesChannel.name} by ${interaction.user.tag}`);

      await interaction.editReply({
        content: `✅ **Rules posted successfully!**\n\nCheck <#${RULES_CHANNEL_ID}> to see the beautiful rules display.`,
      });

    } catch (error) {
      logger.error('Failed to post rules:', error);
      await interaction.editReply({
        content: '❌ Failed to post rules. Please check bot permissions.',
      });
    }
  },
};

// ====================================
// BUTTON HANDLERS
// ====================================

export async function handleRulesButton(
  interaction: import('discord.js').ButtonInteraction
): Promise<void> {
  const action = interaction.customId.split(':')[1];

  if (action === 'accept') {
    // User agreed to rules
    await interaction.reply({
      content: 
        `✅ **Thanks for reading the rules, ${interaction.user}!**\n\n` +
        `You're all set to explore the server:\n\n` +
        `> 🎭 **Get Roles** — <#1382631780825305090>\n` +
        `> 💬 **Start Chatting** — Head to general channels\n` +
        `> 🎫 **Need Help?** — <#1382631783031468035>\n\n` +
        `*Welcome to Avenlo Studio!* 🎉`,
      ephemeral: true,
    });
  } else if (action === 'ticket') {
    // Direct to ticket channel
    await interaction.reply({
      content: 
        `🎫 **Need Assistance?**\n\n` +
        `Head to <#1382631783031468035> to create a support ticket.\n\n` +
        `Our team will help you with:\n` +
        `> • Rule clarifications\n` +
        `> • Appeal requests\n` +
        `> • General questions\n` +
        `> • Report issues\n\n` +
        `*Average response time: ~30 minutes*`,
      ephemeral: true,
    });
  }
}
