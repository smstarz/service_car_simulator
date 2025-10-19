require('dotenv').config();
const path = require('path');
const SimulationEngine = require('../services/simulationEngine');

/**
 * Test: Run simulation and generate timestamp JSON
 */
async function testSimulation() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Simulation Engine Test                      ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  try {
    // Project path
    const projectPath = path.join(__dirname, '../projects/default');
    
    console.log(`Project: ${projectPath}\n`);
    
    // Create simulation engine
    const engine = new SimulationEngine(projectPath);
    
    // Initialize
    await engine.initialize();
    
    // Run simulation
    await engine.run();
    
    // Generate result JSON
    const result = await engine.generateResultJSON();
    
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   Simulation Result Preview                   ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    console.log('Metadata:');
    console.log(JSON.stringify(result.metadata, null, 2));
    
    console.log('\nVehicle Summary:');
    result.vehicles.forEach(v => {
      console.log(`  ${v.name}: ${v.statistics.total_jobs} jobs, ${v.timeline.length} events`);
    });
    
    console.log(`\nTotal Routes: ${result.routes.length}`);
    console.log(`Total Demands: ${result.demands.length}`);
    console.log(`Total Events: ${result.events.length}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run test
testSimulation();
