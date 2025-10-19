# Timestamp 기반 시뮬레이션 이벤트 구조 설계 (V2)

## 🎯 설계 원칙

기존 아키텍처를 기반으로, 실제 구현된 기능들을 반영한 실용적인 timestamp 구조를 설계합니다.

### 구현된 핵심 기능
1. ✅ **VehicleStateManager**: 차량 상태 관리 (IDLE → MOVING → WORKING → IDLE)
2. ✅ **DispatchEngine**: Isochrone 기반 배차
3. ✅ **실시간 위치 보간**: TMAP Route 구간별 정보 활용
4. ✅ **자동 상태 전이**: 시간 체크 기반 상태 변경
5. ✅ **JobTypeManager**: 작업 시간 관리

---

## 📊 시뮬레이션 결과 파일 구조

### 파일 위치
`projects/{project-name}/simulation_result.json`

### 전체 구조

```json
{
  "metadata": {
    "projectName": "default",
    "generatedAt": "2025-10-18T10:30:00Z",
    "simulationVersion": "2.0",
    "startTime": "07:00:00",
    "endTime": "10:10",
    "startTimeSeconds": 25200,
    "endTimeSeconds": 36600,
    "totalDurationSeconds": 11400,
    "vehicleCount": 10,
    "demandCount": 150,
    "completedDemands": 132,
    "rejectedDemands": 18,
    "averageWaitTime": 180.5,
    "averageServiceTime": 900,
    "vehicleUtilizationRate": 0.75
  },
  
  "configuration": {
    "waitTimeLimit": 11,
    "operatingTime": {
      "start": "07:00",
      "end": "10:10"
    },
    "jobTypes": [
      {
        "id": "0001",
        "job": "call",
        "service_time": 15
      }
    ]
  },
  
  "vehicles": [
    {
      "id": "vehicle_001",
      "name": "Vehicle_1",
      "initialLocation": [126.9780, 37.5665],
      "job_type": "call",
      "capacity": 4,
      "statistics": {
        "total_jobs": 15,
        "total_distance": 45000,
        "total_service_time": 13500,
        "idle_time": 3600,
        "moving_time": 5400,
        "working_time": 2500
      },
      "timeline": [
        {
          "timestamp": 25200,
          "type": "simulation_start",
          "state": "idle",
          "location": [126.9780, 37.5665]
        },
        {
          "timestamp": 25450,
          "type": "demand_assigned",
          "state": "moving",
          "demandId": "demand_001",
          "targetLocation": [126.9844, 37.5665],
          "routeId": "route_001",
          "estimatedArrival": 25750
        },
        {
          "timestamp": 25750,
          "type": "arrived_at_demand",
          "state": "working",
          "location": [126.9844, 37.5665],
          "demandId": "demand_001",
          "serviceTime": 900,
          "estimatedCompletion": 26650
        },
        {
          "timestamp": 26650,
          "type": "work_completed",
          "state": "idle",
          "location": [126.9844, 37.5665],
          "demandId": "demand_001"
        }
      ]
    }
  ],
  
  "routes": [
    {
      "id": "route_001",
      "vehicleId": "vehicle_001",
      "demandId": "demand_001",
      "type": "to_demand",
      "startTime": 25450,
      "endTime": 25750,
      "duration": 300,
      "distance": 450,
      "startLocation": [126.9780, 37.5665],
      "endLocation": [126.9844, 37.5665],
      "segments": [
        {
          "index": 0,
          "name": "삼일대로13길",
          "startTime": 25450,
          "endTime": 25476,
          "duration": 26,
          "distance": 74,
          "coordinates": [
            [126.9849, 37.5668],
            [126.9857, 37.5668]
          ]
        },
        {
          "index": 1,
          "name": "종로",
          "startTime": 25476,
          "endTime": 25536,
          "duration": 60,
          "distance": 150,
          "coordinates": [
            [126.9857, 37.5668],
            [126.9870, 37.5670],
            [126.9880, 37.5672]
          ]
        }
      ],
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [126.9780, 37.5665],
          [126.9849, 37.5668],
          [126.9857, 37.5668],
          [126.9870, 37.5670],
          [126.9880, 37.5672],
          [126.9844, 37.5665]
        ]
      }
    }
  ],
  
  "demands": [
    {
      "id": "demand_001",
      "timestamp": 25400,
      "requestTime": "07:03:20",
      "location": [126.9844, 37.5665],
      "address": "서울특별시 종로구 삼일대로13길",
      "job_type": "call",
      "status": "completed",
      "assignedVehicle": "vehicle_001",
      "dispatchInfo": {
        "dispatchTime": 25450,
        "waitTime": 50,
        "isochrone": {
          "waitTimeLimit": 11,
          "polygon": {
            "type": "Polygon",
            "coordinates": [[
              [126.970, 37.560],
              [126.990, 37.560],
              [126.990, 37.570],
              [126.970, 37.570],
              [126.970, 37.560]
            ]]
          }
        },
        "candidateVehicles": ["vehicle_001", "vehicle_002"],
        "selectedReason": "closest_distance",
        "distanceToVehicle": 0.45
      },
      "timeline": {
        "requested": 25400,
        "dispatched": 25450,
        "arrived": 25750,
        "workStarted": 25750,
        "workCompleted": 26650
      },
      "metrics": {
        "waitTime": 350,
        "serviceTime": 900,
        "totalTime": 1250
      }
    }
  ],
  
  "events": [
    {
      "timestamp": 25200,
      "type": "simulation_start",
      "data": {
        "vehicles": 10,
        "initialIdleVehicles": 10
      }
    },
    {
      "timestamp": 25400,
      "type": "demand_occurred",
      "demandId": "demand_001"
    },
    {
      "timestamp": 25450,
      "type": "vehicle_dispatched",
      "vehicleId": "vehicle_001",
      "demandId": "demand_001"
    },
    {
      "timestamp": 25750,
      "type": "vehicle_arrived",
      "vehicleId": "vehicle_001",
      "demandId": "demand_001"
    },
    {
      "timestamp": 25750,
      "type": "work_started",
      "vehicleId": "vehicle_001",
      "demandId": "demand_001"
    },
    {
      "timestamp": 26650,
      "type": "work_completed",
      "vehicleId": "vehicle_001",
      "demandId": "demand_001"
    },
    {
      "timestamp": 36600,
      "type": "simulation_end",
      "data": {
        "completedDemands": 132,
        "rejectedDemands": 18,
        "totalVehicleJobs": 150
      }
    }
  ]
}
```

