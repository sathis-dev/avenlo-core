const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes('// For every text/voice channel except verification'));
if (idx === -1) {
  console.log('Could not find permission sync block');
  process.exit(1);
}

console.log('Found block at line', idx + 1);

// Replace lines 262-271 (0-indexed 261-270)
const newLines = [
  '    for (const channel of guild.channels.cache.values()) {',
  '      if (channel.id === verificationChannel.id) continue;',
  '      if (channel.isThread()) continue;',
  '      if (channel.type === ChannelType.GuildCategory) continue;',
  '',
  '      const guildChannel = channel as GuildChannel;',
  '      const existing = guildChannel.permissionOverwrites.cache.get(role.id);',
  '      if (existing?.deny.has(PermissionFlagsBits.ViewChannel)) continue;',
  '',
  '      await guildChannel.permissionOverwrites.create(role, {',
  '        ViewChannel: false,',
  '      });',
  '    }',
];

// Find the end of the for loop
let endIdx = idx + 1;
for (let i = idx + 1; i < lines.length && i < idx + 15; i++) {
  if (lines[i].trim() === '}') {
    endIdx = i;
    break;
  }
}

lines.splice(idx + 1, endIdx - idx, ...newLines);
fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Fixed ServerProtection.ts lines', idx + 1, 'to', endIdx + 1);
