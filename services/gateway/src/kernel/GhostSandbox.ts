// ====================================
// AVENLO CORE - GHOST SANDBOX
// Shadow Realm Management for Hostile Users
// ====================================

import { Guild, GuildMember, TextChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import { createLogger } from '@avenlo/shared';

const logger = createLogger('ghost-sandbox');

export class GhostSandbox {
  private static instance: GhostSandbox;

  private constructor() {}

  public static getInstance(): GhostSandbox {
    if (!GhostSandbox.instance) {
      GhostSandbox.instance = new GhostSandbox();
    }
    return GhostSandbox.instance;
  }

  /**
   * Exile a user to the Ghost Sandbox instead of banning them.
   * This strips all roles and traps them in a fake channel where Phantom Agents engage them.
   */
  async exile(member: GuildMember, reason: string): Promise<void> {
    const guild = member.guild;

    try {
      // 1. Get or create the shadow category
      let shadowCategory = guild.channels.cache.find(c => c.name === 'GATEWAY_SHADOW' && c.type === ChannelType.GuildCategory);
      if (!shadowCategory) {
        shadowCategory = await guild.channels.create({
          name: 'GATEWAY_SHADOW',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
          ]
        });
      }

      // 2. Get or create the ghost role
      let ghostRole = guild.roles.cache.find(r => r.name === 'Ghost');
      if (!ghostRole) {
        ghostRole = await guild.roles.create({
          name: 'Ghost',
          color: '#000000',
          permissions: [], // Absolute zero permissions globally
          reason: 'Avenlo Ultra Kernel: Ghost Role'
        });

        // Hide all normal channels from Ghosts
        for (const [_, channel] of guild.channels.cache) {
          if (channel.parentId !== shadowCategory.id && channel.isTextBased() && 'permissionOverwrites' in channel) {
            await (channel as any).permissionOverwrites.create(ghostRole.id, { ViewChannel: false }).catch(() => {});
          }
        }
      }

      // 3. Create a unique sandbox channel for this user to make it look real
      const sandboxChannel = await guild.channels.create({
        name: `general-${Math.floor(Math.random() * 1000)}`, // Looks like a normal channel
        type: ChannelType.GuildText,
        parent: shadowCategory.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      }) as TextChannel;

      // 4. Strip roles and apply Ghost
      const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id).map(r => r.id);
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove, 'Avenlo Ultra Kernel: Exiled to Shadow Realm');
      }
      await member.roles.add(ghostRole.id, `Avenlo Ultra Kernel: ${reason}`);

      // 5. Deploy a Phantom Agent to the sandbox to keep the bot busy
      const { getPhantomAgentManager } = await import('../moderation/PhantomAgent');
      const phantomManager = getPhantomAgentManager();
      
      // Seed the phantom with fake organic chat to make the raider think they are attacking real users
      const seedContext = [
        "User1: Anyone want to play Valorant?",
        "User2: Yeah I'm down give me 5 mins",
        "User3: Did you guys see the new update?",
      ];
      
      await phantomManager.deployPhantom(sandboxChannel, seedContext);

      logger.warn(`👻 EXILED ${member.user.tag} to Ghost Sandbox in ${guild.name}. Reason: ${reason}`);

    } catch (err) {
      logger.error(`Failed to exile ${member.user.tag}:`, err);
      // Fallback: Just ban them if the sandbox fails
      if (member.bannable) {
        await member.ban({ reason: `Ultra Kernel Sandbox Failure Fallback: ${reason}` });
      }
    }
  }
}