---

## 🔄 이벤트 타입 정의

### 1. Vehicle Events (차량 이벤트)

```javascript
const VehicleEventType = {
  // 시뮬레이션 시작
  SIMULATION_START: 'simulation_start',
  
  // 배차 관련
  DEMAND_ASSIGNED: 'demand_assigned',      // 수요 배차됨
  ROUTE_STARTED: 'route_started',          // 이동 시작
  
  // 도착 관련
  ARRIVED_AT_DEMAND: 'arrived_at_demand',  // 수요 위치 도착
  WORK_STARTED: 'work_started',            // 작업 시작
  WORK_COMPLETED: 'work_completed',        // 작업 완료
  
  // 상태 변경
  STATE_CHANGED: 'state_changed',          // 상태 변경
  
  // 위치 업데이트 (선택적, 재생 시 보간 가능)
  POSITION_UPDATE: 'position_update'       // 위치 업데이트 (선택적)
};
```

### 2. Demand Events (수요 이벤트)

```javascript
const DemandEventType = {
  DEMAND_OCCURRED: 'demand_occurred',      // 수요 발생
  DEMAND_REJECTED: 'demand_rejected',      // 배차 실패 (차량 없음)
  VEHICLE_DISPATCHED: 'vehicle_dispatched',// 차량 배차 완료
  VEHICLE_ARRIVED: 'vehicle_arrived',      // 차량 도착
  WORK_COMPLETED: 'work_completed'         // 작업 완료
};
```

### 3. System Events (시스템 이벤트)

```javascript
const SystemEventType = {
  SIMULATION_START: 'simulation_start',
  SIMULATION_END: 'simulation_end',
  STATISTICS_UPDATE: 'statistics_update'   // 주기적 통계 업데이트
};
```

---

## 🏗️ 데이터 구조 상세

### Vehicle Timeline Entry

```typescript
interface VehicleTimelineEntry {
  timestamp: number;           // 시뮬레이션 시간 (초)
  type: VehicleEventType;      // 이벤트 타입
  state: VehicleState;         // 차량 상태
  location: [number, number];  // 현재 위치 [lng, lat]
  
  // 배차 관련 (type === 'demand_assigned')
  demandId?: string;
  targetLocation?: [number, number];
  routeId?: string;
  estimatedArrival?: number;
  
  // 작업 관련 (type === 'arrived_at_demand')
  serviceTime?: number;
  estimatedCompletion?: number;
}
```

### Route Segment

```typescript
interface RouteSegment {
  index: number;                    // 구간 인덱스
  name: string;                     // 도로명
  startTime: number;                // 구간 시작 시간 (초)
  endTime: number;                  // 구간 종료 시간 (초)
  duration: number;                 // 구간 소요 시간 (초)
  distance: number;                 // 구간 거리 (m)
  coordinates: Array<[number, number]>; // 구간 좌표들
}
```

### Demand Dispatch Info

```typescript
interface DispatchInfo {
  dispatchTime: number;             // 배차 시간
  waitTime: number;                 // 대기 시간
  isochrone: {
    waitTimeLimit: number;          // 대기 시간 제한
    polygon: GeoJSON.Polygon;       // Isochrone 폴리곤
  };
  candidateVehicles: string[];      // 후보 차량 목록
  selectedReason: string;           // 선택 사유
  distanceToVehicle: number;        // 선택된 차량과의 거리
}
```

---

## 🎬 시뮬레이션 실행 흐름

