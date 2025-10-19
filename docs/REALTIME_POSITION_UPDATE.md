# 차량 실시간 상태 및 위치 관리 개선안

## 🎯 목표

차량이 이동 중일 때 실시간으로 현재 위치를 보간(interpolate)하고, 자동으로 상태를 전이시킵니다.

## 📊 현재 문제

### 1. 위치 업데이트 부재
- 차량이 `MOVING_TO_DEMAND` 상태일 때 위치가 업데이트되지 않음
- 목적지 도착 시에만 순간이동식으로 위치 변경

### 2. 상태 전이 부재
- 시뮬레이션 시간이 흘러도 상태가 자동으로 변경되지 않음
- 수동으로 `startWork()`, `completeWork()` 호출 필요

## 🔧 개선 방안

### 방법 1: 이벤트 기반 (현재 방식 + 보간 추가)

```javascript
class VehicleStateManager {
  /**
   * 차량의 현재 위치를 경로 기반으로 보간
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
    
    // MOVING_TO_DEMAND 상태면 경로 기반 보간
    if (vehicle.state === VehicleState.MOVING_TO_DEMAND && vehicle.current_route) {
      const startTime = vehicle.route_start_time;
      const endTime = vehicle.estimated_arrival;
      const elapsed = currentTime - startTime;
      const totalDuration = endTime - startTime;
      
      if (elapsed <= 0) {
        // 아직 출발 전
        return [vehicle.current_lng, vehicle.current_lat];
      }
      
      if (elapsed >= totalDuration) {
        // 이미 도착
        return vehicle.target_location;
      }
      
      // 진행률 계산 (0.0 ~ 1.0)
      const progress = elapsed / totalDuration;
      
      // 경로 geometry를 따라 보간
      if (vehicle.current_route.features && 
          vehicle.current_route.features[0] &&
          vehicle.current_route.features[0].geometry) {
        
        const coords = vehicle.current_route.features[0].geometry.coordinates;
        return this.interpolateAlongPath(coords, progress);
      }
      
      // 경로 정보 없으면 직선 보간
      const startPos = [vehicle.current_lng, vehicle.current_lat];
      const endPos = vehicle.target_location;
      
      return [
        startPos[0] + (endPos[0] - startPos[0]) * progress,
        startPos[1] + (endPos[1] - startPos[1]) * progress
      ];
    }
    
    return [vehicle.current_lng, vehicle.current_lat];
  }
  
  /**
   * 경로 좌표 배열을 따라 위치 보간
   * @param {Array} coordinates - 경로 좌표 배열 [[lng, lat], ...]
   * @param {number} progress - 진행률 (0.0 ~ 1.0)
   * @returns {Array} [lng, lat]
   */
  interpolateAlongPath(coordinates, progress) {
    if (coordinates.length < 2) {
      return coordinates[0] || [0, 0];
    }
    
    // 전체 경로 길이 계산
    let totalDistance = 0;
    const segments = [];
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const segmentDist = this.calculateDistance(
        coordinates[i][0], coordinates[i][1],
        coordinates[i + 1][0], coordinates[i + 1][1]
      );
      segments.push({
        start: coordinates[i],
        end: coordinates[i + 1],
        distance: segmentDist,
        cumulativeDistance: totalDistance + segmentDist
      });
      totalDistance += segmentDist;
    }
    
    // 목표 거리
    const targetDistance = totalDistance * progress;
    
    // 해당 세그먼트 찾기
    for (let segment of segments) {
      if (targetDistance <= segment.cumulativeDistance) {
        const segmentStart = segment.cumulativeDistance - segment.distance;
        const segmentProgress = (targetDistance - segmentStart) / segment.distance;
        
        // 세그먼트 내에서 보간
        return [
          segment.start[0] + (segment.end[0] - segment.start[0]) * segmentProgress,
          segment.start[1] + (segment.end[1] - segment.start[1]) * segmentProgress
        ];
      }
    }
    
    // 마지막 지점 반환
    return coordinates[coordinates.length - 1];
  }
  
  /**
   * Haversine 거리 계산
   */
  calculateDistance(lng1, lat1, lng2, lat2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  /**
   * 모든 차량의 현재 위치 업데이트 (실시간)
   * 시뮬레이션 메인 루프에서 매 프레임 호출
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
   * 자동 상태 전이 처리
   * 시뮬레이션 메인 루프에서 매 프레임 호출
   * @param {number} currentTime - 현재 시뮬레이션 시간
   */
  updateVehicleStates(currentTime) {
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
  }
  
  /**
   * 시뮬레이션 시간 업데이트 (통합)
   * @param {number} currentTime - 현재 시뮬레이션 시간
   */
  updateSimulationTime(currentTime) {
    this.currentSimulationTime = currentTime;
    
    // 자동으로 차량 위치 및 상태 업데이트
    this.updateAllVehiclePositions(currentTime);
    this.updateVehicleStates(currentTime);
  }
}
```

