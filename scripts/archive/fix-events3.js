const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find all lines that contain "// VERIFICATION EVENTS"
const indices = [];
lines.forEach((l, i) => {
  if (l.includes('// VERIFICATION EVENTS')) indices.push(i);
});

console.log('Found VERIFICATION EVENTS at lines:', indices.map(i => i+1));

if (indices.length >= 2) {
  const second = indices[1];
  // Find end: line with "// WELCOME EVENTS" after second block
  let end = second;
  for (let i = second; i < lines.length && i < second + 20; i++) {
    if (lines[i].includes('// WELCOME EVENTS')) {
      end = i - 1; // remove blank line before welcome events too
      break;
    }
  }
  console.log('Removing lines', second+1, 'to', end+1);
  lines.splice(second, end - second + 1);
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Done');
}
