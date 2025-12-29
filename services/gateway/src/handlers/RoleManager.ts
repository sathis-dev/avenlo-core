// ====================================
// AVENLO CORE - ROLE MANAGEMENT SYSTEM
// AI-Powered Role Management
// ====================================

import {
  Guild,
  GuildMember,
  Role,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ColorResolvable,
  User,
} from 'discord.js';
import OpenAI from 'openai';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('role-manager');

// ====================================
// CONFIGURATION
// ====================================

export const ROLE_CONFIG = {
  // Level-up roles (based on activity/XP - future implementation)
  levelRoles: new Map<number, string>([
    // [level, roleId]
    // [5, 'role_id_level_5'],
    // [10, 'role_id_level_10'],
  ]),
  
  // Self-assignable roles
  selfAssignableRoles: [] as string[],
  
  // Protected roles (cannot be modified by commands)
  protectedRoles: [
    process.env.ROLE_MANAGEMENT,
    process.env.ROLE_MODERATOR,
  ].filter(Boolean) as string[],
  
  // AI analysis enabled
  enableAIAnalysis: true,
};

// ====================================
// TYPES
// ====================================

interface RoleAnalysis {
  role: Role;
  memberCount: number;
  permissions: string[];
  isAdministrative: boolean;
  isModeration: boolean;
  isDangerous: boolean;
  suggestions: string[];
}

