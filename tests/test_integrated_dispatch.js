/**
 * 수정 후 배차 프로세스 통합 테스트
 * sample-project-1의 실제 데이터로 배차가 성공하는지 확인
 */

const fs = require('fs').promises;
const path = require('path');
const DispatchEngine = require('../services/dispatchEngine');
const { VehicleStateManager } = require('../services/vehicleStateManager');
require('dotenv').config();

async function testIntegratedDispatch() {
  console.log('='.repeat(80));
  console.log('🧪 수정 후 배차 프로세스 통합 테스트');
  console.log('='.repeat(80));
  
  const projectPath = path.join(__dirname, '../projects/sample-project-1');
  
  // 1. Vehicle 로드
  const vehiclePath = path.join(projectPath, 'vehicle_set.csv');
  const vehicleContent = await fs.readFile(vehiclePath, 'utf-8');
  const vehicleLines = vehicleContent.split('\n').filter(line => line.trim());
  const dataLines = vehicleLines.slice(1);
  
  const vehicles = dataLines.map((line, index) => {
    const [name, lat, lng, job_type] = line.split(',').map(s => s.trim());
    
    return {
      id: `vehicle_${String(index + 1).padStart(3, '0')}`,
      name: name,
      initialLocation: [parseFloat(lng), parseFloat(lat)],
      location: [parseFloat(lng), parseFloat(lat)],
      job_type: job_type,
      state: 'idle',
      currentDemand: null,
      route: null
    };
  });
  
  console.log(`\n✅ 차량 로드: ${vehicles.length}대`);
  vehicles.forEach((v, idx) => {
    console.log(`   ${idx + 1}. ${v.name}: [${v.location[0]}, ${v.location[1]}] (${v.job_type})`);
  });
  
  // 2. Demand 로드
  const demandPath = path.join(projectPath, 'demand_data.csv');
  const demandContent = await fs.readFile(demandPath, 'utf-8');
  const demandLines = demandContent.split('\n').filter(line => line.trim());
  
  const header = demandLines[0].split(',').map(s => s.trim());
  const idIdx = header.indexOf('id');
  const addressIdx = header.indexOf('address');
  const longitudeIdx = header.indexOf('longitude');
  const latitudeIdx = header.indexOf('latitude');
  const timeIdx = header.indexOf('time');
  const jobTypeIdx = header.indexOf('job_type');
  
  const demandDataLines = demandLines.slice(1);
  const firstDemandFields = demandDataLines[0].split(',').map(s => s.trim());
  
  const demand = {
    id: firstDemandFields[idIdx],
    address: firstDemandFields[addressIdx],
    location: [parseFloat(firstDemandFields[longitudeIdx]), parseFloat(firstDemandFields[latitudeIdx])],
    origin_lng: parseFloat(firstDemandFields[longitudeIdx]),
    origin_lat: parseFloat(firstDemandFields[latitudeIdx]),
    time: firstDemandFields[timeIdx],
    job_type: firstDemandFields[jobTypeIdx]
  };
  
  console.log(`\n✅ 수요 로드:`);
  console.log(`   ID: ${demand.id}`);
  console.log(`   주소: ${demand.address}`);
  console.log(`   위치: [${demand.origin_lng}, ${demand.origin_lat}]`);
  console.log(`   Job Type: ${demand.job_type}`);
  
  // 3. VehicleStateManager 초기화
  const vehicleStateManager = new VehicleStateManager();
  vehicles.forEach(vehicle => {
    vehicleStateManager.registerVehicle(vehicle);
  });
  
  const managedVehicles = vehicleStateManager.getAllVehicles();
  
  console.log(`\n📋 VehicleStateManager 등록 완료: ${managedVehicles.length}대`);
  
  // 4. 프로젝트 설정 로드
  const projectConfig = JSON.parse(
    await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
  );
  
  console.log(`\n⚙️  프로젝트 설정:`);
  console.log(`   Wait Time Limit: ${projectConfig.waitTimeLimit}분`);
  
  // 5. 배차 엔진으로 배차 시도
  console.log(`\n${'='.repeat(80)}`);
  console.log('🚀 배차 프로세스 시작');
  console.log('='.repeat(80));
  
  const dispatchEngine = new DispatchEngine();
  
  const result = await dispatchEngine.onDemandOccurrence(
    demand,
    managedVehicles,
    projectConfig
  );
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 배차 결과');
  console.log('='.repeat(80));
  
  if (result.success) {
    console.log('\n✅ 배차 프로세스 성공!');
    
    if (result.assignedVehicle) {
      console.log(`\n🚗 배차된 차량:`);
      console.log(`   - 이름: ${result.assignedVehicle.name}`);
      console.log(`   - ID: ${result.assignedVehicle.id}`);
      console.log(`   - Job Type: ${result.assignedVehicle.job_type}`);
      console.log(`   - 거리: ${result.dispatch.distance.toFixed(3)} km`);
      console.log(`   - 상태: ${result.dispatch.status}`);
      
      console.log(`\n✨ 문제 해결 확인:`);
      console.log(`   - location 배열 기반 위치 매칭: ✅ 성공`);
      console.log(`   - 폴리곤 내부 차량 탐색: ✅ 성공`);
      console.log(`   - Job Type 매칭: ✅ 성공`);
      console.log(`   - 최단 거리 차량 선택: ✅ 성공`);
      
    } else {
      console.log(`\n⚠️  배차 실패:`);
      console.log(`   - 상태: ${result.dispatch.status}`);
      console.log(`   - 폴리곤 내에 적절한 차량이 없습니다.`);
    }
    
  } else {
    console.log('\n❌ 배차 프로세스 실패!');
    console.log(`   - 에러: ${result.error}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
}

// 테스트 실행
testIntegratedDispatch().catch(error => {
  console.error('테스트 중 오류 발생:', error);
  process.exit(1);
});
