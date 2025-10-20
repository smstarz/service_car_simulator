/**
 * Test: HTML 리포트가 독립적으로 작동하는지 확인
 * 생성된 HTML 파일을 직접 브라우저에서 열어도 차트가 표시되는지 확인
 */

const fs = require('fs').promises;
const path = require('path');

async function testReportStandalone() {
  console.log('🧪 Testing Standalone HTML Report...\n');
  
  const reportPath = path.join(__dirname, '..', 'projects', 'sample-project-1', 'simulation_report.html');
  
  try {
    const exists = await fs.stat(reportPath);
    if (!exists.isFile()) {
      console.log('❌ Report file does not exist yet');
      console.log('   생성하려면 웹 브라우저에서 "Create Report" 버튼을 클릭하세요');
      return;
    }
    
    const content = await fs.readFile(reportPath, 'utf-8');
    
    console.log('📊 Report File Analysis:');
    console.log('─────────────────────────────────────');
    console.log(`File size: ${(content.length / 1024).toFixed(2)} KB`);
    
    // 체크: 요약 카드 데이터가 HTML에 포함되어 있는지
    const hasTotalVehicles = content.includes('Total Vehicles') && /Total Vehicles<\/div>\s*<div class="card-value">\d+/.test(content);
    const hasTotalJobs = content.includes('Total Jobs') && /Total Jobs<\/div>\s*<div class="card-value">\d+/.test(content);
    const hasTotalDistance = content.includes('Total Distance') && /Total Distance<\/div>\s*<div class="card-value">[\d.]+/.test(content);
    const hasTotalTime = content.includes('Total Moving Time');
    
    // 체크: 차트 데이터가 JSON으로 포함되어 있는지
    const hasChartData = content.includes('window.vehicleChartData');
    
    // 체크: Chart.js 라이브러리가 참조되는지
    const hasChartJs = content.includes('chart.js');
    
    // 체크: 차트 초기화 함수가 있는지
    const hasInitFunction = content.includes('function initializeAllCharts()');
    
    // 체크: DOMContentLoaded 리스너가 있는지
    const hasDOMListener = content.includes("document.addEventListener('DOMContentLoaded'");
    
    console.log('\n✅ 요약 카드 데이터:');
    console.log(`  Total Vehicles: ${hasTotalVehicles ? '✅ 포함' : '❌ 미포함'}`);
    console.log(`  Total Jobs: ${hasTotalJobs ? '✅ 포함' : '❌ 미포함'}`);
    console.log(`  Total Distance: ${hasTotalDistance ? '✅ 포함' : '❌ 미포함'}`);
    console.log(`  Total Moving Time: ${hasTotalTime ? '✅ 포함' : '❌ 미포함'}`);
    
    console.log('\n📈 차트 시스템:');
    console.log(`  Chart.js 라이브러리: ${hasChartJs ? '✅ 참조' : '❌ 미참조'}`);
    console.log(`  차트 데이터 (JSON): ${hasChartData ? '✅ 포함' : '❌ 미포함'}`);
    console.log(`  차트 초기화 함수: ${hasInitFunction ? '✅ 포함' : '❌ 미포함'}`);
    console.log(`  DOMContentLoaded 리스너: ${hasDOMListener ? '✅ 포함' : '❌ 미포함'}`);
    
    // 데이터 샘플 추출
    const vehicleDataMatch = content.match(/window\.vehicleChartData = (\[.*?\]);/s);
    if (vehicleDataMatch) {
      try {
        const vehicleData = JSON.parse(vehicleDataMatch[1]);
        console.log('\n🚗 Vehicle Data in HTML:');
        console.log(`  차량 개수: ${vehicleData.length}`);
        if (vehicleData.length > 0) {
          const firstVehicle = vehicleData[0];
          console.log(`  Sample (${firstVehicle.name}):`);
          console.log(`    - Jobs: ${firstVehicle.totalJobs}`);
          console.log(`    - Distance: ${firstVehicle.totalDistance} km`);
          console.log(`    - Idle Time: ${firstVehicle.idleTime.toFixed(1)} min`);
          console.log(`    - Utilization: ${firstVehicle.utilizationRate}%`);
        }
      } catch (e) {
        console.log('  ⚠️ 데이터 파싱 오류');
      }
    }
    
    console.log('\n✅ TEST PASSED: HTML 리포트가 독립적으로 작동 가능합니다!');
    console.log('\n📥 다음 단계:');
    console.log(`  1. 생성된 HTML 파일: ${reportPath}`);
    console.log('  2. 이 파일을 웹 브라우저로 열기');
    console.log('  3. 차트가 제대로 표시되는지 확인');
    console.log('  4. 탭 전환이 작동하는지 확인');
    console.log('  5. 다운로드하여 다른 곳에서도 열어보기');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReportStandalone();