interface RoleHierarchyIssue {
  type: 'gap' | 'conflict' | 'redundant' | 'dangerous';
  description: string;
  roles: Role[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

// ====================================
// ROLE ANALYSIS
// ====================================

export function analyzeRole(role: Role): RoleAnalysis {
  const permissions = role.permissions.toArray();
  
  const adminPerms = ['Administrator'];
  const modPerms = ['KickMembers', 'BanMembers', 'ManageMessages', 'ManageRoles', 'ManageChannels'];
  const dangerousPerms = ['Administrator', 'ManageGuild', 'ManageWebhooks', 'ManageRoles'];
  
  const isAdministrative = permissions.some(p => adminPerms.includes(p));
  const isModeration = permissions.some(p => modPerms.includes(p));
  const isDangerous = permissions.some(p => dangerousPerms.includes(p));
  
  const suggestions: string[] = [];
  
  if (isAdministrative && role.members.size > 3) {
    suggestions.push('⚠️ Administrator role has many members. Consider limiting access.');
  }
  
  if (isDangerous && !role.name.toLowerCase().includes('admin') && !role.name.toLowerCase().includes('mod')) {
    suggestions.push('⚠️ Role has dangerous permissions but unclear name. Consider renaming for clarity.');
  }
  
  if (role.mentionable && isDangerous) {
    suggestions.push('⚠️ Administrative role is mentionable. Consider disabling mentions.');
  }
  
  return {
    role,
    memberCount: role.members.size,
    permissions,
    isAdministrative,
    isModeration,
    isDangerous,
    suggestions,
  };
}

export function analyzeRoleHierarchy(guild: Guild): RoleHierarchyIssue[] {
  const issues: RoleHierarchyIssue[] = [];
  const roles = guild.roles.cache.sort((a, b) => b.position - a.position);
  
  // Check for gaps in hierarchy
  let lastAdminRole: Role | null = null;
  let lastModRole: Role | null = null;
  
  roles.forEach(role => {
    const analysis = analyzeRole(role);
    
    if (analysis.isAdministrative) {
      if (lastAdminRole && lastAdminRole.position - role.position > 5) {
        issues.push({
          type: 'gap',
          description: `Large gap between admin roles: ${lastAdminRole.name} and ${role.name}`,
          roles: [lastAdminRole, role],
          severity: 'low',
          suggestion: 'Consider adding intermediate management roles',
        });
      }
      lastAdminRole = role;
    }
    
    if (analysis.isModeration) {
      lastModRole = role;
    }
    
    // Check for dangerous configurations
    if (role.permissions.has(PermissionFlagsBits.Administrator) && role.members.size > 5) {
      issues.push({
        type: 'dangerous',
        description: `${role.name} has Administrator and ${role.members.size} members`,
        roles: [role],
        severity: 'critical',
        suggestion: 'Limit Administrator access to trusted individuals',
      });
    }
  });
  
  return issues;
}

// ====================================
// AI-POWERED ROLE SUGGESTIONS
// ====================================

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export async function getAIRoleSuggestions(
  guild: Guild,
  context: string
): Promise<string[]> {
  if (!ROLE_CONFIG.enableAIAnalysis) {
    return [];
  }
  
  try {
    const ai = getOpenAI();
    
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({
        name: r.name,
        members: r.members.size,
        color: r.hexColor,
        hoisted: r.hoist,
        permissions: r.permissions.toArray().slice(0, 10),
      }));
    
    const response = await ai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Discord server management expert. Analyze the role structure and provide suggestions.
          
Respond with a JSON array of 3-5 actionable suggestions. Each suggestion should be a single string.
Example: ["Create a 'Trial Moderator' role for new staff", "Add color roles for personalization"]`,
        },
        {
          role: 'user',
          content: `Server: ${guild.name}
Members: ${guild.memberCount}
Context: ${context}

Current roles:
${JSON.stringify(roles, null, 2)}

Provide role structure suggestions.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const content = response.choices[0]?.message?.content || '[]';
    return JSON.parse(content);
  } catch (error) {
    logger.error('AI role suggestions failed:', error);
    return [];
  }
}

// ====================================
// ROLE OPERATIONS
// ====================================

export async function createRole(
  guild: Guild,
  options: {
    name: string;
    color?: ColorResolvable;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: bigint[];
    reason?: string;
  }
): Promise<Role> {
  const role = await guild.roles.create({
    name: options.name,
    color: options.color,
    hoist: options.hoist ?? false,
    mentionable: options.mentionable ?? false,
    permissions: options.permissions,
    reason: options.reason || 'Role created via Avenlo Core',
  });
  
  logger.info(`Created role ${role.name} in ${guild.name}`);
  return role;
}

export async function deleteRole(
  role: Role,
  reason?: string
): Promise<void> {
  if (ROLE_CONFIG.protectedRoles.includes(role.id)) {
    throw new Error('Cannot delete protected role');
  }
  
  const roleName = role.name;
  const guildName = role.guild.name;
  
  await role.delete(reason || 'Role deleted via Avenlo Core');
  logger.info(`Deleted role ${roleName} from ${guildName}`);
}

export async function assignRole(
  member: GuildMember,
  role: Role,
  reason?: string
): Promise<void> {
  if (member.roles.cache.has(role.id)) {
    throw new Error('Member already has this role');
  }
  
  await member.roles.add(role, reason || 'Role assigned via Avenlo Core');
  logger.info(`Assigned ${role.name} to ${member.user.tag}`);
}

export async function removeRole(
  member: GuildMember,
  role: Role,
  reason?: string
): Promise<void> {
  if (!member.roles.cache.has(role.id)) {
    throw new Error('Member does not have this role');
  }
  
  await member.roles.remove(role, reason || 'Role removed via Avenlo Core');
  logger.info(`Removed ${role.name} from ${member.user.tag}`);
}

export async function bulkAssignRole(
  guild: Guild,
  roleId: string,
  memberIds: string[],
  reason?: string
): Promise<{ success: number; failed: number }> {
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Role not found');
  
  let success = 0;
  let failed = 0;
  
  for (const memberId of memberIds) {
    try {
      const member = await guild.members.fetch(memberId);
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(role, reason);
        success++;
      }
    } catch (error) {
      failed++;
    }
  }
  
  logger.info(`Bulk assigned ${role.name}: ${success} success, ${failed} failed`);
  return { success, failed };
}

export async function bulkRemoveRole(
  guild: Guild,
  roleId: string,
  memberIds: string[],
  reason?: string
): Promise<{ success: number; failed: number }> {
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Role not found');
  
  let success = 0;
  let failed = 0;
  
  for (const memberId of memberIds) {
    try {
      const member = await guild.members.fetch(memberId);
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role, reason);
        success++;
      }
    } catch (error) {
      failed++;
    }
  }
  
  logger.info(`Bulk removed ${role.name}: ${success} success, ${failed} failed`);
  return { success, failed };
}

