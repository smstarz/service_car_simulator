/**
 * sample-project-1 실제 시뮬레이션 실행 테스트
 * 전체 시뮬레이션 프로세스를 단계별로 실행하고 로그 확인
 */

const path = require('path');

// 시뮬레이션 엔진 동적 로드
async function runSimulation() {
  console.log('='.repeat(80));
  console.log('🚀 sample-project-1 실제 시뮬레이션 실행');
  console.log('='.repeat(80));
  
  const SimulationEngine = require('../services/simulationEngine');
  
  const projectPath = path.join(__dirname, '../projects/sample-project-1');
  const simulationEngine = new SimulationEngine(projectPath);
  
  try {
    console.log('\n📋 1단계: 시뮬레이션 초기화');
    await simulationEngine.initialize();
    
    console.log('\n📋 2단계: 시뮬레이션 실행');
    console.log('='.repeat(80));
    const result = await simulationEngine.run();
    
    console.log('\n✅ 시뮬레이션 완료!');
    console.log('='.repeat(80));
    
    // 결과 분석
    console.log('\n� 최종 결과 분석:');
    console.log('='.repeat(80));
    
    console.log('\n수요 처리 결과:');
    result.demands.forEach((d, idx) => {
      console.log(`\n${idx + 1}. ${d.address} (${d.id}):`);
      console.log(`   시간: ${d.requestTime}`);
      console.log(`   상태: ${d.status}`);
      console.log(`   배차 차량: ${d.assignedVehicle || 'None'}`);
      if (d.metrics) {
        console.log(`   대기 시간: ${d.metrics.waitTime ? d.metrics.waitTime + 's' : 'N/A'}`);
        console.log(`   서비스 시간: ${d.metrics.serviceTime ? d.metrics.serviceTime + 's' : 'N/A'}`);
        console.log(`   총 시간: ${d.metrics.totalTime ? d.metrics.totalTime + 's' : 'N/A'}`);
      }
    });
    
  } catch (error) {
    console.error('\n❌ 시뮬레이션 실패:', error.message);
    console.error('스택:', error.stack);
    process.exit(1);
  }
}

runSimulation();
