# VehicleStateManager 위치 정보 정규화 문제 해결

## 📋 문제 요약

sample-project-1에서 모든 수요가 rejected되는 문제 발생
- 수요와 차량이 매우 가까운 거리 (0.275 km ~ 1.857 km)
- Isochrone 폴리곤 내부에 차량이 위치
- Job Type도 일치
- **그럼에도 불구하고 배차 실패**

## 🔍 원인 분석

### 1차 문제: DispatchEngine의 필드명 불일치
이전에 해결한 문제:
- SimulationEngine: `location` 배열 사용
- DispatchEngine: `current_lng/current_lat` 사용
- **해결**: DispatchEngine이 여러 필드명 지원하도록 수정 ✅

### 2차 문제: VehicleStateManager의 위치 정보 손실
**근본 원인 발견:**

#### SimulationEngine에서 로드한 차량 객체
```javascript
{
  id: "vehicle_001",
  name: "Vehicle_1",
  location: [127.04428, 37.510775],        // ✅ 있음
  initialLocation: [127.04428, 37.510775], // ✅ 있음
  job_type: "call",
  state: "idle",
  // 아래 필드들은 없음
  current_lng: undefined,
  current_lat: undefined,
  start_longitude: undefined,
  start_latitude: undefined
}
```

#### VehicleStateManager의 registerVehicle (수정 전)
```javascript
registerVehicle(vehicle) {
  const enhancedVehicle = {
    ...vehicle,
    // 문제: location 배열을 처리하지 못함!
    initial_lng: vehicle.current_lng || vehicle.start_longitude,  // → undefined
    initial_lat: vehicle.current_lat || vehicle.start_latitude,   // → undefined
  };
}
```

#### 결과
- `initial_lng`: `undefined`
- `initial_lat`: `undefined`
- DispatchEngine이 위치를 찾을 수 없음
- **폴리곤 매칭 실패**
- **거리 계산 실패 (NaN)**
- **배차 불가**

### 문제 흐름 다이어그램
```
SimulationEngine (loadVehicles)
  → 차량 객체 생성 (location 배열만 있음)
    → VehicleStateManager.registerVehicle()
      → location 배열을 처리하지 못함
        → initial_lng/lat = undefined
          → DispatchEngine.assignVehicle()
            → filterVehiclesInPolygon()
              → 위치 정보 없음
                ❌ 배차 실패 (rejected)
```

## ✅ 해결 방안

### VehicleStateManager.registerVehicle() 수정

**변경 전:**
```javascript
registerVehicle(vehicle) {
  const enhancedVehicle = {
    ...vehicle,
    state: vehicle.state || VehicleState.IDLE,
    assigned_demand: null,
    assigned_demand_id: null,
    // ... 
    initial_lng: vehicle.current_lng || vehicle.start_longitude,
    initial_lat: vehicle.current_lat || vehicle.start_latitude
  };
}
```

**변경 후:**
```javascript
registerVehicle(vehicle) {
  // 초기 위치 추출 (여러 필드명 형식 지원)
  let initialLng, initialLat, currentLng, currentLat;
  
  if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
    // current_lng/current_lat 우선
    currentLng = vehicle.current_lng;
    currentLat = vehicle.current_lat;
    initialLng = vehicle.current_lng;
    initialLat = vehicle.current_lat;
  } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
    // location 배열 지원
    currentLng = vehicle.location[0];
    currentLat = vehicle.location[1];
    initialLng = vehicle.location[0];
    initialLat = vehicle.location[1];
  } else if (vehicle.start_longitude !== undefined && vehicle.start_latitude !== undefined) {
    // start_longitude/start_latitude 지원
    currentLng = vehicle.start_longitude;
    currentLat = vehicle.start_latitude;
    initialLng = vehicle.start_longitude;
    initialLat = vehicle.start_latitude;
  } else if (vehicle.initialLocation && Array.isArray(vehicle.initialLocation) && vehicle.initialLocation.length === 2) {
    // initialLocation 배열 지원
    currentLng = vehicle.initialLocation[0];
    currentLat = vehicle.initialLocation[1];
    initialLng = vehicle.initialLocation[0];
    initialLat = vehicle.initialLocation[1];
  }
  
  const enhancedVehicle = {
    ...vehicle,
    
    // 위치 정보 정규화
    current_lng: currentLng,
    current_lat: currentLat,
    initial_lng: initialLng,
    initial_lat: initialLat,
    
    // 나머지 필드...
  };
  
  console.log(`✅ 차량 등록: ${vehicle.name} at [${currentLng}, ${currentLat}] (상태: ${enhancedVehicle.state})`);
}
```

