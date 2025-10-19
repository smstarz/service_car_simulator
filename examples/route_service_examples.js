/**
 * TMAP Route Service 사용 예시
 * 시뮬레이션에서 실제로 사용할 수 있는 코드 예시들
 */

const tmapRouteService = require('./services/tmapRouteService');

// ========================================
// 예시 1: 차량 배차 시 경로 탐색
// ========================================
async function example1_dispatchVehicle() {
  console.log('📍 예시 1: 차량 배차 시 경로 탐색\n');
  
  // 차량 정보
  const vehicle = {
    id: 'vehicle_001',
    currentLng: 126.9784,  // 서울시청
    currentLat: 37.5665
  };
  
  // 수요 정보
  const demand = {
    id: 'm5UdEg',
    pickup_lng: 127.0276,  // 강남역
    pickup_lat: 37.4979,
    request_time: '09:30:00'
  };
  
  try {
    // 경로 탐색
    const routeData = await tmapRouteService.getCarRoute({
      startPoint: [vehicle.currentLng, vehicle.currentLat],
      endPoint: [demand.pickup_lng, demand.pickup_lat],
      departureTime: demand.request_time
    });
    
    console.log(`✅ 차량 ${vehicle.id} → Demand ${demand.id}`);
    console.log(`   거리: ${routeData.summary.totalDistanceKm} km`);
    console.log(`   시간: ${routeData.summary.totalTimeMinutes} 분`);
    console.log(`   경로 좌표 수: ${routeData.coordinates.length}`);
    
    // 차량 상태 업데이트
    vehicle.status = 'en_route_to_pickup';
    vehicle.targetDemand = demand.id;
    vehicle.route = routeData.route;
    vehicle.arrivalTime = routeData.summary.totalTime; // 초 단위
    
    return { vehicle, routeData };
    
  } catch (error) {
    console.error('❌ 경로 탐색 실패:', error.message);
    return null;
  }
}

// ========================================
// 예시 2: 가장 가까운 차량 찾기
// ========================================
async function example2_findNearestVehicle() {
  console.log('\n📍 예시 2: 가장 가까운 차량 찾기\n');
  
  // 여러 차량
  const vehicles = [
    { id: 'vehicle_001', lng: 126.9784, lat: 37.5665, status: 'idle' }, // 서울시청
    { id: 'vehicle_002', lng: 127.0000, lat: 37.5000, status: 'idle' }, // 강남 인근
    { id: 'vehicle_003', lng: 126.9238, lat: 37.5563, status: 'idle' }  // 홍대
  ];
  
  // 수요 위치
  const demand = {
    id: 'demand_001',
    pickup_lng: 127.0276,  // 강남역
    pickup_lat: 37.4979
  };
  
  const departureTime = '09:30:00';
  
  // 유휴 차량만 필터링
  const availableVehicles = vehicles.filter(v => v.status === 'idle');
  
  // 모든 차량에서 demand까지의 경로 탐색
  const routeRequests = availableVehicles.map(vehicle => ({
    vehicleId: vehicle.id,
    startPoint: [vehicle.lng, vehicle.lat],
    endPoint: [demand.pickup_lng, demand.pickup_lat],
    departureTime: departureTime
  }));
  
  try {
    const routes = await tmapRouteService.getMultipleRoutes(routeRequests);
    
    // 가장 빠른 차량 찾기
    let bestVehicle = null;
    let minTime = Infinity;
    let bestRoute = null;
    
    routes.forEach((route, index) => {
      if (route && route.summary.totalTime < minTime) {
        minTime = route.summary.totalTime;
        bestVehicle = availableVehicles[index];
        bestRoute = route;
      }
    });
    
    if (bestVehicle) {
      console.log(`✅ 가장 가까운 차량: ${bestVehicle.id}`);
      console.log(`   도착 시간: ${(minTime / 60).toFixed(1)} 분`);
      console.log(`   거리: ${bestRoute.summary.totalDistanceKm} km`);
      
      // 다른 차량들과의 비교
      console.log('\n📊 다른 차량들:');
      routes.forEach((route, index) => {
        if (route) {
          const vehicle = availableVehicles[index];
          console.log(`   - ${vehicle.id}: ${route.summary.totalTimeMinutes} 분 (${route.summary.totalDistanceKm} km)`);
        }
      });
      
      return { vehicle: bestVehicle, route: bestRoute };
    } else {
      console.log('❌ 사용 가능한 차량 없음');
      return null;
    }
    
  } catch (error) {
    console.error('❌ 경로 탐색 실패:', error.message);
    return null;
  }
}

