/**
 * 최종 검증: sample-project-1 시뮬레이션 성공 확인
 */

const path = require('path');
const fs = require('fs').promises;

async function verifySimulation() {
  console.log('='.repeat(80));
  console.log('✅ sample-project-1 시뮬레이션 최종 검증');
  console.log('='.repeat(80));
  
  const resultPath = path.join(__dirname, '../projects/sample-project-1/simulation_result.json');
  
  try {
    const resultContent = await fs.readFile(resultPath, 'utf-8');
    const result = JSON.parse(resultContent);
    
    console.log('\n📊 시뮬레이션 결과 요약:');
    console.log(`   총 수요: ${result.demands.length}개`);
    console.log(`   총 차량: ${result.vehicles.length}대`);
    console.log(`   총 경로: ${result.routes.length}개`);
    
    console.log('\n📋 수요별 상세 결과:');
    result.demands.forEach((d, idx) => {
      console.log(`\n${idx + 1}. ${d.address} (${d.id}):`);
      console.log(`   발생 시간: ${d.requestTime}`);
      console.log(`   상태: ${d.status}`);
      console.log(`   배차 차량: ${d.assignedVehicle || 'None'}`);
      
      if (d.status === 'completed') {
        console.log(`   ✅ 성공적으로 완료됨`);
        console.log(`   대기 시간: ${d.metrics.waitTime}초`);
        console.log(`   서비스 시간: ${d.metrics.serviceTime}초`);
        console.log(`   총 시간: ${d.metrics.totalTime}초`);
      } else if (d.status === 'assigned') {
        console.log(`   🚗 배차됨 (작업 진행 중)`);
      } else {
        console.log(`   ❌ ${d.status}`);
      }
    });
    
    console.log('\n🚗 차량별 통계:');
    result.vehicles.forEach((v, idx) => {
      console.log(`\n${idx + 1}. ${v.name}:`);
      console.log(`   총 작업: ${v.statistics.total_jobs}건`);
      console.log(`   총 이동 거리: ${v.statistics.total_distance.toFixed(2)}km`);
      console.log(`   총 서비스 시간: ${v.statistics.total_service_time}초`);
      console.log(`   이동 시간: ${v.statistics.moving_time}초`);
      console.log(`   작업 시간: ${v.statistics.working_time}초`);
    });
    
    const completed = result.demands.filter(d => d.status === 'completed').length;
    const assigned = result.demands.filter(d => d.status === 'assigned').length;
    const rejected = result.demands.filter(d => d.status === 'rejected').length;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 최종 결과:');
    console.log('='.repeat(80));
    console.log(`   완료된 수요: ${completed}/${result.demands.length}`);
    console.log(`   배차된 수요: ${assigned}/${result.demands.length}`);
    console.log(`   거절된 수요: ${rejected}/${result.demands.length}`);
    console.log(`   성공률: ${(completed / result.demands.length * 100).toFixed(1)}%`);
    
    if (completed === result.demands.length) {
      console.log('\n✅ 모든 수요가 성공적으로 처리되었습니다!');
    } else if (completed + assigned === result.demands.length) {
      console.log('\n✅ 모든 수요가 배차되었습니다!');
    } else {
      console.log(`\n⚠️  ${rejected}개의 수요가 처리되지 못했습니다.`);
    }
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ 결과 파일을 읽을 수 없습니다:', error.message);
    console.log('\n먼저 시뮬레이션을 실행하세요: node tests/run_sample_project1.js');
  }
}

verifySimulation();
