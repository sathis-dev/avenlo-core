// ====================================
// AVENLO CORE - EVENT LOADER
// ====================================

import { Client, Events, GuildMember, Role } from 'discord.js';
import { createLogger, getRedisClient, EventTypes } from '@avenlo/shared';
import { ticketController } from '../controllers/TicketController';

const logger = createLogger('gateway-events');

export async function loadEvents(client: Client): Promise<void> {
  const redis = getRedisClient();

  // ====================================
  // DISCORD EVENTS
  // ====================================

  // Verified Client Role Assignment - White-Glove Onboarding
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const verifiedClientRoleId = process.env.ROLE_VERIFIED_CLIENT;
    if (!verifiedClientRoleId) return;

    const hadRole = oldMember.roles.cache.has(verifiedClientRoleId);
    const hasRole = newMember.roles.cache.has(verifiedClientRoleId);

    // Role was just added
    if (!hadRole && hasRole) {
      logger.info(`Verified Client role assigned to ${newMember.user.tag}`);
      await ticketController.onVerifiedClientJoin(newMember);
    }
  });

  // ====================================
  // REDIS EVENT BUS SUBSCRIPTIONS
  // ====================================

  // Subscribe to Architect events
  await redis.subscribe(EventTypes.ARCHITECT_BRIEF_GENERATED, async (event) => {
    logger.info('Brief generated event received:', event.payload);
    // Handle sending the brief to the client
  });

  // Subscribe to Pulse events
  await redis.subscribe(EventTypes.PULSE_DASHBOARD_UPDATE, async (event) => {
    logger.info('Dashboard update event received:', event.payload);
    // Handle updating the dashboard embed
  });

  // Subscribe to Ledger events
  await redis.subscribe(EventTypes.LEDGER_CREDIT_EARNED, async (event) => {
    logger.info('Credit earned event received:', event.payload);
    // Handle notifying the user
  });

  await redis.subscribe(EventTypes.LEDGER_ROLE_UPDATE, async (event) => {
    logger.info('Role update event received:', event.payload);
    // Handle role changes
  });

  // Subscribe to system events
  await redis.subscribe(EventTypes.SYSTEM_ERROR, async (event) => {
    logger.error('System error event received:', event.payload);
    // Handle error notifications
  });

  logger.info('Event subscriptions established');
}
