const fs = require('fs');

// 1. Add memberRoleName to PROTECTION_CONFIG.quarantine in ServerProtection.ts
const spPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let spContent = fs.readFileSync(spPath, 'utf-8');

const oldQ = `  quarantine: {
    enabled: true,
    quarantineRoleName: 'Quarantine',
    verifiedRoleName: 'Verified',
    verificationChannelName: '🔒・verification',
    verificationChannelId: '1511101077184053388',
  },`;

const newQ = `  quarantine: {
    enabled: true,
    quarantineRoleName: 'Quarantine',
    verifiedRoleName: 'Verified',
    memberRoleName: 'Member',
    verificationChannelName: '🔒・verification',
    verificationChannelId: '1511101077184053388',
  },`;

if (spContent.includes(oldQ)) {
  spContent = spContent.replace(oldQ, newQ);
  fs.writeFileSync(spPath, spContent, 'utf-8');
  console.log('Updated PROTECTION_CONFIG.quarantine');
} else {
  console.log('WARNING: Could not find exact quarantine block in ServerProtection.ts');
}

// 2. Update grantVerifiedAccess in VerificationHandler.ts to also grant Member role
const vhPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/VerificationHandler.ts';
let vhContent = fs.readFileSync(vhPath, 'utf-8');

const oldGrant = `  // Add Verified role
  const verifiedRole = guild.roles.cache.find(
    (r) => r.name === config.verifiedRoleName
  );
  if (verifiedRole) {
    try {
      await member.roles.add(verifiedRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to add Verified role:', err);
    }
  }`;

const newGrant = `  // Add Verified role
  const verifiedRole = guild.roles.cache.find(
    (r) => r.name === config.verifiedRoleName
  );
  if (verifiedRole) {
    try {
      await member.roles.add(verifiedRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to add Verified role:', err);
    }
  }

  // Add Member role
  const memberRole = guild.roles.cache.find(
    (r) => r.name === config.memberRoleName
  );
  if (memberRole) {
    try {
      await member.roles.add(memberRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to add Member role:', err);
    }
  }`;

if (vhContent.includes(oldGrant)) {
  vhContent = vhContent.replace(oldGrant, newGrant);
  fs.writeFileSync(vhPath, vhContent, 'utf-8');
  console.log('Updated grantVerifiedAccess to add Member role');
} else {
  console.log('WARNING: Could not find exact grantVerifiedAccess block in VerificationHandler.ts');
}
