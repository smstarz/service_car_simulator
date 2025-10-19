# 차량 상태 관리 시스템 설계

## 🎯 개요

시뮬레이션에서 차량의 실시간 상태를 관리하여, 배차 로직에서 적절한 차량만 선택할 수 있도록 합니다.

**시나리오**: 수요 위치로 이동 → 현장에서 작업 수행 → 완료

## 📊 차량 상태(State) 정의

### 상태 종류

```javascript
const VehicleState = {
  IDLE: 'idle',                     // 대기 중 (배차 가능)
  MOVING_TO_DEMAND: 'moving',       // 수요 위치로 이동 중
  WORKING: 'working',               // 작업 중 (service_time 처리)
  OUT_OF_SERVICE: 'out_of_service'  // 운영 종료 또는 고장
};
```

### 상태 전이 다이어그램

```
IDLE (대기)
  ↓ [배차 요청]
MOVING_TO_DEMAND (수요 위치로 이동)
  ↓ [현장 도착]
WORKING (작업 수행)
  ↓ [작업 완료]
IDLE (다시 대기)
```

## 🏗️ 차량 객체 구조

### Vehicle Object

```javascript
{
  // 기본 정보
  id: "vehicle_001",
  name: "Vehicle_1",
  
  // 위치 정보
  current_lng: 126.9780,
  current_lat: 37.5665,
  initial_lng: 126.9780,
  initial_lat: 37.5665,
  
  // 차량 속성
  job_type: "call",
  capacity: 4,
  
  // 상태 정보
  state: "idle",  // VehicleState 중 하나
  
  // 배차 정보
  assigned_demand: null,      // 현재 배차된 수요 객체
  assigned_demand_id: null,   // 수요 ID
  
  // 경로 정보
  current_route: null,        // 현재 이동 경로 (TMAP API 결과)
  target_location: null,      // 목표 위치 [lng, lat]
  route_start_time: null,     // 경로 시작 시간 (시뮬레이션 시간)
  estimated_arrival: null,    // 예상 도착 시간 (시뮬레이션 시간)
  
  // 서비스 시간
  service_start_time: null,   // 작업 시작 시간
  service_end_time: null,     // 작업 종료 예정 시간
  
  // 통계
  total_jobs: 0,              // 총 처리한 작업 수
  total_distance: 0,          // 총 이동 거리
  total_service_time: 0,      // 총 서비스 시간
  idle_time: 0                // 총 대기 시간
}
```

## 🔧 VehicleStateManager 클래스

차량 상태를 중앙에서 관리하는 매니저 클래스입니다.

### 주요 메서드

```javascript
class VehicleStateManager {
  constructor() {
    this.vehicles = new Map(); // vehicleId -> Vehicle object
  }
  
  // 차량 등록
  registerVehicle(vehicle);
  
  // 차량 상태 조회
  getVehicle(vehicleId);
  getVehicleState(vehicleId);
  
  // 배차 가능한 차량 필터링
  getAvailableVehicles();
  getIdleVehicles();
  
  // 상태 업데이트
  updateVehicleState(vehicleId, newState);
  updateVehicleLocation(vehicleId, lng, lat);
  
  // 배차 처리
  assignDemand(vehicleId, demand, route);
  startWork(vehicleId, serviceTime);
  completeWork(vehicleId);
  
  // 시뮬레이션 시간 업데이트
  updateSimulationTime(currentTime);
}
```

## 🚗 배차 로직 통합

### 배차 가능 조건

차량이 배차 가능하려면 다음 조건을 **모두** 만족해야 합니다:

1. ✅ 상태가 `IDLE`
2. ✅ `assigned_demand`가 `null`
3. ✅ Isochrone 폴리곤 내부에 위치
4. ✅ Job type이 수요와 일치

### DispatchEngine 수정

```javascript
// 배차 가능한 차량만 필터링
filterAvailableVehicles(vehicles) {
  return vehicles.filter(vehicle => {
    // 상태가 IDLE이 아니면 제외
    if (vehicle.state !== 'idle') {
      console.log(`   ✗ ${vehicle.name}: 상태 불가 (${vehicle.state})`);
      return false;
    }
    
    // 이미 배차된 수요가 있으면 제외
    if (vehicle.assigned_demand_id !== null) {
      console.log(`   ✗ ${vehicle.name}: 이미 배차됨 (${vehicle.assigned_demand_id})`);
      return false;
    }
    
    return true;
  });
}

// assignVehicle 메서드 수정
assignVehicle(demand, vehicles, polygonCoordinates) {
  // 0단계: 배차 가능한 차량만 먼저 필터링
  console.log(`\n0️⃣  배차 가능 차량 필터링:`);
  let candidateVehicles = this.filterAvailableVehicles(vehicles);
  console.log(`   → ${candidateVehicles.length}대 가능`);
  
  if (candidateVehicles.length === 0) {
    console.log(`   ❌ 배차 가능한 차량이 없습니다.`);
    return null;
  }
  
  // 기존 1-3단계 계속...
}
```