### 사용 예시

```javascript
// 시뮬레이션 메인 루프
function runSimulation() {
  const startTime = 0;
  const endTime = 3600; // 1시간
  const timeStep = 1; // 1초 단위
  
  for (let currentTime = startTime; currentTime <= endTime; currentTime += timeStep) {
    // 시뮬레이션 시간 업데이트 (자동으로 위치 보간 + 상태 전이)
    vehicleStateManager.updateSimulationTime(currentTime);
    
    // 현재 시간에 발생하는 수요 처리
    const demands = getDemandsAtTime(currentTime);
    demands.forEach(demand => {
      dispatchEngine.onDemandOccurrence(demand, vehicleStateManager, projectConfig);
    });
    
    // 시각화 업데이트 (선택적)
    if (currentTime % 10 === 0) { // 10초마다
      renderVehiclesOnMap(vehicleStateManager.getAllVehicles());
    }
  }
}
```

## 📈 개선 효과

### Before (현재)
```
시간 0초: Vehicle_1 @ [126.978, 37.566] (idle)
시간 0초: 배차 완료 → moving
시간 150초: Vehicle_1 @ [126.978, 37.566] ❌ (여전히 출발점!)
시간 300초: Vehicle_1 @ [126.984, 37.467] ⚡ (순간이동!)
```

### After (개선안)
```
시간 0초: Vehicle_1 @ [126.978, 37.566] (idle)
시간 0초: 배차 완료 → moving
시간 150초: Vehicle_1 @ [126.981, 37.517] ✅ (경로 중간!)
시간 300초: Vehicle_1 @ [126.984, 37.467] ✅ (자동 도착 → working)
시간 1200초: Vehicle_1 @ [126.984, 37.467] ✅ (자동 완료 → idle)
```

## 🎯 구현 우선순위

1. ✅ **Phase 1**: `interpolateVehiclePosition()` - 직선 보간
2. ✅ **Phase 2**: `interpolateAlongPath()` - 경로 기반 보간
3. ✅ **Phase 3**: `updateVehicleStates()` - 자동 상태 전이
4. ✅ **Phase 4**: `updateSimulationTime()` 통합
5. 📋 **Phase 5**: 시뮬레이션 엔진과 통합

## 💡 추가 고려사항

### 1. 성능 최적화
- 매 초마다 모든 차량 위치 계산은 비용이 큼
- 옵션: IDLE/WORKING 차량은 계산 스킵
- 옵션: 변경된 차량만 업데이트

### 2. 정확도 vs 성능
- **높은 정확도**: 경로 geometry를 따라 보간 (느림)
- **빠른 속도**: 직선 보간 (빠름, 덜 정확)

### 3. 이벤트 기록
- 위치 변경 시 이벤트 기록 여부
- 재생 시 보간 vs 기록된 위치 사용

---

이 구조를 적용하면 차량의 상태와 위치가 시뮬레이션 시간에 따라 **자동으로 실시간 업데이트**됩니다!
