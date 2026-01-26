// ====================================
// AVENLO CORE - COMMAND LOADER
// ====================================

import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createLogger } from '@avenlo/shared';

// Import all commands
import { projectCommand } from './project';
import { vaultCommand } from './vault';
import { dashboardCommand } from './dashboard';
import { leaderboardCommand } from './leaderboard';
import { profileCommand } from './profile';
import { helpCommand } from './help';
import { adminCommand } from './admin';
import { ticketCommand } from './ticket';
import { modCommand } from './mod';
import { rulesCommand } from './rules';
import { sovereignCommand } from './sovereign';
import { lockdownCommand, sieveCommand, policyCommand } from './strategic';
import { thermalCommand, shadowCommand, forensicCommand, interceptCommand } from './tactical';

const logger = createLogger('gateway-commands');

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands: Command[] = [
  projectCommand,
  vaultCommand,
  dashboardCommand,
  leaderboardCommand,
  profileCommand,
  helpCommand,
  adminCommand,
  ticketCommand,
  modCommand,
  rulesCommand,
  // Sovereign Suite
  sovereignCommand,
  lockdownCommand,
  sieveCommand,
  policyCommand,
  thermalCommand,
  shadowCommand,
  forensicCommand,
  interceptCommand,
];

export async function loadCommands(): Promise<Collection<string, Command>> {
  const collection = new Collection<string, Command>();

  for (const command of commands) {
    collection.set(command.data.name, command);
    logger.debug(`Loaded command: /${command.data.name}`);
  }

  return collection;
}
