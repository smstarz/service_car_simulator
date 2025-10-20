/**
 * 배차 엔진 전체 프로세스 테스트
 * 수요 발생 -> Isochrone 생성 -> 폴리곤 내 차량 탐색 -> 배차
 */

const DispatchEngine = require('../services/dispatchEngine');
require('dotenv').config();

async function testFullDispatchProcess() {
  console.log('='.repeat(80));
  console.log('🧪 배차 엔진 전체 프로세스 테스트');
  console.log('='.repeat(80));
  
  const dispatchEngine = new DispatchEngine();
  
  // 테스트용 수요 (서울 시청)
  const testDemand = {
    call_id: 'DEMAND_001',
    origin_lng: 126.9780,
    origin_lat: 37.5665,
    job_type: 'general',
    call_datetime: '2025-10-19 09:00:00'
  };
  
  // 테스트용 차량들 (서울 시청 근처에 분포)
  const testVehicles = [
    {
      id: 'V001',
      name: '차량-001',
      current_lng: 126.9760,  // 시청 서쪽 (가까움)
      current_lat: 37.5665,
      job_type: 'general',
      state: 'idle',
      assigned_demand_id: null
    },
    {
      id: 'V002',
      name: '차량-002',
      current_lng: 126.9800,  // 시청 동쪽 (가까움)
      current_lat: 37.5665,
      job_type: 'general',
      state: 'idle',
      assigned_demand_id: null
    },
    {
      id: 'V003',
      name: '차량-003',
      current_lng: 126.9780,  // 시청 북쪽 (가까움)
      current_lat: 37.5700,
      job_type: 'general',
      state: 'idle',
      assigned_demand_id: null
    },
    {
      id: 'V004',
      name: '차량-004',
      current_lng: 126.9780,  // 시청 남쪽 (가까움)
      current_lat: 37.5630,
      job_type: 'general',
      state: 'idle',
      assigned_demand_id: null
    },
    {
      id: 'V005',
      name: '차량-005',
      current_lng: 127.0500,  // 강남 (멀리)
      current_lat: 37.5000,
      job_type: 'general',
      state: 'idle',
      assigned_demand_id: null
    },
    {
      id: 'V006',
      name: '차량-006',
      current_lng: 126.9780,  // 시청 (매우 가까움, 하지만 운행 중)
      current_lat: 37.5665,
      job_type: 'general',
      state: 'moving',  // 운행 중
      assigned_demand_id: 'OTHER_DEMAND'
    },
    {
      id: 'V007',
      name: '차량-007',
      current_lng: 126.9780,  // 시청 (매우 가까움, 하지만 job_type 불일치)
      current_lat: 37.5665,
      job_type: 'premium',  // job_type 불일치
      state: 'idle',
      assigned_demand_id: null
    }
  ];
  
  // 프로젝트 설정
  const projectConfig = {
    waitTimeLimit: 10  // 10분
  };
  
  console.log(`\n📋 테스트 시나리오:`);
  console.log(`   - 수요 위치: [${testDemand.origin_lng}, ${testDemand.origin_lat}] (서울 시청)`);
  console.log(`   - Job Type: ${testDemand.job_type}`);
  console.log(`   - Wait Time Limit: ${projectConfig.waitTimeLimit}분`);
  console.log(`   - 총 차량 수: ${testVehicles.length}대`);
  
  console.log(`\n📍 차량 목록:`);
  testVehicles.forEach((v, idx) => {
    const distance = dispatchEngine.calculateDistance(
      testDemand.origin_lng, testDemand.origin_lat,
      v.current_lng, v.current_lat
    );
    console.log(`   ${idx + 1}. ${v.name}:`);
    console.log(`      위치: [${v.current_lng}, ${v.current_lat}]`);
    console.log(`      거리: ${distance.toFixed(3)} km`);
    console.log(`      상태: ${v.state}`);
    console.log(`      Job Type: ${v.job_type}`);
    console.log(`      배차 상태: ${v.assigned_demand_id || 'None'}`);
  });
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🚀 배차 프로세스 시작');
  console.log('='.repeat(80));
  
  // onDemandOccurrence 메서드 호출
  const result = await dispatchEngine.onDemandOccurrence(
    testDemand,
    testVehicles,
    projectConfig
  );
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 배차 결과');
  console.log('='.repeat(80));
  
  if (result.success) {
    console.log('\n✅ 배차 프로세스 성공!');
    
    console.log(`\n📍 Isochrone 정보:`);
    console.log(`   - Wait Time Limit: ${result.waitTimeLimit}분`);
    console.log(`   - Contour: ${result.isochrone.properties.contour}분`);
    console.log(`   - 폴리곤 좌표 개수: ${result.isochrone.geometry.coordinates[0].length}`);
    
    console.log(`\n🚗 배차 정보:`);
    console.log(`   - 상태: ${result.dispatch.status}`);
    
    if (result.assignedVehicle) {
      console.log(`   - 배차 차량: ${result.assignedVehicle.name} (${result.assignedVehicle.id})`);
      console.log(`   - 차량 위치: [${result.assignedVehicle.current_lng}, ${result.assignedVehicle.current_lat}]`);
      console.log(`   - 거리: ${result.dispatch.distance.toFixed(3)} km`);
      
      // 배차된 차량이 폴리곤 내부에 있는지 재확인
      const vehiclePoint = [result.assignedVehicle.current_lng, result.assignedVehicle.current_lat];
      const polygonCoordinates = result.isochrone.geometry.coordinates;
      const isInPolygon = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates[0]);
      
      console.log(`   - 폴리곤 내부 여부: ${isInPolygon ? '✅ Yes' : '❌ No'}`);
      
    } else {
      console.log(`   - 배차 차량: 없음`);
      console.log(`   ⚠️  폴리곤 내에 배차 가능한 차량이 없습니다.`);
    }
    
    // 각 차량이 폴리곤 내부에 있는지 확인
    console.log(`\n🔍 폴리곤 내부 차량 분석:`);
    const polygonCoordinates = result.isochrone.geometry.coordinates[0];
    
    testVehicles.forEach((vehicle, idx) => {
      const vehiclePoint = [vehicle.current_lng, vehicle.current_lat];
      const isInPolygon = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates);
      const status = isInPolygon ? '✅ 내부' : '❌ 외부';
      
      console.log(`   ${idx + 1}. ${vehicle.name}: ${status}`);
      
      if (isInPolygon) {
        // 내부에 있는데 배차되지 않은 이유 분석
        if (vehicle.state !== 'idle') {
          console.log(`      → 배차 불가: 상태 (${vehicle.state})`);
        } else if (vehicle.assigned_demand_id) {
          console.log(`      → 배차 불가: 이미 배차됨 (${vehicle.assigned_demand_id})`);
        } else if (vehicle.job_type !== testDemand.job_type) {
          console.log(`      → 배차 불가: job_type 불일치 (${vehicle.job_type} ≠ ${testDemand.job_type})`);
        } else if (result.assignedVehicle && vehicle.id === result.assignedVehicle.id) {
          console.log(`      → ✅ 배차됨!`);
        } else {
          console.log(`      → 배차 가능했으나 더 가까운 차량에 배차됨`);
        }
      }
    });
    
  } else {
    console.log('\n❌ 배차 프로세스 실패!');
    console.log(`   - 에러: ${result.error}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ 테스트 완료');
  console.log('='.repeat(80));
}

// 테스트 실행
testFullDispatchProcess().catch(error => {
  console.error('테스트 중 오류 발생:', error);
  process.exit(1);
});
