# 배차 엔진 폴리곤 매칭 문제 해결 보고서

## 📋 문제 요약

샘플 프로젝트에서 수요 부근에 차량의 시작 지점을 위치시켰는데도 배차가 실패하는 문제 발생

## 🔍 원인 분석

### 발견된 핵심 문제

**차량 위치 데이터 필드명 불일치**

1. **SimulationEngine에서 차량 로드 시**
   ```javascript
   // services/simulationEngine.js (loadVehicles 메서드)
   {
     id: `vehicle_${String(index + 1).padStart(3, '0')}`,
     name: name,
     location: [parseFloat(lng), parseFloat(lat)],  // ← location 배열 사용
     job_type: job_type,
     state: 'idle'
   }
   ```

2. **DispatchEngine에서 차량 위치 접근 시**
   ```javascript
   // services/dispatchEngine.js (filterVehiclesInPolygon, selectClosestVehicle)
   const vehiclePoint = [vehicle.current_lng, vehicle.current_lat];  // ← current_lng/lat 사용
   ```

3. **결과**
   - `vehicle.current_lng` → `undefined`
   - `vehicle.current_lat` → `undefined`
   - 폴리곤 매칭 실패
   - 거리 계산 실패 (`NaN`)
   - **배차 불가**

### 실제 데이터 구조 검증

#### sample-project-1/vehicle_set.csv
```csv
name,start_latitude,start_longitude,job_type
Vehicle_1,37.510775,127.044280,call
```

#### 로드된 차량 객체
```javascript
{
  id: "vehicle_001",
  name: "Vehicle_1",
  location: [127.04428, 37.510775],      // ✅ 존재
  initialLocation: [127.04428, 37.510775], // ✅ 존재
  current_lng: undefined,                  // ❌ 없음!
  current_lat: undefined,                  // ❌ 없음!
  job_type: "call",
  state: "idle"
}
```

#### sample-project-1/demand_data.csv
```csv
id,address,longitude,latitude,time,job_type,result,vehicle,distance,arrived_time,complete_time
vpGPNz,수요1,127.037562,37.517183,12:10:00,call,,,,,
```

#### 거리 분석
- 차량 위치: `[127.044280, 37.510775]`
- 수요 위치: `[127.037562, 37.517183]`
- 직선 거리: **0.927 km**
- Wait Time Limit: **10분**
- **이론적으로 배차 가능한 거리**

## ✅ 해결 방안

### 수정된 코드

#### 1. `filterVehiclesInPolygon()` 메서드 수정

**변경 전:**
```javascript
filterVehiclesInPolygon(vehicles, polygonCoordinates) {
  const outerRing = polygonCoordinates[0];
  
  return vehicles.filter(vehicle => {
    const vehiclePoint = [vehicle.current_lng, vehicle.current_lat];
    const isInside = this.isPointInPolygon(vehiclePoint, outerRing);
    return isInside;
  });
}
```

**변경 후:**
```javascript
filterVehiclesInPolygon(vehicles, polygonCoordinates) {
  const outerRing = polygonCoordinates[0];
  
  return vehicles.filter(vehicle => {
    // 차량 위치 가져오기 (여러 필드명 지원)
    let lng, lat;
    
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      lng = vehicle.current_lng;
      lat = vehicle.current_lat;
    } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
      lng = vehicle.location[0];
      lat = vehicle.location[1];
    } else if (vehicle.initial_lng !== undefined && vehicle.initial_lat !== undefined) {
      lng = vehicle.initial_lng;
      lat = vehicle.initial_lat;
    } else {
      console.log(`   ✗ ${vehicle.name}: 위치 정보 없음`);
      return false;
    }
    
    const vehiclePoint = [lng, lat];
    const isInside = this.isPointInPolygon(vehiclePoint, outerRing);
    
    if (isInside) {
      console.log(`   ✓ ${vehicle.name}: 폴리곤 내부 [${lng.toFixed(6)}, ${lat.toFixed(6)}]`);
    }
    
    return isInside;
  });
}
```