// ====================================
// ROLE SYNC (Copy roles between users)
// ====================================

export async function syncRoles(
  source: GuildMember,
  target: GuildMember,
  excludeRoles?: string[]
): Promise<Role[]> {
  const excludeSet = new Set([
    ...ROLE_CONFIG.protectedRoles,
    ...(excludeRoles || []),
    source.guild.id, // @everyone
  ]);
  
  const rolesToAdd = source.roles.cache
    .filter(role => !excludeSet.has(role.id) && !target.roles.cache.has(role.id))
    .map(role => role);
  
  if (rolesToAdd.length > 0) {
    await target.roles.add(rolesToAdd, `Synced from ${source.user.tag}`);
  }
  
  logger.info(`Synced ${rolesToAdd.length} roles from ${source.user.tag} to ${target.user.tag}`);
  return rolesToAdd;
}

// ====================================
// EMBED BUILDERS
// ====================================

export function buildRoleListEmbed(guild: Guild): EmbedBuilder {
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  
  const roleList = roles.map(r => 
    `${r} — ${r.members.size} member${r.members.size !== 1 ? 's' : ''}`
  ).join('\n');
  
  return new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle('📋 Server Roles')
    .setDescription(roleList.slice(0, 4000) || 'No roles found')
    .addFields(
      { name: 'Total Roles', value: roles.size.toString(), inline: true },
      { name: 'Highest Role', value: roles.first()?.name || 'None', inline: true },
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
}

export function buildRoleInfoEmbed(role: Role): EmbedBuilder {
  const analysis = analyzeRole(role);
  
  const permList = analysis.permissions.length > 0
    ? analysis.permissions.slice(0, 15).join(', ')
    : 'None';
  
  const embed = new EmbedBuilder()
    .setColor(role.color || AvenloColors.GRAY)
    .setTitle(`Role: ${role.name}`)
    .addFields(
      { name: 'ID', value: `\`${role.id}\``, inline: true },
      { name: 'Color', value: role.hexColor, inline: true },
      { name: 'Position', value: role.position.toString(), inline: true },
      { name: 'Members', value: role.members.size.toString(), inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Permissions', value: `\`\`\`${permList}\`\`\``, inline: false },
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
  
  if (analysis.suggestions.length > 0) {
    embed.addFields({
      name: '⚠️ Suggestions',
      value: analysis.suggestions.join('\n'),
      inline: false,
    });
  }
  
  return embed;
}

export function buildRoleAuditEmbed(guild: Guild): EmbedBuilder {
  const issues = analyzeRoleHierarchy(guild);
  
  if (issues.length === 0) {
    return new EmbedBuilder()
      .setColor(AvenloColors.GREEN)
      .setTitle('✅ Role Audit Complete')
      .setDescription('No issues found with your role hierarchy!')
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
  }
  
  const issueList = issues.map(issue => {
    const emoji = issue.severity === 'critical' ? '🔴' :
                  issue.severity === 'high' ? '🟠' :
                  issue.severity === 'medium' ? '🟡' : '🟢';
    return `${emoji} **${issue.type.toUpperCase()}**: ${issue.description}\n   └ ${issue.suggestion}`;
  }).join('\n\n');
  
  return new EmbedBuilder()
    .setColor(issues.some(i => i.severity === 'critical') ? AvenloColors.RED : AvenloColors.YELLOW)
    .setTitle('🔍 Role Audit Results')
    .setDescription(issueList)
    .addFields({
      name: 'Summary',
      value: `Found ${issues.length} issue${issues.length !== 1 ? 's' : ''}`,
      inline: false,
    })
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
}

// ====================================
// EXPORTS
// ====================================

export const RoleManager = {
  // Analysis
  analyzeRole,
  analyzeRoleHierarchy,
  getAIRoleSuggestions,
  
  // Operations
  createRole,
  deleteRole,
  assignRole,
  removeRole,
  bulkAssignRole,
  bulkRemoveRole,
  syncRoles,
  
  // Embeds
  buildRoleListEmbed,
  buildRoleInfoEmbed,
  buildRoleAuditEmbed,
};

export default RoleManager;
