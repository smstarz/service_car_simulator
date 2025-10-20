/**
 * Route Interpolation Test
 * 경로 보간 로직을 테스트합니다
 */

const fs = require('fs');
const path = require('path');

// Load simulation result
const resultPath = path.join(__dirname, '../projects/sample-project-1/simulation_result.json');
const simulationData = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

console.log('=== Route Interpolation Test ===\n');

// Get first route
const route = simulationData.routes[0];
console.log(`Testing route: ${route.id}`);
console.log(`Vehicle: ${route.vehicleId}`);
console.log(`Time range: ${route.startTime} - ${route.endTime} (${route.duration}s)`);
console.log(`Features count: ${route.features.length}\n`);

// Simulate buildRouteSegmentsFromFeatures
function buildRouteSegmentsFromFeatures(features, startTime) {
  const segments = [];
  let cumulativeTime = 0;
  
  features.forEach((feature, index) => {
    if (!feature.geometry || !feature.geometry.coordinates) {
      return;
    }
    
    // Skip Point features - only process LineString segments
    if (feature.geometry.type !== 'LineString') {
      console.log(`  Skipping ${feature.geometry.type} at index ${index}`);
      return;
    }
    
    const coords = feature.geometry.coordinates;
    const segmentTime = feature.properties.time || 0;
    const segmentDistance = feature.properties.distance || 0;
    
    if (coords.length === 0 || segmentTime === 0) {
      console.log(`  Skipping segment ${index}: zero time or empty coords`);
      return;
    }
    
    segments.push({
      index: index,
      name: feature.properties.name || `Segment ${index + 1}`,
      startTime: startTime + cumulativeTime,
      endTime: startTime + cumulativeTime + segmentTime,
      duration: segmentTime,
      distance: segmentDistance,
      coordinates: coords
    });
    
    cumulativeTime += segmentTime;
  });
  
  return segments;
}

// Simulate findPositionOnRoute
function findPositionOnRoute(segments, currentTime) {
  if (segments.length === 0) {
    return null;
  }
  
  for (const segment of segments) {
    if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
      if (segment.duration === 0) {
        const coords = segment.coordinates;
        return coords[coords.length - 1];
      }
      
      const segmentProgress = (currentTime - segment.startTime) / segment.duration;
      
      // Return first and last point for simplicity
      const coords = segment.coordinates;
      if (coords.length === 2) {
        return [
          coords[0][0] + (coords[1][0] - coords[0][0]) * segmentProgress,
          coords[0][1] + (coords[1][1] - coords[0][1]) * segmentProgress
        ];
      }
      
      return coords[Math.floor(coords.length * segmentProgress)];
    }
  }
  
  const lastSegment = segments[segments.length - 1];
  const lastCoords = lastSegment.coordinates;
  return lastCoords[lastCoords.length - 1];
}

// Build segments
console.log('Building segments...');
const segments = buildRouteSegmentsFromFeatures(route.features, route.startTime);

console.log(`\nBuilt ${segments.length} segments:`);
segments.forEach((seg, idx) => {
  console.log(`  ${idx + 1}. Time: ${seg.startTime}-${seg.endTime} (${seg.duration}s), ` +
              `Coords: ${seg.coordinates.length}, Distance: ${seg.distance}m`);
});

// Test interpolation at different times
console.log('\n=== Testing Interpolation ===');
const testTimes = [
  route.startTime,
  route.startTime + 10,
  route.startTime + 50,
  route.startTime + 100,
  route.startTime + 150,
  route.endTime
];

testTimes.forEach(time => {
  const position = findPositionOnRoute(segments, time);
  const elapsed = time - route.startTime;
  const progress = ((elapsed / route.duration) * 100).toFixed(1);
  
  console.log(`Time ${time} (+${elapsed}s, ${progress}%): `, 
              position ? `[${position[0].toFixed(6)}, ${position[1].toFixed(6)}]` : 'null');
});

// Get position updates from vehicle timeline
console.log('\n=== Vehicle Timeline Position Updates ===');
const vehicle = simulationData.vehicles.find(v => v.id === route.vehicleId);
const positionUpdates = vehicle.timeline.filter(e => 
  e.type === 'position_updated' && 
  e.timestamp >= route.startTime && 
  e.timestamp <= route.endTime
);

console.log(`Found ${positionUpdates.length} position updates between ${route.startTime}-${route.endTime}`);
positionUpdates.slice(0, 10).forEach(update => {
  const elapsed = update.timestamp - route.startTime;
  const progress = ((elapsed / route.duration) * 100).toFixed(1);
  console.log(`  ${update.timestamp} (+${elapsed}s, ${progress}%): [${update.location[0]}, ${update.location[1]}]`);
});

console.log('\n=== Test Complete ===');