### 지원하는 위치 필드 우선순위

1. `current_lng` / `current_lat` (실시간 위치)
2. `location` 배열 `[lng, lat]` (SimulationEngine)
3. `start_longitude` / `start_latitude` (CSV 원본 필드명)
4. `initialLocation` 배열 (초기 위치)

## 🧪 테스트 결과

### 수정 전
```
✅ 차량 등록: Vehicle_1 (상태: idle)

📋 VehicleStateManager에서 가져온 차량 정보:
   1. Vehicle_1:
      - location: [127.04428, 37.510775]
      - current_lng: undefined         ❌
      - current_lat: undefined         ❌
      - initial_lng: undefined         ❌
      - initial_lat: undefined         ❌
      
→ 배차 실패: 위치 정보 없음
```

### 수정 후
```
✅ 차량 등록: Vehicle_1 at [127.04428, 37.510775] (상태: idle)

📋 VehicleStateManager에서 가져온 차량 정보:
   1. Vehicle_1:
      - location: [127.04428, 37.510775]
      - current_lng: 127.04428         ✅
      - current_lat: 37.510775         ✅
      - initial_lng: 127.04428         ✅
      - initial_lat: 37.510775         ✅

🔍 배차 프로세스:
   0️⃣  배차 가능 차량: 1대 ✅
   1️⃣  폴리곤 내부 차량: 1대 ✅
   2️⃣  Job Type 매칭: 1대 ✅
   3️⃣  최단 거리 차량 선택: Vehicle_1 (0.927 km) ✅

✅ 배차 완료: Vehicle_1
```

## 📊 sample-project-1 분석 결과

### 수요와 차량 거리
- 수요1 (vpGPNz): **0.927 km** - 배차 가능
- 수요3 (XYZ123): **0.275 km** - 배차 가능 (가장 가까움!)
- 수요2 (ABCDEF): **1.857 km** - 배차 가능

### Wait Time Limit
- 설정값: **20분**
- 모든 수요가 폴리곤 내부에 차량 위치

### 수정 전 결과
```
수요1: rejected ❌
수요3: rejected ❌
수요2: rejected ❌
```

### 수정 후 예상 결과
```
수요1 (12:10): assigned ✅ → 차량 이동 → 작업
수요3 (12:30): assigned ✅ (차량이 수요1 완료 후 배차 가능)
수요2 (12:50): assigned ✅ (차량이 수요3 완료 후 배차 가능)
```

## 🎯 결론

**문제:** VehicleStateManager가 `location` 배열 형식의 위치 정보를 처리하지 못함

**해결:** 
1. DispatchEngine: 여러 필드명 형식 지원 ✅
2. VehicleStateManager: 위치 정보 정규화 및 여러 형식 지원 ✅

**결과:** sample-project-1의 모든 수요에 대해 배차 가능

## 📁 수정된 파일

1. `services/dispatchEngine.js`
   - `filterVehiclesInPolygon()` - 여러 위치 필드 지원
   - `selectClosestVehicle()` - 여러 위치 필드 지원

2. `services/vehicleStateManager.js`
   - `registerVehicle()` - 위치 정보 정규화 및 여러 형식 지원

## 🔄 호환성

- CSV 원본 필드명 (`start_longitude/start_latitude`) ✅
- SimulationEngine 형식 (`location` 배열) ✅
- 실시간 위치 형식 (`current_lng/current_lat`) ✅
- 초기 위치 배열 (`initialLocation`) ✅

## 🧪 추가 테스트 파일

- `tests/analyze_sample_project1.js` - sample-project-1 상세 분석