#### 2. `selectClosestVehicle()` 메서드 수정

**변경 전:**
```javascript
selectClosestVehicle(vehicles, demand) {
  vehicles.forEach(vehicle => {
    const distance = this.calculateDistance(
      demand.origin_lng,
      demand.origin_lat,
      vehicle.current_lng,
      vehicle.current_lat
    );
    // ...
  });
}
```

**변경 후:**
```javascript
selectClosestVehicle(vehicles, demand) {
  vehicles.forEach(vehicle => {
    // 차량 위치 가져오기 (여러 필드명 지원)
    let lng, lat;
    
    if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
      lng = vehicle.current_lng;
      lat = vehicle.current_lat;
    } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
      lng = vehicle.location[0];
      lat = vehicle.location[1];
    } else if (vehicle.initial_lng !== undefined && vehicle.initial_lat !== undefined) {
      lng = vehicle.initial_lng;
      lat = vehicle.initial_lat;
    } else {
      console.log(`   ✗ ${vehicle.name}: 위치 정보 없음`);
      return;
    }
    
    const distance = this.calculateDistance(
      demand.origin_lng,
      demand.origin_lat,
      lng,
      lat
    );
    // ...
  });
}
```

### 지원되는 필드명 우선순위

1. `current_lng` / `current_lat` (실시간 위치)
2. `location` 배열 `[lng, lat]` (시뮬레이션 엔진에서 사용)
3. `initial_lng` / `initial_lat` (초기 위치)

## 🧪 테스트 결과

### 수정 전
```
1️⃣  폴리곤 내부 차량 탐색:
   → 0대 발견  ❌
   ❌ 폴리곤 내부에 배차 가능한 차량이 없습니다.
```

### 수정 후
```
1️⃣  폴리곤 내부 차량 탐색:
   ✓ Vehicle_1: 폴리곤 내부 [127.044280, 37.510775]
   → 1대 발견  ✅

2️⃣  Job type 매칭 (요구: call):
   ✓ Vehicle_1: job_type 일치 (call)
   → 1대 매칭  ✅

3️⃣  최단 거리 차량 선택:
   📏 Vehicle_1: 0.927 km

✅ 배차 완료: Vehicle_1
   거리: 0.927 km
```

## 📊 검증 완료 사항

### ✅ Isochrone 생성
- Wait Time Limit 값으로 정확한 폴리곤 생성
- Mapbox API 정상 작동
- GeoJSON 구조 유효

### ✅ 폴리곤 매칭
- Ray Casting 알고리즘 정상 작동
- `location` 배열 기반 위치 매칭 성공
- 다양한 필드명 지원으로 호환성 확보

### ✅ 배차 프로세스
- 0단계: 배차 가능 차량 필터링 (상태 체크) ✅
- 1단계: 폴리곤 내부 차량 탐색 ✅
- 2단계: Job Type 매칭 ✅
- 3단계: 최단 거리 차량 선택 ✅

## 🎯 결론

**문제:** 차량 위치 데이터 필드명 불일치로 인한 폴리곤 매칭 실패

**해결:** DispatchEngine이 여러 필드명 형식을 지원하도록 수정
- `current_lng/current_lat`
- `location` 배열
- `initial_lng/initial_lat`

**결과:** sample-project-1에서 배차 성공 확인

## 📁 수정된 파일

- `services/dispatchEngine.js`
  - `filterVehiclesInPolygon()` 메서드
  - `selectClosestVehicle()` 메서드

## 🧪 추가된 테스트 파일

- `tests/test_isochrone_generation.js` - Isochrone 생성 검증
- `tests/test_vehicle_location_matching.js` - 위치 데이터 구조 검증
- `tests/test_integrated_dispatch.js` - 통합 배차 테스트
- `tests/test_dispatch_full_process.js` - 전체 프로세스 테스트

## 🔄 호환성

- 기존 `current_lng/current_lat` 사용 코드와 호환
- 새로운 `location` 배열 형식 지원
- VehicleStateManager와의 통합 검증 완료