### 1. 시뮬레이션 초기화

```javascript
{
  timestamp: startTimeSeconds,
  type: 'simulation_start',
  data: {
    vehicles: vehicleCount,
    demands: demandCount,
    configuration: projectConfig
  }
}
```

### 2. 수요 발생 → 배차 → 작업 → 완료

```javascript
// 1. 수요 발생
{
  timestamp: 25400,
  type: 'demand_occurred',
  demandId: 'demand_001',
  location: [126.9844, 37.5665]
}

// 2. 배차 (Isochrone 계산 + 차량 선택)
{
  timestamp: 25450,
  type: 'vehicle_dispatched',
  vehicleId: 'vehicle_001',
  demandId: 'demand_001',
  route: {...}
}

// 3. 도착
{
  timestamp: 25750,
  type: 'vehicle_arrived',
  vehicleId: 'vehicle_001',
  demandId: 'demand_001'
}

// 4. 작업 시작
{
  timestamp: 25750,
  type: 'work_started',
  vehicleId: 'vehicle_001',
  demandId: 'demand_001',
  serviceTime: 900
}

// 5. 작업 완료
{
  timestamp: 26650,
  type: 'work_completed',
  vehicleId: 'vehicle_001',
  demandId: 'demand_001'
}
```

---

## 💾 위치 정보 저장 전략

### 전략 A: 이벤트만 저장 + 재생 시 보간 (권장)

**저장**: 주요 이벤트만 저장 (배차, 도착, 완료)
**재생**: Route segments 정보를 사용하여 실시간 보간

**장점**:
- 파일 크기 작음
- 정확한 경로 정보 유지
- 재생 속도 조절 가능

**단점**:
- 재생 시 계산 필요

### 전략 B: 주기적 위치 저장 (선택적)

**저장**: 1초마다 위치 저장
**재생**: 저장된 위치 그대로 표시

**장점**:
- 재생 빠름
- 정확한 위치 기록

**단점**:
- 파일 크기 큼
- 저장 시간 증가

---

## 🔍 재생(Replay) 알고리즘

### Replay Manager 구조

```javascript
class SimulationReplay {
  constructor(simulationResult) {
    this.metadata = simulationResult.metadata;
    this.vehicles = simulationResult.vehicles;
    this.routes = simulationResult.routes;
    this.demands = simulationResult.demands;
    this.events = simulationResult.events;
    
    this.currentTime = this.metadata.startTimeSeconds;
    this.playbackSpeed = 1.0; // 1x, 2x, 10x 등
  }
  
  // 특정 시간으로 이동
  seekToTime(timestamp) {
    this.currentTime = timestamp;
    this.updateAllVehiclePositions(timestamp);
  }
  
  // 프레임 업데이트
  update(deltaTime) {
    this.currentTime += deltaTime * this.playbackSpeed;
    
    // 현재 시간의 이벤트 처리
    this.processEventsAt(this.currentTime);
    
    // 차량 위치 보간
    this.updateAllVehiclePositions(this.currentTime);
  }
  
  // 차량 위치 보간 (route segments 활용)
  interpolateVehiclePosition(vehicle, timestamp) {
    // VehicleStateManager의 interpolateVehiclePosition과 동일 로직
    const currentEvent = this.findCurrentEvent(vehicle, timestamp);
    
    if (currentEvent.state === 'moving') {
      const route = this.routes.find(r => r.id === currentEvent.routeId);
      return this.interpolateAlongRoute(route, timestamp);
    }
    
    return currentEvent.location;
  }
}
```

---

## 📈 통계 및 분석

### Real-time Statistics

시뮬레이션 중 실시간으로 수집되는 통계:

```javascript
{
  "statistics": {
    "vehicles": {
      "total": 10,
      "idle": 3,
      "moving": 4,
      "working": 3,
      "utilization": 0.70
    },
    "demands": {
      "total": 150,
      "completed": 132,
      "rejected": 18,
      "pending": 0,
      "completionRate": 0.88
    },
    "performance": {
      "averageWaitTime": 180.5,
      "averageServiceTime": 900,
      "averageResponseTime": 250,
      "maxWaitTime": 660
    }
  }
}
```

---

## 🎯 구현 우선순위

### Phase 1: 기본 이벤트 기록 ✅
- [x] VehicleStateManager 통합
- [x] 이벤트 타입 정의
- [ ] EventRecorder 클래스

### Phase 2: 시뮬레이션 엔진
- [ ] SimulationEngine 클래스
- [ ] 시간 흐름 관리
- [ ] 수요 발생 처리
- [ ] 이벤트 기록

### Phase 3: 재생 시스템
- [ ] SimulationReplay 클래스
- [ ] 위치 보간
- [ ] UI 연동

### Phase 4: 최적화
- [ ] 통계 수집
- [ ] 성능 분석
- [ ] 파일 압축

---

이 구조는 실제 구현된 기능들과 완벽히 호환되며, Record-Replay 패턴을 효율적으로 구현할 수 있습니다!
