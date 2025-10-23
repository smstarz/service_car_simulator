/**
 * 차량 상태 관리 모듈
 * 시뮬레이션에서 모든 차량의 실시간 상태를 중앙에서 관리
 * 
 * 시나리오: 수요 위치로 이동 → 작업 수행 → 완료
 */

const JobTypeManager = require('./jobTypeManager');

// 차량 상태 정의
const VehicleState = {
  IDLE: 'idle',                     // 대기 중 (배차 가능)
  MOVING_TO_DEMAND: 'moving',       // 수요 위치로 이동 중
  WORKING: 'working',               // 작업 중 (service_time 처리)
  OUT_OF_SERVICE: 'out_of_service'  // 운영 종료 또는 고장
};

class VehicleStateManager {
  constructor(projectPath = null) {
    this.vehicles = new Map(); // vehicleId -> Vehicle object
    this.currentSimulationTime = 0; // 현재 시뮬레이션 시간 (초)
    
    // Job Type Manager 초기화
    this.jobTypeManager = new JobTypeManager();
    if (projectPath) {
      this.jobTypeManager.loadJobTypes(projectPath);
    }
  }

  /**
   * 차량 등록
   * @param {Object} vehicle - 차량 객체
   */
  registerVehicle(vehicle) {
    // 초기 위치 추출 (여러 필드명 형식 지원)
    let initialLng, initialLat, currentLng, currentLat;
    
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      currentLng = vehicle.current_lng;
      currentLat = vehicle.current_lat;
      initialLng = vehicle.current_lng;
      initialLat = vehicle.current_lat;
    } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
      currentLng = vehicle.location[0];
      currentLat = vehicle.location[1];
      initialLng = vehicle.location[0];
      initialLat = vehicle.location[1];
    } else if (vehicle.start_longitude !== undefined && vehicle.start_latitude !== undefined) {
      currentLng = vehicle.start_longitude;
      currentLat = vehicle.start_latitude;
      initialLng = vehicle.start_longitude;
      initialLat = vehicle.start_latitude;
    } else if (vehicle.initialLocation && Array.isArray(vehicle.initialLocation) && vehicle.initialLocation.length === 2) {
      currentLng = vehicle.initialLocation[0];
      currentLat = vehicle.initialLocation[1];
      initialLng = vehicle.initialLocation[0];
      initialLat = vehicle.initialLocation[1];
    }
    
    // Job Type 파싱 (문자열을 배열로 변환)
    let jobTypes = [];
    if (Array.isArray(vehicle.job_type)) {
      jobTypes = vehicle.job_type;
    } else if (typeof vehicle.job_type === 'string') {
      // 세미콜론으로 구분된 복수 값을 배열로 파싱
      jobTypes = vehicle.job_type
        .split(';')
        .map(type => type.trim())
        .filter(type => type.length > 0);
    }
    
    // 차량 상태 초기화
    const enhancedVehicle = {
      ...vehicle,
      
      // 위치 정보 (정규화)
      current_lng: currentLng,
      current_lat: currentLat,
      initial_lng: initialLng,
      initial_lat: initialLat,
      
      // Job Type (배열로 정규화)
      job_type: jobTypes,
      
      // 상태 정보
      state: vehicle.state || VehicleState.IDLE,
      
      // 배차 정보
      assigned_demand: null,
      assigned_demand_id: null,
      
      // 경로 정보
      current_route: null,
      target_location: null,
      route_start_time: null,
      estimated_arrival: null,
      
      // 서비스 시간
      service_start_time: null,
      service_end_time: null,
      
      // 통계
      total_jobs: 0,              // 총 처리한 작업 수
      total_distance: 0,          // 총 이동 거리
      total_service_time: 0,      // 총 서비스 시간
      idle_time: 0               // 총 대기 시간
    };
    
    this.vehicles.set(vehicle.id || vehicle.name, enhancedVehicle);
    console.log(`✅ 차량 등록: ${vehicle.name} at [${currentLng}, ${currentLat}] (상태: ${enhancedVehicle.state}, job_type: ${jobTypes.join(', ')})`);
  }

  /**
   * 차량 조회
   */
  getVehicle(vehicleId) {
    return this.vehicles.get(vehicleId);
  }

  /**
   * 차량 상태 조회
   */
  getVehicleState(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    return vehicle ? vehicle.state : null;
  }

  /**
   * 모든 차량 조회
   */
  getAllVehicles() {
    return Array.from(this.vehicles.values());
  }

  /**
   * 배차 가능한 차량 필터링 (상태가 IDLE인 차량)
   */
  getAvailableVehicles() {
    return this.getAllVehicles().filter(vehicle => 
      vehicle.state === VehicleState.IDLE && 
      vehicle.assigned_demand_id === null
    );
  }

  /**
   * IDLE 상태 차량만 조회
   */
  getIdleVehicles() {
    return this.getAllVehicles().filter(vehicle => 
      vehicle.state === VehicleState.IDLE
    );
  }

  /**
   * 차량 상태 업데이트 (타임라인 기록 포함)
   * @param {string} vehicleId - 차량 ID
   * @param {string} newState - 새로운 상태
   * @param {number} timestamp - 현재 시뮬레이션 시간 (초)
   * @param {Object} eventData - 추가 이벤트 데이터 (선택)
   */
  updateVehicleState(vehicleId, newState, timestamp = null, eventData = {}) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    const oldState = vehicle.state;
    
    // 상태가 실제로 변경될 때만 처리
    if (oldState === newState && !eventData.force) {
      return true;
    }
    
    vehicle.state = newState;
    
    // 타임라인에 상태 변경 기록
    if (!vehicle.timeline) {
      vehicle.timeline = [];
    }
    
    const timelineEntry = {
      timestamp: timestamp !== null ? timestamp : this.currentSimulationTime,
      type: eventData.type || 'state_change',
      state: newState,
      location: vehicle.location || [vehicle.current_lng, vehicle.current_lat],
      ...eventData
    };
    
    vehicle.timeline.push(timelineEntry);
    
    console.log(`🔄 ${vehicle.name}: ${oldState} → ${newState} (time: ${timelineEntry.timestamp})`);
    return true;
  }

  /**
   * 차량 위치 업데이트
   */
  updateVehicleLocation(vehicleId, lng, lat) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    vehicle.current_lng = lng;
    vehicle.current_lat = lat;
    return true;
  }

  /**
   * 수요 배차 처리 (차량 상태를 MOVING으로 변경)
   * @param {string} vehicleId - 차량 ID
   * @param {string} demandId - 수요 ID
   * @param {Object} route - 경로 정보
   * @param {Array} targetLocation - 목적지 좌표 [lng, lat]
   * @param {number} timestamp - 현재 시뮬레이션 시간 (초)
   * @param {Object} additionalData - 추가 데이터
   */
  dispatchVehicle(vehicleId, demandId, route, targetLocation, timestamp, additionalData = {}) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    // 차량 배차 정보 업데이트
    vehicle.assigned_demand_id = demandId;
    vehicle.current_route = route;
    vehicle.route_start_time = timestamp;
    vehicle.estimated_arrival = timestamp + (route.duration || 0);
    vehicle.target_location = targetLocation;
    
    // location 배열도 업데이트
    if (!vehicle.location) {
      vehicle.location = [vehicle.current_lng, vehicle.current_lat];
    }
    
    // 상태를 MOVING으로 변경 (타임라인 기록 포함)
    this.updateVehicleState(vehicleId, VehicleState.MOVING_TO_DEMAND, timestamp, {
      type: 'demand_assigned',
      demandId: demandId,
      targetLocation: targetLocation,
      estimatedArrival: vehicle.estimated_arrival,
      ...additionalData
    });
    
    console.log(`🚗 ${vehicle.name} 배차됨: ${demandId} (ETA: ${vehicle.estimated_arrival})`);
    return true;
  }

  /**
   * 차량 도착 처리 (차량 상태를 WORKING으로 변경)
   * @param {string} vehicleId - 차량 ID
   * @param {number} timestamp - 현재 시뮬레이션 시간 (초)
   * @param {number} serviceTime - 서비스 시간 (초)
   */
  arriveAtDemand(vehicleId, timestamp, serviceTime) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    // 차량 위치를 목적지로 업데이트
    if (vehicle.target_location) {
      vehicle.location = [...vehicle.target_location];
      vehicle.current_lng = vehicle.target_location[0];
      vehicle.current_lat = vehicle.target_location[1];
    }
    
    // 서비스 시간 설정
    vehicle.service_start_time = timestamp;
    vehicle.service_end_time = timestamp + serviceTime;
    
    // 상태를 WORKING으로 변경 (타임라인 기록 포함)
    this.updateVehicleState(vehicleId, VehicleState.WORKING, timestamp, {
      type: 'arrived_at_demand',
      demandId: vehicle.assigned_demand_id,
      location: vehicle.location,
      serviceTime: serviceTime,
      estimatedCompletion: vehicle.service_end_time
    });
    
    // 통계 업데이트: 이동 거리 및 시간
    if (vehicle.current_route) {
      vehicle.total_distance += (vehicle.current_route.distance || 0) / 1000; // km로 변환
      const movingTime = timestamp - vehicle.route_start_time;
      if (!vehicle.statistics) {
        vehicle.statistics = { moving_time: 0, working_time: 0, idle_time: 0, total_distance: 0 };
      }
      vehicle.statistics.moving_time = (vehicle.statistics.moving_time || 0) + movingTime;
      vehicle.statistics.total_distance = vehicle.total_distance; // statistics에도 반영
    }
    
    console.log(`✅ ${vehicle.name} 도착: ${vehicle.assigned_demand_id}`);
    return true;
  }

  /**
   * 작업 완료 처리 (차량 상태를 IDLE로 변경)
   * @param {string} vehicleId - 차량 ID
   * @param {number} timestamp - 현재 시뮬레이션 시간 (초)
   */
  completeWork(vehicleId, timestamp) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    const serviceTime = vehicle.service_end_time - vehicle.service_start_time;
    
    // 통계 업데이트
    vehicle.total_jobs = (vehicle.total_jobs || 0) + 1;
    vehicle.total_service_time = (vehicle.total_service_time || 0) + serviceTime;
    
    if (!vehicle.statistics) {
      vehicle.statistics = { total_jobs: 0, working_time: 0, moving_time: 0, idle_time: 0, total_distance: 0 };
    }
    vehicle.statistics.total_jobs = vehicle.total_jobs;
    vehicle.statistics.working_time = (vehicle.statistics.working_time || 0) + serviceTime;
    vehicle.statistics.total_distance = vehicle.total_distance; // statistics에도 반영
    
    const completedDemandId = vehicle.assigned_demand_id;
    
    // 배차 정보 초기화
    vehicle.assigned_demand_id = null;
    vehicle.current_route = null;
    vehicle.route_start_time = null;
    vehicle.estimated_arrival = null;
    vehicle.target_location = null;
    vehicle.service_start_time = null;
    vehicle.service_end_time = null;
    
    // 상태를 IDLE로 변경 (타임라인 기록 포함)
    this.updateVehicleState(vehicleId, VehicleState.IDLE, timestamp, {
      type: 'work_completed',
      demandId: completedDemandId,
      location: vehicle.location
    });
    
    console.log(`🎉 ${vehicle.name} 작업 완료: ${completedDemandId} (총 ${vehicle.total_jobs}건)`);
    return true;
  }

  /**
   * 수요 배차 처리 (레거시 메서드 - 호환성 유지)
   * @param {string} vehicleId - 차량 ID
   * @param {Object} demand - 수요 객체
   * @param {Object} route - 경로 정보 (TMAP API 결과)
   */
  assignDemand(vehicleId, demand, route) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      console.error(`❌ 차량을 찾을 수 없음: ${vehicleId}`);
      return false;
    }
    
    if (vehicle.state !== VehicleState.IDLE) {
      console.error(`❌ 차량이 배차 가능 상태가 아님: ${vehicle.name} (${vehicle.state})`);
      return false;
    }
    
    // 배차 정보 설정
    vehicle.assigned_demand = demand;
    vehicle.assigned_demand_id = demand.id || demand.call_id;
    vehicle.current_route = route;
    vehicle.target_location = [demand.longitude || demand.origin_lng, demand.latitude || demand.origin_lat];
    vehicle.route_start_time = this.currentSimulationTime;
    
    // 경로 시작 위치 저장
    vehicle.route_start_location = [vehicle.current_lng, vehicle.current_lat];
    
    // 예상 도착 시간 계산 (초 단위)
    if (route && route.features && route.features[0]) {
      const duration = route.features[0].properties.totalTime; // 초
      vehicle.estimated_arrival = this.currentSimulationTime + duration;
    }
    
    // 상태 변경
    vehicle.state = VehicleState.MOVING_TO_DEMAND;
    
    console.log(`📦 배차 완료: ${vehicle.name} → Demand ${vehicle.assigned_demand_id}`);
    console.log(`   예상 도착: ${vehicle.estimated_arrival}초 (${Math.round(vehicle.estimated_arrival / 60)}분)`);
    
    return true;
  }

  /**
   * 작업 시작 (현장 도착, 작업 수행 중)
   * @param {string} vehicleId - 차량 ID
   * @param {number} serviceTime - 서비스 시간 (초)
   */
  startWork(vehicleId, serviceTime = 30) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return false;
    
    vehicle.state = VehicleState.WORKING;
    vehicle.service_start_time = this.currentSimulationTime;
    vehicle.service_end_time = this.currentSimulationTime + serviceTime;
    
    // 차량 위치를 작업 지점으로 업데이트
    if (vehicle.target_location) {
      vehicle.current_lng = vehicle.target_location[0];
      vehicle.current_lat = vehicle.target_location[1];
    }
    
    console.log(`� 작업 시작: ${vehicle.name} (완료 예정: ${vehicle.service_end_time}초)`);
    return true;
  }

  /**
   * 작업 완료 (차량이 다시 IDLE 상태로) - DEPRECATED
   * @deprecated 새로운 completeWork(vehicleId, timestamp) 메서드를 사용하세요
   */
  _legacyCompleteWork(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return false;
    
    vehicle.state = VehicleState.IDLE;
    vehicle.total_jobs += 1;
    
    // 서비스 시간 통계 업데이트
    if (vehicle.service_start_time && vehicle.service_end_time) {
      const serviceTime = vehicle.service_end_time - vehicle.service_start_time;
      vehicle.total_service_time += serviceTime;
    }
    
    // 배차 정보 초기화
    const completedDemandId = vehicle.assigned_demand_id;
    vehicle.assigned_demand = null;
    vehicle.assigned_demand_id = null;
    vehicle.current_route = null;
    vehicle.target_location = null;
    vehicle.route_start_time = null;
    vehicle.estimated_arrival = null;
    vehicle.service_start_time = null;
    vehicle.service_end_time = null;
    
    console.log(`✅ 작업 완료: ${vehicle.name} → IDLE (총 ${vehicle.total_jobs}건 처리)`);
    console.log(`   완료된 수요: ${completedDemandId}`);
    
    return true;
  }

  /**
   * TMAP Route 구간별 정보를 기반으로 차량 위치 보간
   * @param {Object} vehicle - 차량 객체
   * @param {number} currentTime - 현재 시뮬레이션 시간
   * @returns {Array} [lng, lat] 현재 위치
   */
  interpolateVehiclePosition(vehicle, currentTime) {
    // IDLE 또는 WORKING 상태면 현재 위치 그대로 반환
    if (vehicle.state === VehicleState.IDLE || 
        vehicle.state === VehicleState.WORKING) {
      return [vehicle.current_lng, vehicle.current_lat];
    }
    
    // MOVING_TO_DEMAND 상태가 아니면 현재 위치 반환
    if (vehicle.state !== VehicleState.MOVING_TO_DEMAND || !vehicle.current_route) {
      return [vehicle.current_lng, vehicle.current_lat];
    }
    
    const startTime = vehicle.route_start_time;
    const elapsed = currentTime - startTime;
    
    if (elapsed <= 0) {
      // 아직 출발 전
      return [vehicle.current_lng, vehicle.current_lat];
    }
    
    // TMAP Route features에서 구간 정보 추출
    const route = vehicle.current_route;
    if (!route.features || route.features.length === 0) {
      // 경로 정보 없으면 직선 보간
      return this.linearInterpolation(vehicle, currentTime);
    }
    
    // 각 구간(Feature)의 시간과 좌표를 누적하여 계산
    const segments = this.buildRouteSegments(route.features);
    
    // 경과 시간으로 현재 위치 찾기
    return this.findPositionAtTime(segments, elapsed);
  }
  
  /**
   * TMAP Route features를 구간 배열로 변환
   * @param {Array} features - TMAP route features
   * @returns {Array} 구간 정보 배열
   */
  buildRouteSegments(features) {
    const segments = [];
    let cumulativeTime = 0;
    
    features.forEach((feature, featureIndex) => {
      if (!feature.geometry || !feature.geometry.coordinates) {
        return;
      }
      
      const coords = feature.geometry.coordinates;
      const segmentTime = feature.properties.time || 0; // 초
      const segmentDistance = feature.properties.distance || 0; // 미터
      
      if (coords.length < 2) {
        return;
      }
      
      // 구간 내 세부 포인트들
      const points = coords.map((coord, pointIndex) => ({
        lng: coord[0],
        lat: coord[1],
        pointIndex: pointIndex
      }));
      
      segments.push({
        featureIndex: featureIndex,
        name: feature.properties.name || '',
        startTime: cumulativeTime,
        endTime: cumulativeTime + segmentTime,
        duration: segmentTime,
        distance: segmentDistance,
        points: points,
        startPoint: points[0],
        endPoint: points[points.length - 1]
      });
      
      cumulativeTime += segmentTime;
    });
    
    return segments;
  }
  
  /**
   * 경과 시간에 해당하는 위치 찾기
   * @param {Array} segments - 구간 배열
   * @param {number} elapsedTime - 경과 시간 (초)
   * @returns {Array} [lng, lat]
   */
  findPositionAtTime(segments, elapsedTime) {
    if (segments.length === 0) {
      return [0, 0];
    }
    
    // 해당 시간이 속한 구간 찾기
    for (let segment of segments) {
      if (elapsedTime >= segment.startTime && elapsedTime < segment.endTime) {
        // 구간 내 진행률 계산
        const segmentProgress = (elapsedTime - segment.startTime) / segment.duration;
        
        // 구간 내 포인트들 사이를 보간
        return this.interpolateWithinSegment(segment, segmentProgress);
      }
    }
    
    // 마지막 구간을 넘어선 경우 마지막 위치 반환
    const lastSegment = segments[segments.length - 1];
    return [lastSegment.endPoint.lng, lastSegment.endPoint.lat];
  }
  
  /**
   * 구간 내에서 위치 보간
   * @param {Object} segment - 구간 정보
   * @param {number} progress - 진행률 (0.0 ~ 1.0)
   * @returns {Array} [lng, lat]
   */
  interpolateWithinSegment(segment, progress) {
    const points = segment.points;
    
    if (points.length === 1) {
      return [points[0].lng, points[0].lat];
    }
    
    if (points.length === 2) {
      // 두 점 사이 직선 보간
      return [
        points[0].lng + (points[1].lng - points[0].lng) * progress,
        points[0].lat + (points[1].lat - points[0].lat) * progress
      ];
    }
    
    // 여러 포인트가 있는 경우: 거리 기반 보간
    const distances = [];
    let totalDistance = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
      const dist = this.calculateDistanceBetweenPoints(
        points[i].lng, points[i].lat,
        points[i + 1].lng, points[i + 1].lat
      );
      distances.push(dist);
      totalDistance += dist;
    }
    
    // 목표 거리
    const targetDistance = totalDistance * progress;
    let accumulatedDistance = 0;
    
    // 해당하는 선분 찾기
    for (let i = 0; i < distances.length; i++) {
      if (targetDistance <= accumulatedDistance + distances[i]) {
        const segmentProgress = (targetDistance - accumulatedDistance) / distances[i];
        return [
          points[i].lng + (points[i + 1].lng - points[i].lng) * segmentProgress,
          points[i].lat + (points[i + 1].lat - points[i].lat) * segmentProgress
        ];
      }
      accumulatedDistance += distances[i];
    }
    
    // 마지막 포인트 반환
    return [points[points.length - 1].lng, points[points.length - 1].lat];
  }
  
  /**
   * 두 점 사이의 거리 계산 (간단한 유클리드 거리)
   */
  calculateDistanceBetweenPoints(lng1, lat1, lng2, lat2) {
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    return Math.sqrt(dLng * dLng + dLat * dLat);
  }
  
  /**
   * 직선 보간 (경로 정보 없을 때)
   */
  linearInterpolation(vehicle, currentTime) {
    const startTime = vehicle.route_start_time;
    const endTime = vehicle.estimated_arrival;
    const elapsed = currentTime - startTime;
    const totalDuration = endTime - startTime;
    
    if (elapsed >= totalDuration) {
      return vehicle.target_location;
    }
    
    const progress = elapsed / totalDuration;
    const startPos = vehicle.route_start_location || [vehicle.current_lng, vehicle.current_lat];
    const endPos = vehicle.target_location;
    
    return [
      startPos[0] + (endPos[0] - startPos[0]) * progress,
      startPos[1] + (endPos[1] - startPos[1]) * progress
    ];
  }
  
  /**
   * 모든 차량의 현재 위치 업데이트
   * @param {number} currentTime - 현재 시뮬레이션 시간
   */
  updateAllVehiclePositions(currentTime) {
    this.vehicles.forEach(vehicle => {
      const newPosition = this.interpolateVehiclePosition(vehicle, currentTime);
      vehicle.current_lng = newPosition[0];
      vehicle.current_lat = newPosition[1];
    });
  }
  
  /**
   * 자동 상태 전이 처리 (DEPRECATED - SimulationEngine에서 처리)
   * @param {number} currentTime - 현재 시뮬레이션 시간
   * @deprecated 이제 SimulationEngine.checkVehicleStateChanges()에서 처리합니다.
   */
  updateVehicleStates(currentTime) {
    // SimulationEngine에서 직접 arriveAtDemand() 및 completeWork()를 호출하므로
    // 이 메서드는 더 이상 사용되지 않습니다.
    // 호환성을 위해 메서드는 유지하되, 로직은 비활성화합니다.
    
    /* DEPRECATED CODE - 주석 처리
    this.vehicles.forEach(vehicle => {
      
      // MOVING_TO_DEMAND → WORKING (도착)
      if (vehicle.state === VehicleState.MOVING_TO_DEMAND) {
        if (currentTime >= vehicle.estimated_arrival) {
          console.log(`🎯 ${vehicle.name} 현장 도착`);
          this.startWork(vehicle.id || vehicle.name);
        }
      }
      
      // WORKING → IDLE (작업 완료)
      else if (vehicle.state === VehicleState.WORKING) {
        if (currentTime >= vehicle.service_end_time) {
          console.log(`🏁 ${vehicle.name} 작업 완료`);
          this.completeWork(vehicle.id || vehicle.name);
        }
      }
    });
    */
  }

  /**
   * Job Type의 service_time 조회 (초 단위)
   * @param {string} jobType - Job Type 이름
   * @returns {number} Service time in seconds
   */
  getServiceTime(jobType) {
    return this.jobTypeManager.getServiceTimeInSeconds(jobType);
  }

  /**
   * 시뮬레이션 시간 업데이트 (통합)
   * @param {number} currentTime - 현재 시뮬레이션 시간 (초)
   */
  updateSimulationTime(currentTime) {
    this.currentSimulationTime = currentTime;
    
    // 자동으로 차량 위치 업데이트 (실시간 보간)
    this.updateAllVehiclePositions(currentTime);
    
    // 자동으로 상태 전이
    this.updateVehicleStates(currentTime);
  }

  /**
   * 통계 조회
   */
  getStatistics() {
    const vehicles = this.getAllVehicles();
    const totalVehicles = vehicles.length;
    const idleVehicles = vehicles.filter(v => v.state === VehicleState.IDLE).length;
    const busyVehicles = totalVehicles - idleVehicles;
    const totalJobs = vehicles.reduce((sum, v) => sum + v.total_jobs, 0);
    
    return {
      totalVehicles,
      idleVehicles,
      busyVehicles,
      totalJobs,
      utilizationRate: totalVehicles > 0 ? (busyVehicles / totalVehicles * 100).toFixed(2) : 0
    };
  }

  /**
   * 상태별 차량 수 조회
   */
  getStateDistribution() {
    const distribution = {};
    Object.values(VehicleState).forEach(state => {
      distribution[state] = 0;
    });
    
    this.getAllVehicles().forEach(vehicle => {
      distribution[vehicle.state] = (distribution[vehicle.state] || 0) + 1;
    });
    
    return distribution;
  }

  /**
   * 리셋 (테스트용)
   */
  reset() {
    this.vehicles.clear();
    this.currentSimulationTime = 0;
    console.log('🔄 VehicleStateManager 리셋 완료');
  }
}

module.exports = { VehicleStateManager, VehicleState };