// ========================================
// 예시 3: Timestamp 이벤트 생성
// ========================================
async function example3_generateTimestampEvents() {
  console.log('\n📅 예시 3: Timestamp 이벤트 생성\n');
  
  const startPoint = [126.9784, 37.5665];  // 서울시청
  const endPoint = [127.0276, 37.4979];    // 강남역
  const departureTime = '09:30:00';
  const startTimestamp = 34200; // 09:30:00 = 34200초
  
  try {
    // 경로 탐색
    const routeData = await tmapRouteService.getCarRoute({
      startPoint,
      endPoint,
      departureTime
    });
    
    // timestamp 이벤트 생성
    const events = tmapRouteService.generateTimestampEvents(routeData, startTimestamp);
    
    console.log(`✅ 총 ${events.length}개 이벤트 생성`);
    console.log('\n🕒 이벤트 타임라인:');
    
    events.forEach((event, index) => {
      const timeStr = formatTimestamp(event.timestamp);
      
      if (event.type === 'route_start') {
        console.log(`   [${timeStr}] 🚗 출발`);
        console.log(`      위치: [${event.location[0].toFixed(4)}, ${event.location[1].toFixed(4)}]`);
      } else if (event.type === 'route_segment') {
        if (index < 5 || index === events.length - 2) { // 처음 5개와 마지막 구간만 출력
          console.log(`   [${timeStr}] 📍 ${event.segmentName}`);
          console.log(`      이동: ${event.distanceTraveled}m (${event.timeTaken}초)`);
        } else if (index === 5) {
          console.log(`   ... (${events.length - 7}개 구간 생략)`);
        }
      } else if (event.type === 'route_end') {
        console.log(`   [${timeStr}] 🏁 도착`);
        console.log(`      총 거리: ${event.totalDistance}m`);
        console.log(`      총 시간: ${event.totalTime}초`);
      }
    });
    
    return events;
    
  } catch (error) {
    console.error('❌ 이벤트 생성 실패:', error.message);
    return null;
  }
}

