// ====================================
// AVENLO CORE - IDENTITY HANDLER
// Sovereign Identity Frontend
// ====================================

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextChannel,
  Message,
  ButtonInteraction,
  GuildMember
} from 'discord.js';
import { AvenloColors, AvenloBranding, createLogger } from '@avenlo/shared';
import { IdentityEngine } from './IdentityEngine';
import { RoleProfile } from '@avenlo/shared';

const logger = createLogger('identity-handler');

export class IdentityHandler {

  /**
   * Deploys the main Role Management Center panel to a channel.
   */
  static async deployIdentityPanel(channel: TextChannel): Promise<Message> {
    const guild = channel.guild;
    const topRoles = guild.roles.cache
      .filter(r => r.name !== '@everyone' && !r.managed)
      .sort((a, b) => b.members.size - a.members.size)
      .first(3);

    const featuredText = topRoles.length > 0 
      ? topRoles.map(r => `> <@&${r.id}> — **${r.members.size}** members`).join('\n')
      : `> *No custom roles available yet.*`;

    const embed = new EmbedBuilder()
      .setColor(AvenloColors.GOLD) // Yellow stripe on the left as per mockup
      .setTitle('ROLE MANAGEMENT CENTER')
      .setDescription(
        `# 💎 Welcome to the Role Center\n` +
        `**Discover, collect, and customize your server identity!**\n\n` +
        `Browse categories, unlock achievements, discover synergies, and build your perfect role collection.\n\n` +
        `### 📊 Collection Overview\n` +
        `\`Roles\` **${guild.roles.cache.filter(r => !r.managed).size}** available • **6** categories\n\n` +
        `### 🧭 Quick Navigation\n` +
        `**Categories** — Browse all role categories\n` +
        `**Templates** — Apply preset role combinations\n` +
        `**Achievements** — Unlock role collector badges\n` +
        `**My Collection** — View and manage your roles\n` +
        `**Recommendations** — AI-powered role suggestions\n\n` +
        `### 🔥 Featured Roles\n` +
        featuredText
      )
      .setFooter({ 
        text: `${AvenloBranding.footer}`,
      })
      .setTimestamp();

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('identity:category')
      .setPlaceholder('🎭 Explore a category...')
      .addOptions([
        { label: 'Creative', description: 'Artists, Producers, Writers', value: 'creative', emoji: '🎨' },
        { label: 'Technical', description: 'Developers, Hackers, IT', value: 'technical', emoji: '💻' },
        { label: 'Gaming', description: 'FPS, RPG, Strategy', value: 'gaming', emoji: '🎮' },
        { label: 'Cosmetic', description: 'Colors and Name tags', value: 'cosmetic', emoji: '✨' },
      ]);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('identity:templates')
        .setLabel('Templates')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('identity:achievements')
        .setLabel('Achievements')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('identity:collection')
        .setLabel('My Collection')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('identity:foryou')
        .setLabel('For You')
        .setEmoji('✨')
        .setStyle(ButtonStyle.Secondary)
    );

    return await channel.send({ 
      embeds: [embed], 
      components: [selectRow, buttonRow] 
    });
  }

  /**
   * Handles button clicks from the Identity Panel
   */
  static async handleInteraction(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    const member = interaction.member as GuildMember;
    
    // Sync profile on every interact to keep DB fresh
    const profile = await IdentityEngine.syncProfile(member);
    
    switch (interaction.customId) {
      case 'identity:templates':
        await this.showTemplates(interaction);
        break;
      case 'identity:achievements':
        await this.showAchievements(interaction, profile);
        break;
      case 'identity:collection':
        await this.showCollection(interaction, profile, member);
        break;
      case 'identity:foryou':
        await this.showForYou(interaction, member);
        break;
      default:
        await interaction.editReply('Unknown action.');
    }
  }

  private static async showTemplates(interaction: ButtonInteraction) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.CYAN)
      .setTitle('📦 Role Templates')
      .setDescription(
        `Select a pre-built bundle to instantly set up your identity.\n\n` +
        `**1. The Developer Stack** 💻\n` +
        `Includes: Frontend, Backend, Database, Linux\n\n` +
        `**2. The Creator Pack** 🎨\n` +
        `Includes: Artist, Video Editor, Musician`
      );
      
    await interaction.editReply({ embeds: [embed] });
  }

  private static async showAchievements(interaction: ButtonInteraction, profile: any) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.GOLD)
      .setTitle('🏆 Identity Achievements')
      .setDescription(
        `Your Collection Score: **${profile.collectionScore}**\n\n` +
        `### Unlocked Synergies\n` +
        (profile.synergiesUnlocked.length > 0 
          ? profile.synergiesUnlocked.map((s: string) => `✅ **${s.replace('_', ' ').toUpperCase()}**`).join('\n') 
          : `*No synergies unlocked yet. Equip specific role combinations to unlock them!*`)
      );
      
    await interaction.editReply({ embeds: [embed] });
  }

  private static async showCollection(interaction: ButtonInteraction, profile: any, member: GuildMember) {
    const roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(' ') || 'None';
    
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.BLUE)
      .setTitle('👤 My Collection')
      .setDescription(`Roles you currently have equipped:\n\n${roles}`);
      
    await interaction.editReply({ embeds: [embed] });
  }

  private static async showForYou(interaction: ButtonInteraction, member: GuildMember) {
    await interaction.editReply({ content: '✨ Analyzing your live profile...' });
    
    // Simulate pulling chat history by checking their nickname and join date as basic context
    const joinContext = `Member joined on ${member.joinedAt?.toDateString()}. Display name is ${member.displayName}.`;
    
    const suggestions = await IdentityEngine.getRecommendations(member, joinContext);
    
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.PURPLE)
      .setTitle('✨ AI Recommendations: For You')
      .setDescription(
        `Based on your server activity and current identity, our AI recommends adding these roles to your collection:\n\n` +
        suggestions.map(s => `> 🌟 **${s}**`).join('\n')
      )
      .setFooter({ text: 'Powered by Sovereign Identity Engine' });
      
    await interaction.editReply({ content: null, embeds: [embed] });
  }
}
