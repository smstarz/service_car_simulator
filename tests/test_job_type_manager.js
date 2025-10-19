/**
 * Job Type Manager 테스트
 * job_type.csv 파일 로드 및 service_time 조회 테스트
 */

const JobTypeManager = require('../services/jobTypeManager');
const path = require('path');

function testJobTypeManager() {
  console.log('=== Job Type Manager 테스트 시작 ===\n');
  
  // 1. JobTypeManager 초기화
  const jobTypeManager = new JobTypeManager();
  
  // 2. job_type.csv 파일 로드
  const projectPath = path.join(__dirname, '../projects/default');
  console.log(`📂 프로젝트 경로: ${projectPath}\n`);
  
  jobTypeManager.loadJobTypes(projectPath);
  // 파일이 없거나 로드 실패해도 계속 진행 (기본값 사용)
  
  // 3. 통계 출력
  console.log('\n📊 Job Type 통계:');
  const stats = jobTypeManager.getStatistics();
  console.log(JSON.stringify(stats, null, 2));
  
  // 4. 모든 Job Type 출력
  console.log('\n📋 전체 Job Type 목록:');
  const allJobTypes = jobTypeManager.getAllJobTypes();
  allJobTypes.forEach(jt => {
    console.log(`   - ${jt.job}: ${jt.service_time}분 (ID: ${jt.id})`);
  });
  
  // 5. Service Time 조회 테스트
  console.log('\n🔍 Service Time 조회 테스트:');
  
  const testCases = [
    'call',       // 존재하는 job_type
    'delivery',   // 존재하지 않는 job_type (기본값 사용)
    'pickup',     // 존재하지 않는 job_type (기본값 사용)
  ];
  
  testCases.forEach(jobType => {
    const serviceTimeMinutes = jobTypeManager.getServiceTime(jobType);
    const serviceTimeSeconds = jobTypeManager.getServiceTimeInSeconds(jobType);
    console.log(`   ${jobType}:`);
    console.log(`      - ${serviceTimeMinutes}분`);
    console.log(`      - ${serviceTimeSeconds}초`);
  });
  
  // 6. Job Type 존재 여부 확인
  console.log('\n✅ Job Type 존재 여부:');
  testCases.forEach(jobType => {
    const exists = jobTypeManager.hasJobType(jobType);
    console.log(`   ${jobType}: ${exists ? '존재' : '존재하지 않음'}`);
  });
  
  // 7. 특정 Job Type 정보 조회
  console.log('\n📄 Job Type 상세 정보:');
  const callInfo = jobTypeManager.getJobTypeInfo('call');
  if (callInfo) {
    console.log(`   call:`);
    console.log(JSON.stringify(callInfo, null, 6));
  }
  
  // 8. 기본값 변경 테스트
  console.log('\n🔧 기본 service_time 변경 테스트:');
  jobTypeManager.setDefaultServiceTime(15);
  const newDefaultTime = jobTypeManager.getServiceTime('nonexistent_job');
  console.log(`   새로운 기본값: ${newDefaultTime}분`);
  
  console.log('\n=== 테스트 완료 ===');
}

// 테스트 실행
if (require.main === module) {
  testJobTypeManager();
}

module.exports = { testJobTypeManager };
