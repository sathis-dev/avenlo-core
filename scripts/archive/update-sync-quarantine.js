const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let content = fs.readFileSync(path, 'utf-8');

const oldBlock = `  const verificationChannel = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase().includes(config.verificationChannelName.toLowerCase())
  ) as TextChannel | undefined;`;

const newBlock = `  let verificationChannel: TextChannel | undefined = undefined;
  if (config.verificationChannelId) {
    const byId = guild.channels.cache.get(config.verificationChannelId);
    if (byId?.type === ChannelType.GuildText) {
      verificationChannel = byId as TextChannel;
    }
  }
  if (!verificationChannel) {
    verificationChannel = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name.toLowerCase().includes(config.verificationChannelName.toLowerCase())
    ) as TextChannel | undefined;
  }`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Updated syncQuarantinePermissions to support channel ID');
} else {
  console.log('Could not find block to replace');
}
