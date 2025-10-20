/**
 * 차량 위치 데이터 구조 및 폴리곤 매칭 검증 테스트
 * 실제 sample-project-1 데이터를 사용하여 문제 진단
 */

const fs = require('fs').promises;
const path = require('path');
const DispatchEngine = require('../services/dispatchEngine');
const { VehicleStateManager } = require('../services/vehicleStateManager');
require('dotenv').config();

async function testVehicleLocationMatching() {
  console.log('='.repeat(80));
  console.log('🧪 차량 위치 데이터 구조 및 폴리곤 매칭 검증');
  console.log('='.repeat(80));
  
  const projectPath = path.join(__dirname, '../projects/sample-project-1');
  
  // 1. Vehicle CSV 로드 (실제 시뮬레이션 엔진 방식 재현)
  console.log('\n📁 Vehicle CSV 로드 중...');
  const vehiclePath = path.join(projectPath, 'vehicle_set.csv');
  const vehicleContent = await fs.readFile(vehiclePath, 'utf-8');
  const vehicleLines = vehicleContent.split('\n').filter(line => line.trim());
  
  console.log(`   - 총 라인 수: ${vehicleLines.length}`);
  console.log(`   - 헤더: ${vehicleLines[0]}`);
  
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
  
  console.log(`\n✅ 차량 로드 완료: ${vehicles.length}대`);
  vehicles.forEach((v, idx) => {
    console.log(`   ${idx + 1}. ${v.name}:`);
    console.log(`      - ID: ${v.id}`);
    console.log(`      - location: [${v.location[0]}, ${v.location[1]}]`);
    console.log(`      - initialLocation: [${v.initialLocation[0]}, ${v.initialLocation[1]}]`);
    console.log(`      - job_type: ${v.job_type}`);
    console.log(`      - state: ${v.state}`);
    console.log(`      - current_lng: ${v.current_lng} (존재하지 않음)`);
    console.log(`      - current_lat: ${v.current_lat} (존재하지 않음)`);
  });
  
  // 2. Demand CSV 로드
  console.log('\n📁 Demand CSV 로드 중...');
  const demandPath = path.join(projectPath, 'demand_data.csv');
  const demandContent = await fs.readFile(demandPath, 'utf-8');
  const demandLines = demandContent.split('\n').filter(line => line.trim());
  
  console.log(`   - 총 라인 수: ${demandLines.length}`);
  console.log(`   - 헤더: ${demandLines[0]}`);
  
  const header = demandLines[0].split(',').map(s => s.trim());
  const idIdx = header.indexOf('id');
  const addressIdx = header.indexOf('address');
  const longitudeIdx = header.indexOf('longitude');
  const latitudeIdx = header.indexOf('latitude');
  const timeIdx = header.indexOf('time');
  const jobTypeIdx = header.indexOf('job_type');
  
  const demandDataLines = demandLines.slice(1);
  const firstDemandFields = demandDataLines[0].split(',').map(s => s.trim());
  
  const firstDemand = {
    id: firstDemandFields[idIdx],
    address: firstDemandFields[addressIdx],
    location: [parseFloat(firstDemandFields[longitudeIdx]), parseFloat(firstDemandFields[latitudeIdx])],
    origin_lng: parseFloat(firstDemandFields[longitudeIdx]),
    origin_lat: parseFloat(firstDemandFields[latitudeIdx]),
    time: firstDemandFields[timeIdx],
    job_type: firstDemandFields[jobTypeIdx]
  };
  
  console.log(`\n✅ 첫 번째 수요 로드:`);
  console.log(`   - ID: ${firstDemand.id}`);
  console.log(`   - 주소: ${firstDemand.address}`);
  console.log(`   - location: [${firstDemand.location[0]}, ${firstDemand.location[1]}]`);
  console.log(`   - origin_lng: ${firstDemand.origin_lng}`);
  console.log(`   - origin_lat: ${firstDemand.origin_lat}`);
  console.log(`   - 시간: ${firstDemand.time}`);
  console.log(`   - job_type: ${firstDemand.job_type}`);
  
  // 3. 거리 계산
  const dispatchEngine = new DispatchEngine();
  console.log(`\n📏 차량과 수요 간 거리 계산:`);
  vehicles.forEach(vehicle => {
    // location 배열 사용
    const distance1 = dispatchEngine.calculateDistance(
      firstDemand.origin_lng,
      firstDemand.origin_lat,
      vehicle.location[0],
      vehicle.location[1]
    );
    console.log(`   ${vehicle.name} (location 사용): ${distance1.toFixed(3)} km`);
    
    // current_lng/current_lat 사용 시도
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      const distance2 = dispatchEngine.calculateDistance(
        firstDemand.origin_lng,
        firstDemand.origin_lat,
        vehicle.current_lng,
        vehicle.current_lat
      );
      console.log(`   ${vehicle.name} (current_lng/lat 사용): ${distance2.toFixed(3)} km`);
    } else {
      console.log(`   ${vehicle.name} (current_lng/lat): ❌ 필드 없음!`);
    }
  });
  
  // 4. Isochrone 생성 및 폴리곤 매칭 테스트
  console.log(`\n${'='.repeat(80)}`);
  console.log('🌍 Isochrone 생성 및 폴리곤 매칭 테스트');
  console.log('='.repeat(80));
  
  const projectConfig = JSON.parse(
    await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
  );
  
  console.log(`\n📊 프로젝트 설정:`);
  console.log(`   - Wait Time Limit: ${projectConfig.waitTimeLimit}분`);
  
  const isochroneResult = await dispatchEngine.calculateIsochrone(
    firstDemand,
    projectConfig.waitTimeLimit
  );
  
  if (!isochroneResult.success) {
    console.error('❌ Isochrone 계산 실패:', isochroneResult.error);
    return;
  }
  
  console.log(`\n✅ Isochrone 생성 성공`);
  console.log(`   - Contour: ${isochroneResult.isochrone.properties.contour}분`);
  console.log(`   - 폴리곤 좌표 개수: ${isochroneResult.coordinates[0].length}`);
  
  // 5. 차량이 폴리곤 내부에 있는지 확인
  console.log(`\n🔍 폴리곤 내부 차량 매칭 테스트:`);
  console.log(`\n[ 테스트 1: location 배열 사용 ]`);
  
  const polygonCoordinates = isochroneResult.coordinates[0];
  
  vehicles.forEach(vehicle => {
    const vehiclePoint = [vehicle.location[0], vehicle.location[1]];
    const isInside = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates);
    
    console.log(`   ${vehicle.name}:`);
    console.log(`      위치: [${vehiclePoint[0]}, ${vehiclePoint[1]}]`);
    console.log(`      폴리곤 내부: ${isInside ? '✅ Yes' : '❌ No'}`);
  });
  
  console.log(`\n[ 테스트 2: current_lng/current_lat 사용 시도 ]`);
  
  vehicles.forEach(vehicle => {
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      const vehiclePoint = [vehicle.current_lng, vehicle.current_lat];
      const isInside = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates);
      
      console.log(`   ${vehicle.name}:`);
      console.log(`      위치: [${vehiclePoint[0]}, ${vehiclePoint[1]}]`);
      console.log(`      폴리곤 내부: ${isInside ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log(`   ${vehicle.name}: ❌ current_lng/current_lat 필드 없음!`);
    }
  });
  
  // 6. VehicleStateManager 사용 테스트
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔧 VehicleStateManager 사용 테스트');
  console.log('='.repeat(80));
  
  const vehicleStateManager = new VehicleStateManager();
  
  vehicles.forEach(vehicle => {
    vehicleStateManager.registerVehicle(vehicle);
  });
  
  const allVehiclesFromManager = vehicleStateManager.getAllVehicles();
  
  console.log(`\n📋 VehicleStateManager에서 가져온 차량 정보:`);
  allVehiclesFromManager.forEach((v, idx) => {
    console.log(`   ${idx + 1}. ${v.name}:`);
    console.log(`      - location: ${v.location ? `[${v.location[0]}, ${v.location[1]}]` : 'undefined'}`);
    console.log(`      - current_lng: ${v.current_lng}`);
    console.log(`      - current_lat: ${v.current_lat}`);
    console.log(`      - initial_lng: ${v.initial_lng}`);
    console.log(`      - initial_lat: ${v.initial_lat}`);
    console.log(`      - state: ${v.state}`);
  });
  
  console.log(`\n[ VehicleStateManager의 차량으로 폴리곤 매칭 테스트 ]`);
  
  allVehiclesFromManager.forEach(vehicle => {
    let vehiclePoint = null;
    let method = '';
    
    // current_lng/current_lat 우선 사용
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      vehiclePoint = [vehicle.current_lng, vehicle.current_lat];
      method = 'current_lng/lat';
    } else if (vehicle.location) {
      vehiclePoint = [vehicle.location[0], vehicle.location[1]];
      method = 'location';
    } else if (vehicle.initial_lng !== undefined && vehicle.initial_lat !== undefined) {
      vehiclePoint = [vehicle.initial_lng, vehicle.initial_lat];
      method = 'initial_lng/lat';
    }
    
    if (vehiclePoint) {
      const isInside = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates);
      
      console.log(`   ${vehicle.name}:`);
      console.log(`      사용한 필드: ${method}`);
      console.log(`      위치: [${vehiclePoint[0]}, ${vehiclePoint[1]}]`);
      console.log(`      폴리곤 내부: ${isInside ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log(`   ${vehicle.name}: ❌ 위치 정보 없음!`);
    }
  });
  
  // 7. 결론
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 문제 진단 결과');
  console.log('='.repeat(80));
  
  console.log(`\n🔍 발견된 문제점:`);
  console.log(`   1. SimulationEngine에서 차량 로드 시 'location' 필드 사용`);
  console.log(`   2. DispatchEngine에서는 'current_lng/current_lat' 필드 사용`);
  console.log(`   3. 필드명 불일치로 인해 차량 위치를 찾을 수 없음`);
  console.log(`   4. undefined 값으로 폴리곤 매칭 실패`);
  
  console.log(`\n💡 해결 방안:`);
  console.log(`   A. SimulationEngine에서 차량 로드 시 current_lng/current_lat 추가`);
  console.log(`   B. DispatchEngine에서 location 배열도 처리 가능하도록 수정`);
  console.log(`   C. VehicleStateManager에서 registerVehicle 시 좌표 필드 정규화`);
  
  console.log(`\n${'='.repeat(80)}`);
}

// 테스트 실행
testVehicleLocationMatching().catch(error => {
  console.error('테스트 중 오류 발생:', error);
  process.exit(1);
});
