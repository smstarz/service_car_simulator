/**
 * 배차 엔진 테스트 예제
 * Mapbox Isochrone API를 사용한 배차 엔진 기능 테스트
 */

const DispatchEngine = require('../services/dispatchEngine');
const fs = require('fs');
const path = require('path');

async function testDispatchEngine() {
  console.log('=== 배차 엔진 테스트 시작 ===\n');
  
  // 1. 배차 엔진 인스턴스 생성
  const engine = new DispatchEngine();
  
  // 2. 프로젝트 설정 로드
  const projectConfigPath = path.join(__dirname, '../projects/default/project.json');
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
  
  console.log('📋 프로젝트 설정:');
  console.log(`   대기 시간 제한: ${projectConfig.waitTimeLimit}분`);
  console.log(`   운영 시간: ${projectConfig.operatingTime.start} ~ ${projectConfig.operatingTime.end}\n`);
  
  // 3. 테스트용 차량 데이터
  const testVehicles = [
    {
      name: 'Vehicle_1',
      current_lng: 126.9780,  // 서울 시청 (폴리곤 내부, 가까움)
      current_lat: 37.5665,
      job_type: 'call',
      status: 'idle'
    },
    {
      name: 'Vehicle_2',
      current_lng: 126.9850,  // 명동 근처 (폴리곤 내부, 조금 멀음)
      current_lat: 37.5635,
      job_type: 'call',
      status: 'idle'
    },
    {
      name: 'Vehicle_3',
      current_lng: 127.0276,  // 강남 (폴리곤 외부)
      current_lat: 37.4979,
      job_type: 'call',
      status: 'idle'
    },
    {
      name: 'Vehicle_4',
      current_lng: 126.9800,  // 서울 시청 근처 (폴리곤 내부, job_type 불일치)
      current_lat: 37.5670,
      job_type: 'delivery',
      status: 'idle'
    }
  ];
  
  // 4. 테스트용 수요 데이터 (서울 시청 근처)
  const testDemand = {
    call_id: 'TEST001',
    call_datetime: '2025-10-18 08:30:00',
    origin_lng: 126.9780,  // 서울 시청 경도 (backward compatibility)
    origin_lat: 37.5665,   // 서울 시청 위도 (backward compatibility)
    longitude: 126.9780,   // 수요 위치 경도
    latitude: 37.5665,     // 수요 위치 위도
    job_type: 'call'
  };
  
  console.log('🧪 테스트 차량 데이터:');
  testVehicles.forEach(v => {
    console.log(`   ${v.name}: [${v.current_lng}, ${v.current_lat}] - ${v.job_type} - ${v.status}`);
  });
  console.log('');
  
  console.log('🧪 테스트 수요 데이터:');
  console.log(JSON.stringify(testDemand, null, 2));
  console.log('');
  
  // 5. 배차 엔진 실행
  const result = await engine.onDemandOccurrence(testDemand, testVehicles, projectConfig);
  
  // 6. 결과 출력
  console.log('\n=== 테스트 결과 ===');
  
  if (result.success) {
    console.log('✅ 성공!');
    console.log(`\n📐 Isochrone 정보:`);
    console.log(`   대기시간: ${result.waitTimeLimit}분`);
    console.log(`   Contour: ${result.isochrone.properties.contour}분`);
    console.log(`   폴리곤 타입: ${result.isochrone.geometry.type}`);
    console.log(`   좌표 개수: ${result.isochrone.geometry.coordinates[0].length}개 포인트`);
    
    console.log(`\n🚗 배차 결과:`);
    console.log(`   상태: ${result.dispatch.status}`);
    if (result.assignedVehicle) {
      console.log(`   배차 차량: ${result.dispatch.vehicleName}`);
      console.log(`   거리: ${result.dispatch.distance.toFixed(3)} km`);
      console.log(`\n   선택된 차량 정보:`);
      console.log(`   - 이름: ${result.assignedVehicle.name}`);
      console.log(`   - 위치: [${result.assignedVehicle.current_lng}, ${result.assignedVehicle.current_lat}]`);
      console.log(`   - Job Type: ${result.assignedVehicle.job_type}`);
      console.log(`   - 상태: ${result.assignedVehicle.status}`);
    } else {
      console.log(`   배차 실패: 조건에 맞는 차량이 없습니다.`);
    }
    
    // GeoJSON 결과 저장
    const outputPath = path.join(__dirname, '../tests/dispatch_result.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      demand: result.demand,
      isochrone: result.isochrone,
      assignedVehicle: result.assignedVehicle,
      dispatch: result.dispatch,
      allVehicles: testVehicles
    }, null, 2));
    console.log(`\n💾 결과 저장: ${outputPath}`);
    
    // Isochrone GeoJSON만 별도 저장
    const isochronePath = path.join(__dirname, '../tests/isochrone_result.json');
    fs.writeFileSync(isochronePath, JSON.stringify({
      type: 'FeatureCollection',
      features: [
        result.isochrone,
        // 수요 위치 마커
        {
          type: 'Feature',
          properties: {
            type: 'demand',
            id: testDemand.call_id
          },
          geometry: {
            type: 'Point',
            coordinates: [testDemand.origin_lng, testDemand.origin_lat]
          }
        },
        // 차량 위치 마커들
        ...testVehicles.map(v => ({
          type: 'Feature',
          properties: {
            type: 'vehicle',
            name: v.name,
            job_type: v.job_type,
            assigned: result.assignedVehicle && result.assignedVehicle.name === v.name
          },
          geometry: {
            type: 'Point',
            coordinates: [v.current_lng, v.current_lat]
          }
        }))
      ]
    }, null, 2));
    console.log(`💾 Isochrone 저장: ${isochronePath}`);
    console.log('   👉 이 파일을 http://geojson.io 에서 시각화할 수 있습니다.');
    
  } else {
    console.log('❌ 실패!');
    console.log(`   에러: ${result.error}`);
  }
  
  console.log('\n=== 테스트 종료 ===');
}

// 테스트 실행
if (require.main === module) {
  testDispatchEngine().catch(error => {
    console.error('테스트 중 에러 발생:', error);
    process.exit(1);
  });
}

module.exports = { testDispatchEngine };
