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
  Guild,
} from 'discord.js';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('rules-command');

// ====================================
// CHANNEL FINDER
// ====================================

function findChannel(guild: Guild, name: string): string {
  const channel = guild.channels.cache.find(
    c => c.name.toLowerCase().replace(/-/g, '') === name.toLowerCase().replace(/-/g, '') ||
         c.name.toLowerCase() === name.toLowerCase()
  );
  return channel ? `<#${channel.id}>` : `#${name}`;
}

function getChannelLinks(guild: Guild) {
  return {
    welcome: findChannel(guild, 'welcome'),
    rules: findChannel(guild, 'rules'),
    information: findChannel(guild, 'information'),
    roles: findChannel(guild, 'roles'),
    studioNews: findChannel(guild, 'studio-news'),
    ourWork: findChannel(guild, 'our-work'),
    activeProjects: findChannel(guild, 'active-projects'),
    tickets: findChannel(guild, 'tickets'),
    faq: findChannel(guild, 'faq-knowledge-base'),
    bugReports: findChannel(guild, 'bug-reports'),
    suggestions: findChannel(guild, 'suggestions'),
  };
}

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

function buildQuickLinksEmbed(guild: Guild): EmbedBuilder {
  const ch = getChannelLinks(guild);
  
  return new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle('🔗 Quick Navigation')
    .setDescription(
      `**📢 Welcome Center**\n` +
      `> ${ch.welcome} — Welcome new members\n` +
      `> ${ch.rules} — Server rules\n` +
      `> ${ch.information} — Server information\n` +
      `> ${ch.roles} — Self-assign roles\n\n` +
      `**🎨 Avenlo Showcase**\n` +
      `> ${ch.studioNews} — Studio announcements\n` +
      `> ${ch.ourWork} — Our completed work\n` +
      `> ${ch.activeProjects} — Active projects\n\n` +
      `**📞 Support Hub**\n` +
      `> ${ch.tickets} — Support tickets\n` +
      `> ${ch.faq} — FAQ & Knowledge Base\n` +
      `> ${ch.bugReports} — Bug reports\n` +
      `> ${ch.suggestions} — Suggestions`
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

function buildFooterEmbed(guild: Guild): EmbedBuilder {
  const ch = getChannelLinks(guild);
  
  return new EmbedBuilder()
    .setColor(AvenloColors.PURPLE)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ **By being in this server, you agree to these rules.**\n\n` +
      `Questions? Create a ticket in ${ch.tickets}\n\n` +
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
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      // Find the rules channel dynamically by name
      const rulesChannel = guild.channels.cache.find(
        c => c.name.toLowerCase() === 'rules'
      ) as TextChannel;
      
      if (!rulesChannel) {
        await interaction.editReply({
          content: '❌ Rules channel not found! Please create a channel named `rules`.',
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

      // Build all embeds with dynamic channel links
      const embeds = [
        buildHeaderEmbed(),
        buildRulesEmbed(RULES.slice(0, 4), 1),  // Rules 1-4
        buildRulesEmbed(RULES.slice(4), 5),     // Rules 5-8
        buildQuickLinksEmbed(guild),
        buildConsequencesEmbed(),
        buildFooterEmbed(guild),
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
        content: `✅ **Rules posted successfully!**\n\nCheck <#${rulesChannel.id}> to see the beautiful rules display.`,
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
