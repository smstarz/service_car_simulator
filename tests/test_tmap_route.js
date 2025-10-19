/**
 * TMAP Route Service 테스트 스크립트
 * 
 * 실행 방법:
 * 1. .env 파일에 TMAP_API_KEY 설정
 * 2. node tests/test_tmap_route.js
 */

require('dotenv').config();
const tmapRouteService = require('../services/tmapRouteService');

// 테스트용 좌표
const TEST_LOCATIONS = {
  seoul_city_hall: [126.9784, 37.5665],      // 서울시청
  gangnam_station: [127.0276, 37.4979],      // 강남역
  hongdae: [126.9238, 37.5563],              // 홍대입구역
  jamsil: [127.1000, 37.5133],               // 잠실역
  itaewon: [126.9942, 37.5347]               // 이태원역
};

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

// 테스트 1: 단일 경로 탐색
async function test1_singleRoute() {
  separator();
  log('📍 테스트 1: 단일 경로 탐색', 'cyan');
  log('서울시청 → 강남역', 'blue');
  
  try {
    const startTime = Date.now();
    
    const routeData = await tmapRouteService.getCarRoute({
      startPoint: TEST_LOCATIONS.seoul_city_hall,
      endPoint: TEST_LOCATIONS.gangnam_station,
      departureTime: '09:30:00'
    });
    
    const elapsed = Date.now() - startTime;
    
    log('✅ 경로 탐색 성공', 'green');
    console.log('\n📊 경로 요약:');
    console.log(`   출발지: [${routeData.summary.startPoint}]`);
    console.log(`   도착지: [${routeData.summary.endPoint}]`);
    console.log(`   총 거리: ${routeData.summary.totalDistanceKm} km`);
    console.log(`   소요 시간: ${routeData.summary.totalTimeMinutes} 분`);
    console.log(`   경로 좌표 개수: ${routeData.coordinates.length}`);
    console.log(`   구간 개수: ${routeData.segments.length}`);
    console.log(`   API 응답 시간: ${elapsed}ms`);
    
    if (routeData.segments.length > 0) {
      console.log('\n🛣️  주요 구간:');
      routeData.segments.slice(0, 5).forEach((seg, idx) => {
        console.log(`   ${idx + 1}. ${seg.name} - ${seg.distance}m (${seg.time}초)`);
      });
      if (routeData.segments.length > 5) {
        console.log(`   ... 외 ${routeData.segments.length - 5}개 구간`);
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

// 테스트 2: Timestamp 이벤트 생성
async function test2_timestampEvents() {
  separator();
  log('📅 테스트 2: Timestamp 이벤트 생성', 'cyan');
  log('홍대 → 이태원 (시작 시간: 09:00:00 = 32400초)', 'blue');
  
  try {
    const routeData = await tmapRouteService.getCarRoute({
      startPoint: TEST_LOCATIONS.hongdae,
      endPoint: TEST_LOCATIONS.itaewon,
      departureTime: '09:00:00'
    });
    
    const startTimestamp = 32400; // 09:00:00
    const events = tmapRouteService.generateTimestampEvents(routeData, startTimestamp);
    
    log('✅ 이벤트 생성 성공', 'green');
    console.log(`\n📊 총 이벤트 개수: ${events.length}`);
    
    console.log('\n🕒 주요 이벤트:');
    events.slice(0, 5).forEach((event, idx) => {
      const timeStr = formatTimestamp(event.timestamp);
      console.log(`   ${idx + 1}. [${timeStr}] ${event.type}`);
      console.log(`      위치: [${event.location[0].toFixed(4)}, ${event.location[1].toFixed(4)}]`);
      if (event.segmentName) {
        console.log(`      구간: ${event.segmentName}`);
      }
    });
    
    if (events.length > 5) {
      console.log(`   ... 외 ${events.length - 5}개 이벤트`);
    }
    
    const lastEvent = events[events.length - 1];
    console.log(`\n   마지막 이벤트: [${formatTimestamp(lastEvent.timestamp)}] ${lastEvent.type}`);
    
    return true;
  } catch (error) {
    log(`❌ 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

// 테스트 3: 다중 경로 탐색
async function test3_multipleRoutes() {
  separator();
  log('🚗 테스트 3: 다중 경로 탐색 (배치)', 'cyan');
  log('3개의 경로를 동시에 탐색', 'blue');
  
  try {
    const routeRequests = [
      {
        vehicleId: 'vehicle_001',
        startPoint: TEST_LOCATIONS.seoul_city_hall,
        endPoint: TEST_LOCATIONS.gangnam_station,
        departureTime: '09:00:00'
      },
      {
        vehicleId: 'vehicle_002',
        startPoint: TEST_LOCATIONS.hongdae,
        endPoint: TEST_LOCATIONS.jamsil,
        departureTime: '09:15:00'
      },
      {
        vehicleId: 'vehicle_003',
        startPoint: TEST_LOCATIONS.itaewon,
        endPoint: TEST_LOCATIONS.gangnam_station,
        departureTime: '09:30:00'
      }
    ];
    
    const startTime = Date.now();
    const routes = await tmapRouteService.getMultipleRoutes(routeRequests);
    const elapsed = Date.now() - startTime;
    
    log('✅ 배치 탐색 성공', 'green');
    console.log(`\n📊 탐색 결과: ${routes.length}/${routeRequests.length} 성공`);
    console.log(`   총 소요 시간: ${elapsed}ms`);
    console.log(`   평균 시간: ${(elapsed / routes.length).toFixed(0)}ms per route`);
    
    console.log('\n🛣️  경로 요약:');
    routes.forEach((route, idx) => {
      if (route) {
        console.log(`   ${idx + 1}. ${routeRequests[idx].vehicleId}`);
        console.log(`      거리: ${route.summary.totalDistanceKm} km`);
        console.log(`      시간: ${route.summary.totalTimeMinutes} 분`);
      }
    });
    
    return true;
  } catch (error) {
    log(`❌ 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

// 테스트 4: 에러 처리
async function test4_errorHandling() {
  separator();
  log('⚠️  테스트 4: 에러 처리', 'cyan');
  
  let passCount = 0;
  const tests = [];
  
  // 4-1: 좌표 누락
  log('\n4-1. 좌표 누락 테스트', 'yellow');
  try {
    await tmapRouteService.getCarRoute({
      startPoint: TEST_LOCATIONS.seoul_city_hall
      // endPoint 누락
    });
    log('   ❌ 에러가 발생하지 않음', 'red');
  } catch (error) {
    log(`   ✅ 예상된 에러 발생: ${error.message}`, 'green');
    passCount++;
  }
  
  // 4-2: 잘못된 좌표 형식
  log('\n4-2. 잘못된 좌표 형식 테스트', 'yellow');
  try {
    await tmapRouteService.getCarRoute({
      startPoint: [126.9784], // 위도 누락
      endPoint: TEST_LOCATIONS.gangnam_station
    });
    log('   ❌ 에러가 발생하지 않음', 'red');
  } catch (error) {
    log(`   ✅ 예상된 에러 발생: ${error.message}`, 'green');
    passCount++;
  }
  
  log(`\n📊 에러 처리 테스트: ${passCount}/2 통과`, passCount === 2 ? 'green' : 'yellow');
  
  return passCount === 2;
}

// 유틸리티: timestamp를 HH:MM:SS 형식으로 변환
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 메인 테스트 실행
async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║          TMAP Route Service 테스트 스위트                      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  
  // API 키 확인
  if (!process.env.TMAP_API_KEY) {
    log('\n❌ TMAP_API_KEY가 설정되지 않았습니다!', 'red');
    log('   .env 파일에 TMAP_API_KEY를 추가하세요.', 'yellow');
    process.exit(1);
  }
  
  log('\n✅ TMAP_API_KEY 확인됨', 'green');
  log(`   API Key: ${process.env.TMAP_API_KEY.substring(0, 10)}...`, 'blue');
  
  // 테스트 실행
  const results = [];
  
  try {
    results.push(await test1_singleRoute());
    results.push(await test2_timestampEvents());
    results.push(await test3_multipleRoutes());
    results.push(await test4_errorHandling());
  } catch (error) {
    log(`\n❌ 테스트 중 예상치 못한 에러 발생: ${error.message}`, 'red');
    console.error(error);
  }
  
  // 결과 요약
  separator();
  const passCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  log('📊 테스트 결과 요약', 'cyan');
  console.log(`   통과: ${passCount}/${totalCount}`);
  
  if (passCount === totalCount) {
    log('\n🎉 모든 테스트 통과!', 'green');
  } else {
    log(`\n⚠️  ${totalCount - passCount}개 테스트 실패`, 'yellow');
  }
  
  separator();
}

// 스크립트 실행
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('테스트 실행 중 에러:', error);
    process.exit(1);
  });
}

module.exports = {
  test1_singleRoute,
  test2_timestampEvents,
  test3_multipleRoutes,
  test4_errorHandling
};
