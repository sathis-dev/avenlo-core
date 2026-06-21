const fs = require('fs');

// 1. Fix ServerProtection.ts permission sync block
const spPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let spContent = fs.readFileSync(spPath, 'utf-8');

const oldSpBlock = `    // For every text/voice channel except verification, deny ViewChannel for Quarantine
    for (const channel of guild.channels.cache.values()) {
      if (channel.id === verificationChannel.id) continue;
      if (!channel.isTextBased() && channel.type !== ChannelType.GuildVoice) continue;

      const existing = channel.permissionOverwrites.cache.get(role.id);
      if (existing?.deny.has(PermissionFlagsBits.ViewChannel)) continue;

      await channel.permissionOverwrites.create(role, {
        ViewChannel: false,
      });
    }`;

const newSpBlock = `    // For every text/voice channel except verification, deny ViewChannel for Quarantine
    for (const channel of guild.channels.cache.values()) {
      if (channel.id === verificationChannel.id) continue;
      if (channel.isThread()) continue;
      if (channel.type === ChannelType.GuildCategory) continue;

      const guildChannel = channel as GuildChannel;
      const existing = guildChannel.permissionOverwrites.cache.get(role.id);
      if (existing?.deny.has(PermissionFlagsBits.ViewChannel)) continue;

      await guildChannel.permissionOverwrites.create(role, {
        ViewChannel: false,
      });
    }`;

if (spContent.includes(oldSpBlock)) {
  spContent = spContent.replace(oldSpBlock, newSpBlock);
  fs.writeFileSync(spPath, spContent, 'utf-8');
  console.log('Fixed ServerProtection.ts');
} else {
  console.log('WARNING: Could not find ServerProtection.ts block to replace');
}

// 2. Fix VerificationHandler.ts setSession casts
const vhPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/VerificationHandler.ts';
let vhContent = fs.readFileSync(vhPath, 'utf-8');

// Replace setSession calls to cast
vhContent = vhContent.replace(
  /await setSession\(member\.id, session\);/g,
  'await setSession(member.id, session as Record<string, unknown>);'
);

// Also fix the initial session set in handleBeginVerification where session is a plain object
vhContent = vhContent.replace(
  /await setSession\(member\.id, session\);/g,
  'await setSession(member.id, session as Record<string, unknown>);'
);

// Also fix the session creation in handleBeginVerification
const oldSessionSet = `  await setSession(member.id, session);`;
const newSessionSet = `  await setSession(member.id, session as Record<string, unknown>);`;
vhContent = vhContent.replaceAll(oldSessionSet, newSessionSet);

fs.writeFileSync(vhPath, vhContent, 'utf-8');
console.log('Fixed VerificationHandler.ts');

// 3. Verify client.ts modal routing
const clientPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/client.ts';
let clientContent = fs.readFileSync(clientPath, 'utf-8');
if (!clientContent.includes('handleVerificationCaptcha')) {
  console.log('WARNING: client.ts may not have handleVerificationCaptcha');
} else {
  console.log('client.ts looks OK');
}
