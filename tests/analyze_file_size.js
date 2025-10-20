const fs = require('fs');
const data = JSON.parse(fs.readFileSync('projects/sample-project-1/simulation_result.json', 'utf8'));

const sizes = {
  vehicles: JSON.stringify(data.vehicles).length,
  demands: JSON.stringify(data.demands).length,
  routes: JSON.stringify(data.routes).length,
  events: JSON.stringify(data.events).length,
  metadata: JSON.stringify(data.metadata).length
};

console.log('Data size breakdown:');
Object.entries(sizes).forEach(([k, v]) => {
  console.log(`  ${k}: ${(v / 1024).toFixed(2)} KB`);
});

console.log(`\nTotal: ${(JSON.stringify(data).length / 1024).toFixed(2)} KB`);
console.log(`File size: ${(fs.statSync('projects/sample-project-1/simulation_result.json').size / 1024).toFixed(2)} KB`);
