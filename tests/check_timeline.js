const fs = require('fs');
const data = JSON.parse(fs.readFileSync('projects/sample-project-1/simulation_result.json', 'utf8'));
const v = data.vehicles[0];

console.log('Timeline events:');
v.timeline.slice(0, 20).forEach(e => {
  const loc = e.location ? `[${e.location[0].toFixed(6)}, ${e.location[1].toFixed(6)}]` : 'N/A';
  console.log(`  ${e.timestamp}: ${e.type} (${e.state}) at ${loc}`);
});

console.log(`\nTotal events: ${v.timeline.length}`);
console.log(`Position updates: ${v.timeline.filter(e => e.type === 'position_updated').length}`);
