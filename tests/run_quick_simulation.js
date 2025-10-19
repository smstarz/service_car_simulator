require('dotenv').config();
const path = require('path');
const SimulationEngine = require('../services/simulationEngine');

/**
 * Quick test with small project (30 minutes simulation)
 */
async function quickTest() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Quick Simulation Test (30 minutes)          ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  try {
    // Use test-simulation project
    const projectPath = path.join(__dirname, '../projects/test-simulation');
    
    console.log(`Project: ${projectPath}`);
    console.log('Duration: 30 minutes (07:00 ~ 07:30)');
    console.log('Vehicles: 3');
    console.log('Demands: 5\n');
    
    // Create simulation engine
    const engine = new SimulationEngine(projectPath);
    
    // Initialize
    await engine.initialize();
    
    // Run simulation
    await engine.run();
    
    // Generate result JSON
    await engine.generateResultJSON();
    
    console.log('\n✅ Quick test completed! Check projects/test-simulation/simulation_result.json');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run test
quickTest();
