// ====================================
// AVENLO CORE - MODERATION COMMAND
// Comprehensive AI-Powered Moderation
// ====================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  User,
  TextChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from './index';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';
import { AIModerationHandlers } from '../handlers/AIModeration';
import { RoleManager } from '../handlers/RoleManager';
import { PermissionManager } from '../handlers/PermissionManager';
import { ServerProtection } from '../handlers/ServerProtection';

const logger = createLogger('mod-command');

export const modCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('🛡️ Comprehensive moderation commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    
    // ====================================
    // USER MODERATION
    // ====================================
    .addSubcommandGroup(group =>
      group
        .setName('user')
        .setDescription('User moderation actions')
        .addSubcommand(sub =>
          sub
            .setName('warn')
            .setDescription('Warn a user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to warn').setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('reason').setDescription('Reason for warning').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('mute')
            .setDescription('Mute a user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to mute').setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName('duration').setDescription('Duration in minutes').setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('reason').setDescription('Reason for mute').setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('unmute')
            .setDescription('Unmute a user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to unmute').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('kick')
            .setDescription('Kick a user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to kick').setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('reason').setDescription('Reason for kick').setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to ban').setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('reason').setDescription('Reason for ban').setRequired(false)
            )
            .addIntegerOption(opt =>
              opt
                .setName('delete_days')
                .setDescription('Days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('unban')
            .setDescription('Unban a user')
            .addStringOption(opt =>
              opt.setName('user_id').setDescription('User ID to unban').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('info')
            .setDescription('Get user moderation info')
            .addUserOption(opt =>
              opt.setName('user').setDescription('User to check').setRequired(true)
            )
        )
    )
    
    // ====================================
    // CHANNEL MODERATION
    // ====================================
    .addSubcommandGroup(group =>
      group
        .setName('channel')
        .setDescription('Channel moderation actions')
        .addSubcommand(sub =>
          sub
            .setName('lock')
            .setDescription('Lock a channel')
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('Channel to lock')
            )
            .addStringOption(opt =>
              opt.setName('reason').setDescription('Reason for lock')
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('unlock')
            .setDescription('Unlock a channel')
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('Channel to unlock')
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('slowmode')
            .setDescription('Set slowmode')
            .addIntegerOption(opt =>
              opt
                .setName('seconds')
                .setDescription('Slowmode in seconds (0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
            )
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('Channel (default: current)')
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('purge')
            .setDescription('Bulk delete messages')
            .addIntegerOption(opt =>
              opt
                .setName('amount')
                .setDescription('Number of messages (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
            )
            .addUserOption(opt =>
              opt.setName('user').setDescription('Only delete from this user')
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('audit')
            .setDescription('Audit channel permissions')
            .addChannelOption(opt =>
              opt.setName('channel').setDescription('Channel to audit')
            )
        )
    )
    
    // ====================================
    // ROLE MANAGEMENT
    // ====================================
    .addSubcommandGroup(group =>
      group
        .setName('role')
        .setDescription('Role management')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add role to user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('Target user').setRequired(true)
            )
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Role to add').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove role from user')
            .addUserOption(opt =>
              opt.setName('user').setDescription('Target user').setRequired(true)
            )
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Role to remove').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('info')
            .setDescription('Get role information')
            .addRoleOption(opt =>
              opt.setName('role').setDescription('Role to inspect').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all server roles')
        )
        .addSubcommand(sub =>
          sub
            .setName('audit')
            .setDescription('Audit role hierarchy')
        )
    )
    
    // ====================================
    // SERVER PROTECTION
    // ====================================
    .addSubcommandGroup(group =>
      group
        .setName('protect')
        .setDescription('Server protection controls')
        .addSubcommand(sub =>
          sub
            .setName('status')
            .setDescription('View protection status')
        )
        .addSubcommand(sub =>
          sub
            .setName('lockdown')
            .setDescription('Activate server lockdown')
        )
        .addSubcommand(sub =>
          sub
            .setName('unlock')
            .setDescription('Lift server lockdown')
        )
        .addSubcommand(sub =>
          sub
            .setName('audit')
            .setDescription('Full server permission audit')
        )
    )
    
    // ====================================
    // AI MODERATION
    // ====================================
    .addSubcommandGroup(group =>
      group
        .setName('ai')
        .setDescription('AI moderation tools')
        .addSubcommand(sub =>
          sub
            .setName('analyze')
            .setDescription('Analyze text with AI')
            .addStringOption(opt =>
              opt.setName('text').setDescription('Text to analyze').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('status')
            .setDescription('AI moderation status')
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;

    // ====================================
    // USER MODERATION
    // ====================================
    if (group === 'user') {
      switch (subcommand) {
        case 'warn': {
          const user = interaction.options.getMember('user') as GuildMember;
          const reason = interaction.options.getString('reason', true);
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          await AIModerationHandlers.warnUser(user, reason, interaction.user);
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.YELLOW)
            .setTitle('⚠️ User Warned')
            .setDescription(`${user} has been warned.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false },
              { name: 'Moderator', value: `${interaction.user}`, inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'mute': {
          const user = interaction.options.getMember('user') as GuildMember;
          const duration = interaction.options.getInteger('duration', true);
          const reason = interaction.options.getString('reason') || 'No reason provided';
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          await AIModerationHandlers.muteUser(user, duration, reason, interaction.user);
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('🔇 User Muted')
            .setDescription(`${user} has been muted.`)
            .addFields(
              { name: 'Duration', value: `${duration} minutes`, inline: true },
              { name: 'Reason', value: reason, inline: false },
              { name: 'Moderator', value: `${interaction.user}`, inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'unmute': {
          const user = interaction.options.getMember('user') as GuildMember;
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          await user.timeout(null, 'Unmuted by moderator');
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.GREEN)
                .setDescription(`✅ ${user} has been unmuted.`)
            ]
          });
          break;
        }
        
        case 'kick': {
          const user = interaction.options.getMember('user') as GuildMember;
          const reason = interaction.options.getString('reason') || 'No reason provided';
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          if (!user.kickable) {
            await interaction.reply({ content: '❌ Cannot kick this user.', ephemeral: true });
            return;
          }
          
          await AIModerationHandlers.kickUser(user, reason, interaction.user);
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('👢 User Kicked')
            .setDescription(`**${user.user.tag}** has been kicked.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false },
              { name: 'Moderator', value: `${interaction.user}`, inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'ban': {
          const user = interaction.options.getUser('user', true);
          const reason = interaction.options.getString('reason') || 'No reason provided';
          const deleteDays = interaction.options.getInteger('delete_days') || 1;
          
          const targetMember = await guild.members.fetch(user.id).catch(() => null);
          
          if (targetMember && !targetMember.bannable) {
            await interaction.reply({ content: '❌ Cannot ban this user.', ephemeral: true });
            return;
          }
          
          await guild.members.ban(user.id, {
            reason: `${reason} | By: ${interaction.user.tag}`,
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
          });
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('🔨 User Banned')
            .setDescription(`**${user.tag}** has been banned.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false },
              { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true },
              { name: 'Moderator', value: `${interaction.user}`, inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'unban': {
          const userId = interaction.options.getString('user_id', true);
          
          try {
            await guild.members.unban(userId, `Unbanned by ${interaction.user.tag}`);
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(AvenloColors.GREEN)
                  .setDescription(`✅ User \`${userId}\` has been unbanned.`)
              ]
            });
          } catch (error) {
            await interaction.reply({ content: '❌ Could not unban user. Check the ID.', ephemeral: true });
          }
          break;
        }
        
        case 'info': {
          const user = interaction.options.getMember('user') as GuildMember;
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          const embed = new EmbedBuilder()
            .setColor(user.displayColor || AvenloColors.CYAN)
            .setAuthor({ name: user.user.tag, iconURL: user.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: 'ID', value: `\`${user.id}\``, inline: true },
              { name: 'Nickname', value: user.nickname || 'None', inline: true },
              { name: 'Joined', value: `<t:${Math.floor(user.joinedTimestamp! / 1000)}:R>`, inline: true },
              { name: 'Created', value: `<t:${Math.floor(user.user.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Roles', value: user.roles.cache.size > 1 ? user.roles.cache.filter(r => r.id !== guild.id).map(r => r.toString()).join(' ') : 'None', inline: false },
              { name: 'Permissions', value: user.permissions.has(PermissionFlagsBits.Administrator) ? '👑 Administrator' : 'Standard', inline: true },
              { name: 'Timed Out', value: user.isCommunicationDisabled() ? `Yes (until <t:${Math.floor(user.communicationDisabledUntilTimestamp! / 1000)}:R>)` : 'No', inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }
    
    // ====================================
    // CHANNEL MODERATION
    // ====================================
    else if (group === 'channel') {
      switch (subcommand) {
        case 'lock': {
          const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
          const reason = interaction.options.getString('reason') || 'Channel locked by moderator';
          
          await PermissionManager.lockChannel(channel, reason);
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.RED)
                .setDescription(`🔒 ${channel} has been locked.\n**Reason:** ${reason}`)
            ]
          });
          break;
        }
        
        case 'unlock': {
          const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
          
          await PermissionManager.unlockChannel(channel);
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.GREEN)
                .setDescription(`🔓 ${channel} has been unlocked.`)
            ]
          });
          break;
        }
        
        case 'slowmode': {
          const seconds = interaction.options.getInteger('seconds', true);
          const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
          
          await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.CYAN)
                .setDescription(seconds > 0
                  ? `⏱️ Slowmode set to ${seconds} seconds in ${channel}`
                  : `⏱️ Slowmode disabled in ${channel}`)
            ]
          });
          break;
        }
        
        case 'purge': {
          const amount = interaction.options.getInteger('amount', true);
          const user = interaction.options.getUser('user');
          const channel = interaction.channel as TextChannel;
          
          await interaction.deferReply({ ephemeral: true });
          
          let messages = await channel.messages.fetch({ limit: 100 });
          
          if (user) {
            messages = messages.filter(m => m.author.id === user.id);
          }
          
          const toDelete = messages.first(amount);
          const deleted = await channel.bulkDelete(toDelete, true);
          
          await interaction.editReply({
            content: `🗑️ Deleted ${deleted.size} messages${user ? ` from ${user.tag}` : ''}.`
          });
          break;
        }
        
        case 'audit': {
          const channel = interaction.options.getChannel('channel') || interaction.channel;
          const result = PermissionManager.analyzeChannelPermissions(channel as any);
          const embed = PermissionManager.buildPermissionAuditEmbed(result);
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }
    
    // ====================================
    // ROLE MANAGEMENT
    // ====================================
    else if (group === 'role') {
      switch (subcommand) {
        case 'add': {
          const user = interaction.options.getMember('user') as GuildMember;
          const role = interaction.options.getRole('role', true);
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          await RoleManager.assignRole(user, role as any);
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.GREEN)
                .setDescription(`✅ Added ${role} to ${user}`)
            ]
          });
          break;
        }
        
        case 'remove': {
          const user = interaction.options.getMember('user') as GuildMember;
          const role = interaction.options.getRole('role', true);
          
          if (!user) {
            await interaction.reply({ content: '❌ User not found.', ephemeral: true });
            return;
          }
          
          await RoleManager.removeRole(user, role as any);
          
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(AvenloColors.GREEN)
                .setDescription(`✅ Removed ${role} from ${user}`)
            ]
          });
          break;
        }
        
        case 'info': {
          const role = interaction.options.getRole('role', true);
          const embed = RoleManager.buildRoleInfoEmbed(role as any);
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'list': {
          const embed = RoleManager.buildRoleListEmbed(guild);
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'audit': {
          const embed = RoleManager.buildRoleAuditEmbed(guild);
          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }
    
    // ====================================
    // SERVER PROTECTION
    // ====================================
    else if (group === 'protect') {
      switch (subcommand) {
        case 'status': {
          const embed = ServerProtection.buildProtectionStatusEmbed(guild);
          await interaction.reply({ embeds: [embed] });
          break;
        }
        
        case 'lockdown': {
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Only administrators can activate lockdown.', ephemeral: true });
            return;
          }
          
          await interaction.deferReply();
          
          const count = await PermissionManager.lockdownServer(guild, 'Manual lockdown');
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('🔒 SERVER LOCKDOWN ACTIVATED')
            .setDescription(`All ${count} text channels have been locked.`)
            .addFields(
              { name: 'Activated By', value: `${interaction.user}`, inline: true },
              { name: 'Channels Locked', value: count.toString(), inline: true },
            )
            .setFooter({ text: 'Use /mod protect unlock to lift' })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        
        case 'unlock': {
          if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Only administrators can lift lockdown.', ephemeral: true });
            return;
          }
          
          await interaction.deferReply();
          
          const count = await PermissionManager.unlockdownServer(guild, 'Lockdown lifted');
          
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.GREEN)
            .setTitle('🔓 SERVER UNLOCKED')
            .setDescription(`All ${count} text channels have been unlocked.`)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        
        case 'audit': {
          const embed = PermissionManager.buildServerAuditEmbed(guild);
          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }
    
    // ====================================
    // AI MODERATION
    // ====================================
    else if (group === 'ai') {
      switch (subcommand) {
        case 'analyze': {
          const text = interaction.options.getString('text', true);
          
          await interaction.deferReply({ ephemeral: true });
          
          const result = await AIModerationHandlers.analyzeContent(text);
          
          const embed = new EmbedBuilder()
            .setColor(
              result.score >= 80 ? AvenloColors.RED :
              result.score >= 60 ? 0xFF6B6B :
              result.score >= 40 ? AvenloColors.YELLOW :
              AvenloColors.GREEN
            )
            .setTitle('🤖 AI Content Analysis')
            .setDescription(`**Analyzed Text:**\n\`\`\`${text.slice(0, 500)}\`\`\``)
            .addFields(
              { name: 'Score', value: `${result.score}/100`, inline: true },
              { name: 'Severity', value: result.severity.toUpperCase(), inline: true },
              { name: 'Should Moderate', value: result.shouldModerate ? 'Yes' : 'No', inline: true },
              { name: 'Suggested Action', value: result.suggestedAction, inline: true },
              { name: 'Reason', value: result.reason, inline: false },
              { name: 'AI Explanation', value: result.aiExplanation.slice(0, 1000), inline: false },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          break;
        }
        
        case 'status': {
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.CYAN)
            .setTitle('🤖 AI Moderation Status')
            .setDescription('GPT-4 powered content moderation is active.')
            .addFields(
              { name: 'Model', value: 'gpt-4o', inline: true },
              { name: 'Auto-Moderation', value: '✅ Enabled', inline: true },
              { name: 'Spam Detection', value: '✅ Enabled', inline: true },
              { name: 'Raid Protection', value: '✅ Enabled', inline: true },
            )
            .setFooter({ text: AvenloBranding.footer })
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }
  },
};

export default modCommand;
