/**
 * 실시간 위치 보간 테스트
 * TMAP Route 구간별 정보를 활용한 차량 위치 추적
 */

const { VehicleStateManager, VehicleState } = require('../services/vehicleStateManager');
const fs = require('fs');
const path = require('path');

async function testRealtimePositionUpdate() {
  console.log('=== 실시간 위치 보간 테스트 시작 ===\n');
  
  // 1. VehicleStateManager 초기화
  const projectPath = path.join(__dirname, '../projects/default');
  const stateManager = new VehicleStateManager(projectPath);
  
  // 2. 차량 등록
  const vehicle = {
    id: 'vehicle_1',
    name: 'Vehicle_1',
    current_lng: 126.9780,
    current_lat: 37.5665,
    job_type: 'call',
    capacity: 4
  };
  
  stateManager.registerVehicle(vehicle);
  console.log(`✅ 차량 등록: ${vehicle.name}\n`);
  
  // 3. Mock TMAP Route 데이터 (실제 TMAP API 응답 형식)
  const mockRoute = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [126.9780, 37.5665],  // 시작점
            [126.9800, 37.5670],  // 중간점 1
            [126.9820, 37.5680]   // 중간점 2
          ]
        },
        properties: {
          index: 0,
          name: "구간1",
          description: "첫 번째 구간",
          distance: 200,
          time: 60,  // 60초
          totalTime: 180,
          totalDistance: 600
        }
      },
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [126.9820, 37.5680],  // 시작점
            [126.9840, 37.5690]   // 끝점
          ]
        },
        properties: {
          index: 1,
          name: "구간2",
          description: "두 번째 구간",
          distance: 200,
          time: 60,  // 60초
          totalTime: 180,
          totalDistance: 600
        }
      },
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [126.9840, 37.5690],  // 시작점
            [126.9860, 37.5700],  // 중간점
            [126.9880, 37.5710]   // 최종 목적지
          ]
        },
        properties: {
          index: 2,
          name: "구간3",
          description: "세 번째 구간",
          distance: 200,
          time: 60,  // 60초
          totalTime: 180,
          totalDistance: 600
        }
      }
    ]
  };
  
  // 4. Mock Demand
  const demand = {
    id: 'demand_001',
    longitude: 126.9880,
    latitude: 37.5710,
    job_type: 'call'
  };
  
  // 5. 배차 실행
  console.log('📦 배차 실행...\n');
  stateManager.assignDemand('vehicle_1', demand, mockRoute);
  
  const v = stateManager.getVehicle('vehicle_1');
  console.log(`\n🚗 초기 상태:`);
  console.log(`   위치: [${v.current_lng.toFixed(4)}, ${v.current_lat.toFixed(4)}]`);
  console.log(`   상태: ${v.state}`);
  console.log(`   예상 도착: ${v.estimated_arrival}초\n`);
  
  // 6. 시뮬레이션 시간 흐름에 따른 위치 추적
  console.log('⏱️  시뮬레이션 시작 (10초 단위 위치 추적)\n');
  console.log('시간(초) | 위치 (경도, 위도)           | 상태      | 구간');
  console.log('-'.repeat(70));
  
  const positionLog = [];
  
  for (let time = 0; time <= 200; time += 10) {
    stateManager.updateSimulationTime(time);
    
    const currentVehicle = stateManager.getVehicle('vehicle_1');
    const lng = currentVehicle.current_lng.toFixed(6);
    const lat = currentVehicle.current_lat.toFixed(6);
    const state = currentVehicle.state.padEnd(10);
    
    // 어느 구간인지 표시
    let segmentInfo = '';
    if (time <= 60) {
      segmentInfo = '구간1';
    } else if (time <= 120) {
      segmentInfo = '구간2';
    } else if (time <= 180) {
      segmentInfo = '구간3';
    } else {
      segmentInfo = '도착';
    }
    
    console.log(`${time.toString().padStart(7)} | [${lng}, ${lat}] | ${state} | ${segmentInfo}`);
    
    positionLog.push({
      time: time,
      lng: parseFloat(lng),
      lat: parseFloat(lat),
      state: currentVehicle.state,
      segment: segmentInfo
    });
  }
  
  // 7. 결과 요약
  console.log('\n' + '='.repeat(70));
  console.log('📊 결과 요약\n');
  
  const finalVehicle = stateManager.getVehicle('vehicle_1');
  console.log(`최종 위치: [${finalVehicle.current_lng.toFixed(6)}, ${finalVehicle.current_lat.toFixed(6)}]`);
  console.log(`최종 상태: ${finalVehicle.state}`);
  console.log(`목표 위치: [${demand.longitude}, ${demand.latitude}]`);
  console.log(`완료 작업: ${finalVehicle.total_jobs}건\n`);
  
  // 8. GeoJSON으로 경로 및 위치 이력 저장
  const geoJsonOutput = {
    type: "FeatureCollection",
    features: [
      // 경로 선
      ...mockRoute.features,
      // 위치 이력 (포인트)
      ...positionLog.map((log, index) => ({
        type: "Feature",
        properties: {
          type: "vehicle_position",
          time: log.time,
          state: log.state,
          segment: log.segment,
          index: index
        },
        geometry: {
          type: "Point",
          coordinates: [log.lng, log.lat]
        }
      }))
    ]
  };
  
  const outputPath = path.join(__dirname, 'realtime_position_track.json');
  fs.writeFileSync(outputPath, JSON.stringify(geoJsonOutput, null, 2));
  console.log(`💾 위치 추적 결과 저장: ${outputPath}`);
  console.log('   👉 http://geojson.io 에서 시각화 가능\n');
  
  // 9. 통계
  console.log('📈 이동 통계:');
  const movingPositions = positionLog.filter(p => p.state === 'moving');
  const workingPositions = positionLog.filter(p => p.state === 'working');
  const idlePositions = positionLog.filter(p => p.state === 'idle');
  
  console.log(`   - 이동 중: ${movingPositions.length}개 시점`);
  console.log(`   - 작업 중: ${workingPositions.length}개 시점`);
  console.log(`   - 대기 중: ${idlePositions.length}개 시점`);
  
  console.log('\n=== 테스트 완료 ===');
}

// 테스트 실행
if (require.main === module) {
  testRealtimePositionUpdate().catch(error => {
    console.error('테스트 중 에러 발생:', error);
    process.exit(1);
  });
}

module.exports = { testRealtimePositionUpdate };