// ========================================
// 예시 4: 시뮬레이션 결과 생성
// ========================================
async function example4_createSimulationResult() {
  console.log('\n📊 예시 4: 시뮬레이션 결과 생성\n');
  
  const simulationResult = {
    metadata: {
      projectName: 'example-project',
      startTime: '09:00:00',
      endTime: '10:00:00',
      startTimeSeconds: 32400,
      endTimeSeconds: 36000,
      totalDuration: 3600,
      vehicleCount: 1,
      demandCount: 1,
      generatedAt: new Date().toISOString()
    },
    vehicles: [],
    routes: [],
    demands: []
  };
  
  // 차량과 수요
  const vehicle = { id: 'vehicle_001', lng: 126.9784, lat: 37.5665 };
  const demand = { id: 'demand_001', pickup_lng: 127.0276, pickup_lat: 37.4979 };
  const startTime = 32400; // 09:00:00
  
  try {
    // 1. 픽업 지점으로 이동
    console.log('1️⃣ 픽업 지점으로 이동 경로 생성...');
    const toPickupRoute = await tmapRouteService.getCarRoute({
      startPoint: [vehicle.lng, vehicle.lat],
      endPoint: [demand.pickup_lng, demand.pickup_lat],
      departureTime: '09:00:00'
    });
    
    const toPickupEvents = tmapRouteService.generateTimestampEvents(toPickupRoute, startTime);
    const pickupTime = startTime + toPickupRoute.summary.totalTime;
    
    console.log(`   ✅ 픽업 도착 시간: ${formatTimestamp(pickupTime)}`);
    
    // 2. 목적지로 이동
    console.log('\n2️⃣ 목적지로 이동 경로 생성...');
    const destination = { lng: 127.1000, lat: 37.5133 }; // 잠실
    
    const toDestRoute = await tmapRouteService.getCarRoute({
      startPoint: [demand.pickup_lng, demand.pickup_lat],
      endPoint: [destination.lng, destination.lat],
      departureTime: formatTimestamp(pickupTime)
    });
    
    const toDestEvents = tmapRouteService.generateTimestampEvents(toDestRoute, pickupTime + 60); // 승차에 60초
    const dropoffTime = pickupTime + 60 + toDestRoute.summary.totalTime;
    
    console.log(`   ✅ 하차 시간: ${formatTimestamp(dropoffTime)}`);
    
    // 3. 시뮬레이션 결과 구성
    simulationResult.vehicles.push({
      id: vehicle.id,
      initialLocation: [vehicle.lng, vehicle.lat],
      capacity: 4,
      events: [
        { timestamp: startTime, type: 'idle', location: [vehicle.lng, vehicle.lat], status: 'waiting' },
        { timestamp: startTime, type: 'dispatch', location: [vehicle.lng, vehicle.lat], demandId: demand.id, routeId: 'route_001' },
        ...toPickupEvents.slice(1, -1), // 중간 이벤트들
        { timestamp: pickupTime, type: 'pickup', location: [demand.pickup_lng, demand.pickup_lat], demandId: demand.id, passengers: 1 },
        { timestamp: pickupTime + 60, type: 'depart_to_destination', location: [demand.pickup_lng, demand.pickup_lat], routeId: 'route_002' },
        ...toDestEvents.slice(1, -1),
        { timestamp: dropoffTime, type: 'dropoff', location: [destination.lng, destination.lat], demandId: demand.id, passengers: 0 }
      ]
    });
    
    simulationResult.routes.push(
      {
        id: 'route_001',
        vehicleId: vehicle.id,
        demandId: demand.id,
        type: 'to_pickup',
        startTime: startTime,
        endTime: pickupTime,
        duration: toPickupRoute.summary.totalTime,
        distance: toPickupRoute.summary.totalDistance,
        path: toPickupRoute.coordinates,
        segments: toPickupRoute.segments
      },
      {
        id: 'route_002',
        vehicleId: vehicle.id,
        demandId: demand.id,
        type: 'to_destination',
        startTime: pickupTime + 60,
        endTime: dropoffTime,
        duration: toDestRoute.summary.totalTime,
        distance: toDestRoute.summary.totalDistance,
        path: toDestRoute.coordinates,
        segments: toDestRoute.segments
      }
    );
    
    console.log('\n✅ 시뮬레이션 결과 생성 완료');
    console.log(`   총 이벤트 수: ${simulationResult.vehicles[0].events.length}`);
    console.log(`   총 경로 수: ${simulationResult.routes.length}`);
    console.log(`   총 소요 시간: ${((dropoffTime - startTime) / 60).toFixed(1)} 분`);
    
    // 결과 출력 (일부만)
    console.log('\n📄 결과 샘플 (JSON):');
    console.log(JSON.stringify({
      metadata: simulationResult.metadata,
      vehicleCount: simulationResult.vehicles.length,
      routeCount: simulationResult.routes.length,
      firstRoute: simulationResult.routes[0]
    }, null, 2));
    
    return simulationResult;
    
  } catch (error) {
    console.error('❌ 시뮬레이션 결과 생성 실패:', error.message);
    return null;
  }
}

// ========================================
// 유틸리티 함수
// ========================================
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ========================================
// 메인 실행
// ========================================
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          TMAP Route Service 사용 예시                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // 환경 변수 확인
  require('dotenv').config();
  if (!process.env.TMAP_API_KEY) {
    console.error('❌ TMAP_API_KEY가 설정되지 않았습니다!');
    console.log('   .env 파일에 TMAP_API_KEY를 추가하세요.\n');
    return;
  }
  
  try {
    // 예시 1: 차량 배차
    await example1_dispatchVehicle();
    
    // 예시 2: 가장 가까운 차량 찾기
    await example2_findNearestVehicle();
    
    // 예시 3: Timestamp 이벤트 생성
    await example3_generateTimestampEvents();
    
    // 예시 4: 시뮬레이션 결과 생성
    await example4_createSimulationResult();
    
    console.log('\n✅ 모든 예시 실행 완료!\n');
    
  } catch (error) {
    console.error('\n❌ 에러 발생:', error.message);
    console.error(error);
  }
}

// 스크립트로 직접 실행할 때만 main 실행
if (require.main === module) {
  main();
}

module.exports = {
  example1_dispatchVehicle,
  example2_findNearestVehicle,
  example3_generateTimestampEvents,
  example4_createSimulationResult
};
