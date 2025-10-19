/**
 * Job Type 관리 모듈
 * job_type.csv 파일을 로드하고 service_time을 조회하는 기능 제공
 */

const fs = require('fs');
const path = require('path');

class JobTypeManager {
  constructor() {
    this.jobTypes = new Map(); // job_type -> { id, job, service_time }
    this.defaultServiceTime = 10; // 기본값: 10분
  }

  /**
   * Job Type CSV 파일 로드
   * @param {string} projectPath - 프로젝트 경로 (예: 'projects/default')
   */
  loadJobTypes(projectPath) {
    const csvPath = path.join(projectPath, 'job_type.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.warn(`⚠️  job_type.csv 파일을 찾을 수 없습니다: ${csvPath}`);
      console.warn(`   모든 job_type에 기본 service_time(${this.defaultServiceTime}분)을 사용합니다.`);
      return true; // 에러가 아님
    }

    try {
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        console.warn(`⚠️  job_type.csv 파일이 비어있습니다.`);
        console.warn(`   모든 job_type에 기본 service_time(${this.defaultServiceTime}분)을 사용합니다.`);
        return true; // 에러가 아님
      }

      // 헤더 파싱
      const headers = lines[0].split(',').map(h => h.trim());
      const idIndex = headers.indexOf('id');
      const jobIndex = headers.indexOf('job');
      const serviceTimeIndex = headers.indexOf('service_time');

      if (jobIndex === -1 || serviceTimeIndex === -1) {
        console.warn(`⚠️  job_type.csv에 필수 컬럼이 없습니다 (job, service_time)`);
        console.warn(`   모든 job_type에 기본 service_time(${this.defaultServiceTime}분)을 사용합니다.`);
        return true; // 에러가 아님
      }

      // 데이터 파싱
      let loadedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        
        const id = idIndex !== -1 ? values[idIndex] : null;
        const job = values[jobIndex];
        const serviceTime = parseInt(values[serviceTimeIndex], 10);

        if (job && !isNaN(serviceTime)) {
          this.jobTypes.set(job, {
            id: id,
            job: job,
            service_time: serviceTime
          });
          loadedCount++;
        }
      }

      if (loadedCount === 0) {
        console.warn(`⚠️  job_type.csv에서 유효한 데이터를 찾을 수 없습니다.`);
        console.warn(`   모든 job_type에 기본 service_time(${this.defaultServiceTime}분)을 사용합니다.`);
      } else {
        console.log(`✅ Job Type 로드 완료: ${loadedCount}개`);
        this.jobTypes.forEach((value, key) => {
          console.log(`   - ${key}: ${value.service_time}분`);
        });
      }

      return true;
    } catch (error) {
      console.warn(`⚠️  job_type.csv 로드 중 에러: ${error.message}`);
      console.warn(`   모든 job_type에 기본 service_time(${this.defaultServiceTime}분)을 사용합니다.`);
      return true; // 에러로 처리하지 않음
    }
  }

  /**
   * Job Type에 해당하는 service_time 조회 (분 단위)
   * @param {string} jobType - Job Type 이름
   * @returns {number} Service time in minutes
   */
  getServiceTime(jobType) {
    const jobInfo = this.jobTypes.get(jobType);
    
    if (jobInfo) {
      return jobInfo.service_time;
    } else {
      // 경고 없이 기본값만 반환 (너무 많은 로그 방지)
      return this.defaultServiceTime;
    }
  }

  /**
   * Job Type에 해당하는 service_time 조회 (초 단위)
   * @param {string} jobType - Job Type 이름
   * @returns {number} Service time in seconds
   */
  getServiceTimeInSeconds(jobType) {
    return this.getServiceTime(jobType) * 60;
  }

  /**
   * Job Type 정보 조회
   * @param {string} jobType - Job Type 이름
   * @returns {Object|null} Job type information
   */
  getJobTypeInfo(jobType) {
    return this.jobTypes.get(jobType) || null;
  }

  /**
   * 모든 Job Type 목록 조회
   * @returns {Array} Job types array
   */
  getAllJobTypes() {
    return Array.from(this.jobTypes.values());
  }

  /**
   * Job Type 존재 여부 확인
   * @param {string} jobType - Job Type 이름
   * @returns {boolean}
   */
  hasJobType(jobType) {
    return this.jobTypes.has(jobType);
  }

  /**
   * 기본 service_time 설정
   * @param {number} minutes - 기본 서비스 시간 (분)
   */
  setDefaultServiceTime(minutes) {
    this.defaultServiceTime = minutes;
    console.log(`✅ 기본 service_time 설정: ${minutes}분`);
  }

  /**
   * Job Type 데이터 초기화
   */
  clear() {
    this.jobTypes.clear();
    console.log('🔄 Job Type 데이터 초기화');
  }

  /**
   * 통계 정보
   */
  getStatistics() {
    const jobTypes = this.getAllJobTypes();
    const totalTypes = jobTypes.length;
    const avgServiceTime = totalTypes > 0
      ? jobTypes.reduce((sum, jt) => sum + jt.service_time, 0) / totalTypes
      : 0;

    return {
      totalTypes,
      avgServiceTime: avgServiceTime.toFixed(2),
      defaultServiceTime: this.defaultServiceTime
    };
  }
}

module.exports = JobTypeManager;
