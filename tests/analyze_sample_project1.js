/**
 * sample-project-1 시뮬레이션 상세 분석
 * 수요3 (XYZ123) reject 원인 조사
 */

const fs = require('fs').promises;
const path = require('path');
const DispatchEngine = require('../services/dispatchEngine');
require('dotenv').config();

async function analyzeSampleProject1() {
  console.log('='.repeat(80));
  console.log('🔍 sample-project-1 수요3 reject 원인 분석');
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
      location: [parseFloat(lng), parseFloat(lat)],
      job_type: job_type,
      state: 'idle'
    };
  });
  
  console.log(`\n📋 차량 정보:`);
  vehicles.forEach((v, idx) => {
    console.log(`   ${idx + 1}. ${v.name}:`);
    console.log(`      위치: [${v.location[0]}, ${v.location[1]}]`);
    console.log(`      Job Type: ${v.job_type}`);
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
  const demands = demandDataLines.map(line => {
    const fields = line.split(',').map(s => s.trim());
    return {
      id: fields[idIdx],
      address: fields[addressIdx],
      location: [parseFloat(fields[longitudeIdx]), parseFloat(fields[latitudeIdx])],
      origin_lng: parseFloat(fields[longitudeIdx]),
      origin_lat: parseFloat(fields[latitudeIdx]),
      time: fields[timeIdx],
      job_type: fields[jobTypeIdx]
    };
  });
  
  console.log(`\n📋 수요 정보 (발생 시간 순):`);
  const sortedDemands = [...demands].sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    return (timeA[0] * 3600 + timeA[1] * 60) - (timeB[0] * 3600 + timeB[1] * 60);
  });
  
  sortedDemands.forEach((d, idx) => {
    console.log(`   ${idx + 1}. ${d.address} (${d.id}):`);
    console.log(`      시간: ${d.time}`);
    console.log(`      위치: [${d.location[0]}, ${d.location[1]}]`);
    console.log(`      Job Type: ${d.job_type}`);
  });
  
  // 3. 프로젝트 설정
  const projectConfig = JSON.parse(
    await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8')
  );
  
  console.log(`\n⚙️  프로젝트 설정:`);
  console.log(`   Wait Time Limit: ${projectConfig.waitTimeLimit}분`);
  console.log(`   운영 시간: ${projectConfig.operatingTime.start} ~ ${projectConfig.operatingTime.end}`);
  
  // 4. 각 수요와 차량 간 거리 계산
  const dispatchEngine = new DispatchEngine();
  
  console.log(`\n📏 각 수요와 차량 간의 직선 거리:`);
  sortedDemands.forEach(demand => {
    console.log(`\n   ${demand.address} (${demand.id}) - ${demand.time}:`);
    vehicles.forEach(vehicle => {
      const distance = dispatchEngine.calculateDistance(
        demand.origin_lng,
        demand.origin_lat,
        vehicle.location[0],
        vehicle.location[1]
      );
      console.log(`      ${vehicle.name}: ${distance.toFixed(3)} km`);
    });
  });
  
  // 5. 수요3에 대한 Isochrone 확인
  const demand3 = demands.find(d => d.id === 'XYZ123');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 수요3 (XYZ123) 상세 분석`);
  console.log('='.repeat(80));
  
  console.log(`\n📍 수요3 정보:`);
  console.log(`   ID: ${demand3.id}`);
  console.log(`   주소: ${demand3.address}`);
  console.log(`   시간: ${demand3.time}`);
  console.log(`   위치: [${demand3.location[0]}, ${demand3.location[1]}]`);
  console.log(`   Job Type: ${demand3.job_type}`);
  
  console.log(`\n🌍 Isochrone 계산 (Wait Time Limit: ${projectConfig.waitTimeLimit}분):`);
  const isochroneResult = await dispatchEngine.calculateIsochrone(
    demand3,
    projectConfig.waitTimeLimit
  );
  
  if (isochroneResult.success) {
    console.log(`   ✅ Isochrone 생성 성공`);
    console.log(`   - Contour: ${isochroneResult.isochrone.properties.contour}분`);
    console.log(`   - 폴리곤 좌표 개수: ${isochroneResult.coordinates[0].length}`);
    
    // 차량이 폴리곤 내부에 있는지 확인
    console.log(`\n🔍 차량이 폴리곤 내부에 있는지 확인:`);
    const polygonCoordinates = isochroneResult.coordinates[0];
    
    vehicles.forEach(vehicle => {
      const vehiclePoint = [vehicle.location[0], vehicle.location[1]];
      const isInside = dispatchEngine.isPointInPolygon(vehiclePoint, polygonCoordinates);
      
      const status = isInside ? '✅ 내부' : '❌ 외부';
      const distance = dispatchEngine.calculateDistance(
        demand3.origin_lng,
        demand3.origin_lat,
        vehicle.location[0],
        vehicle.location[1]
      );
      
      console.log(`   ${vehicle.name}: ${status} (거리: ${distance.toFixed(3)} km)`);
    });
  } else {
    console.log(`   ❌ Isochrone 생성 실패: ${isochroneResult.error}`);
  }
  
  // 6. 시뮬레이션 결과 확인
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 시뮬레이션 결과 분석');
  console.log('='.repeat(80));
  
  const resultPath = path.join(projectPath, 'simulation_result.json');
  let simulationResult;
  
  try {
    const resultContent = await fs.readFile(resultPath, 'utf-8');
    simulationResult = JSON.parse(resultContent);
    
    console.log(`\n📋 수요 처리 결과:`);
    simulationResult.demands.forEach((d, idx) => {
      console.log(`\n   ${idx + 1}. ${d.address} (${d.id}):`);
      console.log(`      시간: ${d.requestTime}`);
      console.log(`      상태: ${d.status}`);
      console.log(`      배차 차량: ${d.assignedVehicle || 'None'}`);
      
      if (d.timeline) {
        console.log(`      타임라인:`);
        console.log(`         요청: ${d.timeline.requested}`);
        console.log(`         배차: ${d.timeline.dispatched}`);
        console.log(`         도착: ${d.timeline.arrived}`);
        console.log(`         작업 시작: ${d.timeline.workStarted}`);
        console.log(`         작업 완료: ${d.timeline.workCompleted}`);
      }
    });
    
    // 수요3의 reject 원인 분석
    const demand3Result = simulationResult.demands.find(d => d.id === 'XYZ123');
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('🔎 수요3 Reject 원인 분석');
    console.log('='.repeat(80));
    
    if (demand3Result.status === 'rejected') {
      console.log(`\n❌ 수요3이 reject되었습니다.`);
      console.log(`\n가능한 원인:`);
      
      // 수요1 처리 상태 확인
      const demand1Result = simulationResult.demands.find(d => d.id === 'vpGPNz');
      
      console.log(`\n1️⃣  수요1 처리 시간 분석:`);
      console.log(`   - 수요1 요청: ${demand1Result.requestTime} (${demand1Result.timeline.requested}초)`);
      console.log(`   - 수요1 배차: ${demand1Result.timeline.dispatched}초`);
      console.log(`   - 수요1 도착: ${demand1Result.timeline.arrived}초`);
      console.log(`   - 수요1 작업 시작: ${demand1Result.timeline.workStarted}초`);
      console.log(`   - 수요1 작업 완료: ${demand1Result.timeline.workCompleted}초`);
      
      console.log(`\n2️⃣  수요3 요청 시점:`);
      console.log(`   - 수요3 요청: ${demand3Result.requestTime} (${demand3Result.timestamp}초)`);
      
      console.log(`\n3️⃣  시간대 비교:`);
      if (demand3Result.timestamp < demand1Result.timeline.workCompleted) {
        console.log(`   ⚠️  수요3 요청 시점에 차량이 아직 수요1을 처리 중이었습니다!`);
        console.log(`   - 수요3 요청: ${demand3Result.timestamp}초`);
        console.log(`   - 수요1 완료: ${demand1Result.timeline.workCompleted}초`);
        console.log(`   - 차이: ${demand1Result.timeline.workCompleted - demand3Result.timestamp}초 차이`);
        
        if (demand3Result.timestamp >= demand1Result.timeline.dispatched && 
            demand3Result.timestamp < demand1Result.timeline.arrived) {
          console.log(`\n   ✋ 차량 상태: 수요1로 이동 중 (moving)`);
        } else if (demand3Result.timestamp >= demand1Result.timeline.arrived && 
                   demand3Result.timestamp < demand1Result.timeline.workCompleted) {
          console.log(`\n   ✋ 차량 상태: 수요1 작업 중 (working)`);
        }
        
        console.log(`\n💡 결론:`);
        console.log(`   배차 엔진이 차량 상태를 정확히 체크했습니다.`);
        console.log(`   차량이 'idle' 상태가 아니어서 배차가 불가능했습니다.`);
      } else {
        console.log(`   ⚠️  수요3 요청 시점에 차량은 이미 idle 상태였어야 합니다.`);
        console.log(`   다른 원인을 조사해야 합니다.`);
      }
    }
    
  } catch (error) {
    console.log(`\n⚠️  시뮬레이션 결과를 찾을 수 없습니다.`);
    console.log(`   시뮬레이션을 먼저 실행해주세요: npm start`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
}

// 테스트 실행
analyzeSampleProject1().catch(error => {
  console.error('분석 중 오류 발생:', error);
  process.exit(1);
});
