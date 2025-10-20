/**
 * Test report generator with updated simulation data
 */

const fs = require('fs').promises;
const path = require('path');

async function testReportData() {
  console.log('🧪 Testing Report Data Generation...\n');
  
  const resultPath = path.join(__dirname, '..', 'projects', 'sample-project-1', 'simulation_result.json');
  
  try {
    const content = await fs.readFile(resultPath, 'utf-8');
    const data = JSON.parse(content);
    
    console.log('📊 Report Data Check:');
    console.log('─────────────────────────────────────');
    
    // Check vehicles
    if (data.vehicles && data.vehicles.length > 0) {
      data.vehicles.forEach(vehicle => {
        console.log(`\n${vehicle.name}:`);
        console.log(`  ID: ${vehicle.id}`);
        console.log(`  Total Jobs: ${vehicle.statistics.total_jobs}`);
        console.log(`  Total Distance: ${vehicle.statistics.total_distance} km`);
        console.log(`  Moving Time: ${vehicle.statistics.moving_time} sec (${(vehicle.statistics.moving_time / 60).toFixed(1)} min)`);
        console.log(`  Working Time: ${vehicle.statistics.working_time} sec`);
        console.log(`  Idle Time: ${vehicle.statistics.idle_time} sec`);
        
        // Calculate utilization
        const totalDuration = data.metadata.totalDurationSeconds;
        const utilization = totalDuration > 0 
          ? ((vehicle.statistics.moving_time + vehicle.statistics.working_time) / totalDuration * 100)
          : 0;
        console.log(`  Utilization: ${utilization.toFixed(1)}%`);
        
        // Calculate avg distance per job
        const avgDistancePerJob = vehicle.statistics.total_jobs > 0
          ? (vehicle.statistics.total_distance / vehicle.statistics.total_jobs)
          : 0;
        console.log(`  Avg Distance/Job: ${avgDistancePerJob.toFixed(2)} km`);
        
        // Validation
        if (vehicle.statistics.total_jobs > 0 && vehicle.statistics.total_distance === 0) {
          console.log(`  ❌ ERROR: Jobs completed but distance is 0!`);
        } else if (vehicle.statistics.total_distance > 0) {
          console.log(`  ✅ All metrics available for report`);
        }
      });
      
      // Summary for report
      console.log('\n\n📈 Summary Statistics (for Report Cards):');
      console.log('─────────────────────────────────────');
      const totalVehicles = data.vehicles.length;
      const totalJobs = data.vehicles.reduce((sum, v) => sum + (v.statistics.total_jobs || 0), 0);
      const totalDistance = data.vehicles.reduce((sum, v) => sum + (v.statistics.total_distance || 0), 0);
      const totalMovingTime = data.vehicles.reduce((sum, v) => sum + (v.statistics.moving_time || 0), 0);
      
      console.log(`  Total Vehicles: ${totalVehicles}`);
      console.log(`  Total Jobs: ${totalJobs}`);
      console.log(`  Total Distance: ${totalDistance.toFixed(2)} km`);
      console.log(`  Total Moving Time: ${(totalMovingTime / 60).toFixed(1)} min`);
      
      if (totalJobs > 0 && totalDistance > 0) {
        console.log('\n✅ TEST PASSED: All data ready for report generation!');
      } else {
        console.log('\n❌ TEST FAILED: Missing data for report!');
      }
      
    } else {
      console.log('❌ No vehicles found in simulation result');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testReportData();
