const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const startIdx = lines.findIndex(l => l.includes('const verificationChannel = guild.channels.cache.find'));
if (startIdx === -1) {
  console.log('Could not find verificationChannel declaration');
  process.exit(1);
}

// Find end of that statement
let endIdx = startIdx;
for (let i = startIdx; i < lines.length && i < startIdx + 10; i++) {
  if (lines[i].includes(') as TextChannel | undefined;')) {
    endIdx = i;
    break;
  }
}

const newBlock = [
  "  let verificationChannel: TextChannel | undefined = undefined;",
  "  if (config.verificationChannelId) {",
  "    const byId = guild.channels.cache.get(config.verificationChannelId);",
  "    if (byId?.type === ChannelType.GuildText) {",
  "      verificationChannel = byId as TextChannel;",
  "    }",
  "  }",
  "  if (!verificationChannel) {",
  "    verificationChannel = guild.channels.cache.find(",
  "      (ch) =>",
  "        ch.type === ChannelType.GuildText &&",
  "        ch.name.toLowerCase().includes(config.verificationChannelName.toLowerCase())",
  "    ) as TextChannel | undefined;",
  "  }",
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Updated syncQuarantinePermissions');
