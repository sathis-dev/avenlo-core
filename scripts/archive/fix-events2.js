const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find and remove duplicate VERIFICATION EVENTS block (lines 92-98, 0-indexed 91-97)
const start = lines.findIndex((l, i) => 
  i > 80 && l.includes('// VERIFICATION EVENTS') && lines[i+1].includes('VERIFICATION_STARTED')
);

if (start !== -1) {
  // Check if there's another one after
  const second = lines.findIndex((l, i) => 
    i > start + 5 && l.includes('// VERIFICATION EVENTS') && lines[i+1].includes('VERIFICATION_STARTED')
  );
  
  if (second !== -1) {
    // Find end of second block (blank line before WELCOME EVENTS)
    let end = second;
    for (let i = second; i < lines.length && i < second + 10; i++) {
      if (lines[i].includes('// WELCOME EVENTS')) {
        end = i - 1; // keep the blank line before
        break;
      }
    }
    // Remove from second block start to end (inclusive)
    lines.splice(second, end - second + 1);
    fs.writeFileSync(path, lines.join('\n'), 'utf-8');
    console.log('Removed duplicate VERIFICATION EVENTS block at lines', second, 'to', end);
  }
}
