/**
 * Isochrone 생성 테스트
 * 수요 발생 시점에 wait time limit 값으로 isochrone을 불러와서 폴리곤을 만드는지 확인
 */

const DispatchEngine = require('../services/dispatchEngine');
require('dotenv').config();

async function testIsochroneGeneration() {
  console.log('='.repeat(80));
  console.log('🧪 Isochrone 생성 테스트 시작');
  console.log('='.repeat(80));
  
  const dispatchEngine = new DispatchEngine();
  
  // 테스트용 수요 데이터 (서울 시청 근처)
  const testDemand = {
    call_id: 'TEST_001',
    origin_lng: 126.9780,
    origin_lat: 37.5665,
    job_type: 'general'
  };
  
  // 테스트할 wait time limit 값들
  const waitTimeLimits = [5, 10, 15];
  
  for (const waitTimeLimit of waitTimeLimits) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 Wait Time Limit: ${waitTimeLimit}분`);
    console.log('='.repeat(80));
    
    const result = await dispatchEngine.calculateIsochrone(testDemand, waitTimeLimit);
    
    if (result.success) {
      console.log('\n✅ Isochrone 생성 성공!');
      console.log(`   - Demand ID: ${result.demand.call_id}`);
      console.log(`   - 위치: [${result.demand.origin_lng}, ${result.demand.origin_lat}]`);
      console.log(`   - Wait Time Limit: ${result.waitTimeLimit}분`);
      console.log(`   - Contour 값: ${result.isochrone.properties.contour}분`);
      console.log(`   - 폴리곤 타입: ${result.isochrone.geometry.type}`);
      console.log(`   - 좌표 링 개수: ${result.coordinates.length}`);
      
      if (result.coordinates.length > 0) {
        console.log(`   - 첫 번째 링의 좌표 개수: ${result.coordinates[0].length}`);
        console.log(`   - 첫 3개 좌표 샘플:`);
        result.coordinates[0].slice(0, 3).forEach((coord, idx) => {
          console.log(`     ${idx + 1}. [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`);
        });
      }
      
      console.log('\n📍 GeoJSON 구조:');
      console.log(`   - Type: ${result.geojson.type}`);
      console.log(`   - Features: ${result.geojson.features.length}개`);
      
      // 폴리곤 검증
      console.log('\n🔍 폴리곤 검증:');
      const hasValidCoordinates = result.coordinates && 
                                 result.coordinates.length > 0 && 
                                 result.coordinates[0].length > 0;
      
      if (hasValidCoordinates) {
        console.log('   ✅ 폴리곤 좌표가 유효합니다.');
        
        // contour 값 검증
        const expectedContour = waitTimeLimit;
        const actualContour = result.isochrone.properties.contour;
        
        if (actualContour === expectedContour) {
          console.log(`   ✅ Contour 값이 요청한 값과 일치합니다. (${expectedContour}분)`);
        } else {
          console.log(`   ⚠️  Contour 값 불일치: 요청=${expectedContour}분, 실제=${actualContour}분`);
        }
        
        // 폴리곤 형태 검증
        const firstRing = result.coordinates[0];
        const isClosedPolygon = 
          firstRing[0][0] === firstRing[firstRing.length - 1][0] &&
          firstRing[0][1] === firstRing[firstRing.length - 1][1];
        
        if (isClosedPolygon) {
          console.log('   ✅ 폴리곤이 닫혀있습니다 (첫 점 = 마지막 점)');
        } else {
          console.log('   ⚠️  폴리곤이 열려있습니다 (첫 점 ≠ 마지막 점)');
        }
        
      } else {
        console.log('   ❌ 폴리곤 좌표가 유효하지 않습니다!');
      }
      
    } else {
      console.log('\n❌ Isochrone 생성 실패!');
      console.log(`   - 에러: ${result.error}`);
      
      // MAPBOX_TOKEN 체크
      if (!process.env.MAPBOX_TOKEN) {
        console.log('\n⚠️  .env 파일에 MAPBOX_TOKEN이 설정되어 있는지 확인하세요!');
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 모든 테스트 완료');
  console.log('='.repeat(80));
}

// 테스트 실행
testIsochroneGeneration().catch(error => {
  console.error('테스트 중 오류 발생:', error);
  process.exit(1);
});
