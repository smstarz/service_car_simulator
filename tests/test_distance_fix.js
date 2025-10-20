/**
 * Test script to verify that distance is properly accumulated in vehicle statistics
 */

const SimulationEngine = require('../services/simulationEngine');
const path = require('path');

async function testDistanceFix() {
  console.log('🧪 Testing distance accumulation fix...\n');
  
  const projectPath = path.join(__dirname, '..', 'projects', 'sample-project-1');
  const engine = new SimulationEngine(projectPath);
  
  try {
    // Initialize and run simulation
    await engine.initialize();
    await engine.run();
    
    // Check results
    const vehicles = engine.vehicleStateManager.getAllVehicles();
    
    console.log('\n📊 Vehicle Statistics Check:');
    console.log('─────────────────────────────────────');
    
    vehicles.forEach(vehicle => {
      console.log(`\n${vehicle.name}:`);
      console.log(`  Total Jobs: ${vehicle.statistics.total_jobs}`);
      console.log(`  Total Distance (statistics): ${vehicle.statistics.total_distance.toFixed(3)} km`);
      console.log(`  Total Distance (direct): ${vehicle.total_distance.toFixed(3)} km`);
      console.log(`  Moving Time: ${vehicle.statistics.moving_time} sec`);
      console.log(`  Working Time: ${vehicle.statistics.working_time} sec`);
      
      // Verify distance is not zero
      if (vehicle.statistics.total_jobs > 0 && vehicle.statistics.total_distance === 0) {
        console.log(`  ❌ ERROR: Distance is 0 but jobs completed!`);
      } else if (vehicle.statistics.total_distance > 0) {
        console.log(`  ✅ Distance properly accumulated`);
      }
    });
    
    // Check routes
    console.log('\n\n📍 Routes Distance Summary:');
    console.log('─────────────────────────────────────');
    let totalRouteDistance = 0;
    
    engine.routes.forEach(route => {
      const distanceKm = route.distance / 1000;
      totalRouteDistance += distanceKm;
      console.log(`  ${route.id}: ${distanceKm.toFixed(3)} km`);
    });
    
    console.log(`  Total from routes: ${totalRouteDistance.toFixed(3)} km`);
    
    const vehicleTotalDistance = vehicles.reduce((sum, v) => sum + v.statistics.total_distance, 0);
    console.log(`  Total from vehicles: ${vehicleTotalDistance.toFixed(3)} km`);
    
    if (Math.abs(totalRouteDistance - vehicleTotalDistance) < 0.001) {
      console.log('\n✅ TEST PASSED: Distance correctly accumulated!');
    } else {
      console.log('\n❌ TEST FAILED: Distance mismatch!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDistanceFix();
