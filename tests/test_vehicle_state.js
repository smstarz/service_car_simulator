/**
 * 차량 상태 관리 시스템 테스트
 * VehicleStateManager와 DispatchEngine 통합 테스트
 */

const { VehicleStateManager, VehicleState } = require('../services/vehicleStateManager');
const DispatchEngine = require('../services/dispatchEngine');
const fs = require('fs');
const path = require('path');

async function testVehicleStateManagement() {
  console.log('=== 차량 상태 관리 시스템 테스트 시작 ===\n');
  
  // 1. VehicleStateManager 초기화 (프로젝트 경로 전달)
  const projectPath = path.join(__dirname, '../projects/default');
  const stateManager = new VehicleStateManager(projectPath);
  const dispatchEngine = new DispatchEngine();
  
  // 2. 프로젝트 설정 로드
  const projectConfigPath = path.join(projectPath, 'project.json');
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
  
  console.log('📋 프로젝트 설정:');
  console.log(`   대기 시간 제한: ${projectConfig.waitTimeLimit}분\n`);
  
  // 3. 차량 등록
  console.log('🚗 차량 등록 중...\n');
  
  const vehicles = [
    {
      id: 'vehicle_1',
      name: 'Vehicle_1',
      current_lng: 126.9780,
      current_lat: 37.5665,
      job_type: 'call',
      capacity: 4
    },
    {
      id: 'vehicle_2',
      name: 'Vehicle_2',
      current_lng: 126.9850,
      current_lat: 37.5635,
      job_type: 'call',
      capacity: 4
    },
    {
      id: 'vehicle_3',
      name: 'Vehicle_3',
      current_lng: 127.0276,
      current_lat: 37.4979,
      job_type: 'call',
      capacity: 4
    },
    {
      id: 'vehicle_4',
      name: 'Vehicle_4',
      current_lng: 126.9800,
      current_lat: 37.5670,
      job_type: 'delivery',
      capacity: 4
    }
  ];
  
  vehicles.forEach(v => stateManager.registerVehicle(v));
  
  // 4. 초기 통계 출력
  console.log('\n📊 초기 통계:');
  console.log(JSON.stringify(stateManager.getStatistics(), null, 2));
  console.log('\n📈 상태 분포:');
  console.log(JSON.stringify(stateManager.getStateDistribution(), null, 2));
  
  // 5. 첫 번째 수요 발생
  console.log('\n' + '='.repeat(60));
  console.log('테스트 시나리오 1: 첫 번째 수요 발생');
  console.log('='.repeat(60));
  
  const demand1 = {
    id: 'demand_001',
    call_datetime: '2025-10-18 08:30:00',
    longitude: 126.9780,
    latitude: 37.5665,
    job_type: 'call'
  };
  
  // 배차 가능한 차량 조회
  const availableVehicles1 = stateManager.getAvailableVehicles();
  console.log(`\n배차 가능한 차량: ${availableVehicles1.length}대`);
  
  // 배차 실행
  const result1 = await dispatchEngine.onDemandOccurrence(
    demand1,
    availableVehicles1,
    projectConfig
  );
  
  if (result1.success && result1.assignedVehicle) {
    // 차량 상태를 DISPATCHED로 변경
    const mockRoute = {
      features: [{
        properties: {
          totalTime: 300, // 5분
          totalDistance: 2000
        }
      }]
    };
    
    stateManager.assignDemand(
      result1.assignedVehicle.id || result1.assignedVehicle.name,
      demand1,
      mockRoute
    );
  }
  
  // 6. 두 번째 수요 발생 (첫 번째 차량이 운행 중일 때)
  console.log('\n' + '='.repeat(60));
  console.log('테스트 시나리오 2: 두 번째 수요 발생 (첫 차량 운행 중)');
  console.log('='.repeat(60));
  
  const demand2 = {
    id: 'demand_002',
    call_datetime: '2025-10-18 08:31:00',
    longitude: 126.9850,
    latitude: 37.5635,
    job_type: 'call'
  };
  
  // 현재 통계 출력
  console.log('\n📊 현재 통계:');
  console.log(JSON.stringify(stateManager.getStatistics(), null, 2));
  console.log('\n📈 상태 분포:');
  console.log(JSON.stringify(stateManager.getStateDistribution(), null, 2));
  
  // 배차 가능한 차량 조회
  const availableVehicles2 = stateManager.getAvailableVehicles();
  console.log(`\n배차 가능한 차량: ${availableVehicles2.length}대`);
  availableVehicles2.forEach(v => {
    console.log(`   - ${v.name}: ${v.state}`);
  });
  
  // 배차 실행
  const result2 = await dispatchEngine.onDemandOccurrence(
    demand2,
    availableVehicles2,
    projectConfig
  );
  
  if (result2.success && result2.assignedVehicle) {
    const mockRoute2 = {
      features: [{
        properties: {
          totalTime: 250,
          totalDistance: 1800
        }
      }]
    };
    
    stateManager.assignDemand(
      result2.assignedVehicle.id || result2.assignedVehicle.name,
      demand2,
      mockRoute2
    );
  }
  
  // 7. 첫 번째 차량의 작업 완료 시뮬레이션
  console.log('\n' + '='.repeat(60));
  console.log('테스트 시나리오 3: 첫 차량 수요 위치 도착 → 작업 → 완료');
  console.log('='.repeat(60));
  
  const firstVehicleId = result1.assignedVehicle.id || result1.assignedVehicle.name;
  
  // 시뮬레이션 시간 업데이트 (300초 후 - 현장 도착)
  stateManager.updateSimulationTime(300);
  console.log('\n⏰ 시뮬레이션 시간: 300초 (5분 경과 - 현장 도착)');
  
  // 작업 시작 (service_time을 자동으로 job_type.csv에서 가져옴)
  stateManager.startWork(firstVehicleId);  // serviceTime 파라미터 제거
  
  // job_type 'call'의 service_time은 15분 = 900초
  const vehicle1 = stateManager.getVehicle(firstVehicleId);
  const workDuration = vehicle1.service_end_time - vehicle1.service_start_time;
  
  stateManager.updateSimulationTime(300 + workDuration);
  console.log(`⏰ 시뮬레이션 시간: ${300 + workDuration}초 (작업 완료)`);
  
  // 작업 완료
  stateManager.completeWork(firstVehicleId);
  
  // 8. 최종 통계
  console.log('\n' + '='.repeat(60));
  console.log('최종 통계');
  console.log('='.repeat(60));
  
  console.log('\n📊 차량별 상태:');
  stateManager.getAllVehicles().forEach(v => {
    console.log(`   ${v.name}:`);
    console.log(`      상태: ${v.state}`);
    console.log(`      배차 수요: ${v.assigned_demand_id || 'None'}`);
    console.log(`      완료 작업: ${v.total_jobs}`);
  });
  
  console.log('\n📊 전체 통계:');
  console.log(JSON.stringify(stateManager.getStatistics(), null, 2));
  
  console.log('\n📈 상태 분포:');
  console.log(JSON.stringify(stateManager.getStateDistribution(), null, 2));
  
  // 9. 세 번째 수요 발생 (첫 차량이 다시 IDLE 상태)
  console.log('\n' + '='.repeat(60));
  console.log('테스트 시나리오 4: 세 번째 수요 (첫 차량 다시 배차 가능)');
  console.log('='.repeat(60));
  
  const demand3 = {
    id: 'demand_003',
    call_datetime: '2025-10-18 08:45:00',
    longitude: 126.9800,
    latitude: 37.5650,
    job_type: 'call'
  };
  
  const availableVehicles3 = stateManager.getAvailableVehicles();
  console.log(`\n배차 가능한 차량: ${availableVehicles3.length}대`);
  availableVehicles3.forEach(v => {
    console.log(`   - ${v.name}: ${v.state} (작업: ${v.total_jobs}건)`);
  });
  
  const result3 = await dispatchEngine.onDemandOccurrence(
    demand3,
    availableVehicles3,
    projectConfig
  );
  
  if (result3.success && result3.assignedVehicle) {
    console.log(`\n✅ ${result3.assignedVehicle.name}이(가) 재배차되었습니다!`);
  }
  
  console.log('\n=== 테스트 완료 ===');
}

// 테스트 실행
if (require.main === module) {
  testVehicleStateManagement().catch(error => {
    console.error('테스트 중 에러 발생:', error);
    process.exit(1);
  });
}

module.exports = { testVehicleStateManagement };