## 🔄 시뮬레이션 흐름

### 1. 초기화

```javascript
// 모든 차량을 IDLE 상태로 등록
vehicles.forEach(vehicle => {
  vehicle.state = VehicleState.IDLE;
  vehicle.assigned_demand = null;
  vehicle.assigned_demand_id = null;
  vehicleStateManager.registerVehicle(vehicle);
});
```

### 2. 수요 발생 시

```javascript
async function onDemandOccurrence(demand) {
  // 1. 배차 엔진 실행
  const result = await dispatchEngine.onDemandOccurrence(
    demand, 
    vehicleStateManager.getAvailableVehicles(), 
    projectConfig
  );
  
  if (result.assignedVehicle) {
    // 2. 차량 상태 업데이트
    const vehicle = result.assignedVehicle;
    
    // 3. TMAP API로 경로 계산
    const route = await tmapRouteService.getRoute(
      vehicle.current_lng, 
      vehicle.current_lat,
      demand.longitude,
      demand.latitude
    );
    
    // 4. 차량 상태를 MOVING_TO_DEMAND로 변경
    vehicleStateManager.assignDemand(vehicle.id, demand, route);
    
    // 5. 이벤트 기록
    recordEvent({
      timestamp: currentSimulationTime,
      type: 'dispatch',
      vehicleId: vehicle.id,
      demandId: demand.id,
      route: route
    });
  }
}
```

### 3. 시뮬레이션 시간 업데이트

```javascript
function updateSimulation(currentTime) {
  // 모든 차량의 상태 체크
  vehicleStateManager.vehicles.forEach(vehicle => {
    
    // MOVING_TO_DEMAND: 수요 위치 도착 체크
    if (vehicle.state === VehicleState.MOVING_TO_DEMAND) {
      if (currentTime >= vehicle.estimated_arrival) {
        // job_type.csv에서 해당 job의 service_time 가져오기
        const serviceTime = getServiceTime(vehicle.assigned_demand.job_type);
        vehicleStateManager.startWork(vehicle.id, serviceTime);
      }
    }
    
    // WORKING: 작업 완료 체크
    if (vehicle.state === VehicleState.WORKING) {
      if (currentTime >= vehicle.service_end_time) {
        vehicleStateManager.completeWork(vehicle.id);
        // 차량이 다시 IDLE 상태로 돌아감
      }
    }
  });
}
```

## 📈 장점

### 1. **명확한 상태 관리**
- 차량이 어떤 상태인지 한눈에 파악 가능
- 배차 로직에서 안전하게 차량 선택

### 2. **중앙화된 관리**
- VehicleStateManager가 모든 차량 상태를 관리
- 상태 변경 로직이 한 곳에 집중

### 3. **이벤트 추적 용이**
- 상태 전이마다 이벤트 기록
- 시뮬레이션 결과 분석 및 재생 가능

### 4. **확장성**
- 새로운 상태 추가 용이 (예: CHARGING, MAINTENANCE)
- 복잡한 시나리오 대응 가능

## 🔍 테스트 시나리오

### 시나리오 1: 정상 배차
```
1. Vehicle_1: IDLE
2. Demand 발생
3. Vehicle_1 배차 → MOVING_TO_DEMAND
4. 다른 Demand 발생
5. Vehicle_1은 필터링에서 제외됨 (state !== IDLE)
6. 다른 차량 배차
```

### 시나리오 2: 연속 작업 처리
```
1. Vehicle_1: IDLE
2. Demand_A 배차 → MOVING_TO_DEMAND → WORKING
3. 작업 완료 → IDLE
4. Demand_B 배차 가능
```

## 📝 구현 우선순위

1. ✅ **Phase 1**: VehicleState 상수 정의
2. ✅ **Phase 2**: VehicleStateManager 클래스 구현
3. ✅ **Phase 3**: DispatchEngine에 상태 필터링 추가
4. 📋 **Phase 4**: 시뮬레이션 엔진과 통합
5. 📋 **Phase 5**: 이벤트 기록 및 재생

---

이 설계를 통해 차량의 실시간 상태를 안전하고 효율적으로 관리할 수 있습니다.
