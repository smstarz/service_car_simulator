# Simulation Result 파일 크기 계산

## 📊 시나리오 설정

- **시뮬레이션 시간**: 12시간 (43,200초)
- **차량 수**: 20대
- **수요 건수**: 400건
- **위치 저장 주기**: 1초마다

---

## 🔢 상세 계산

### 1. Metadata & Configuration (~2 KB)

```json
{
  "metadata": { /* ~500 bytes */ },
  "configuration": { /* ~500 bytes */ },
  "statistics": { /* ~1000 bytes */ }
}
```

**예상 크기**: 2 KB

---

### 2. Vehicles 배열

#### 2.1 Vehicle 기본 정보 (차량당)

```json
{
  "id": "vehicle_001",
  "name": "Vehicle_1",
  "initialLocation": [126.9780, 37.5665],
  "job_type": "call",
  "capacity": 4,
  "statistics": {
    "total_jobs": 20,
    "total_distance": 50000,
    "total_service_time": 18000,
    "idle_time": 14400,
    "moving_time": 10800,
    "working_time": 18000
  }
}
```

**JSON 문자열 크기**: ~300 bytes
**20대 차량**: 300 × 20 = **6,000 bytes = 6 KB**

#### 2.2 Vehicle Timeline (1초마다 위치 저장)

##### 전략 B: 1초마다 위치 저장하는 경우

**각 위치 엔트리**:
```json
{
  "timestamp": 25200,
  "type": "position_update",
  "state": "moving",
  "location": [126.9780, 37.5665],
  "demandId": "demand_001",
  "routeId": "route_001"
}
```

**JSON 문자열 크기**: ~150 bytes (압축되지 않은 상태)

**차량 1대당**:
- 시뮬레이션 시간: 43,200초
- 엔트리 개수: 43,200개
- 크기: 43,200 × 150 bytes = **6,480,000 bytes = 6.48 MB**

**20대 차량**:
- 6.48 MB × 20 = **129.6 MB**

---

### 3. Routes 배열

#### 3.1 Route 수 추정

- 수요 400건 → 차량이 수요로 이동하는 경로 400개
- 차량당 평균: 400 / 20 = 20건

#### 3.2 Route 1개당 크기

```json
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
    }
    // 평균 10개 세그먼트
  ],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      // 평균 50개 좌표
    ]
  }
}
```

**구성 요소**:
- 기본 정보: ~200 bytes
- Segments (10개 평균): 
  - 세그먼트당: ~200 bytes
  - 10개: 2,000 bytes
- Geometry (좌표 50개):
  - 좌표당: 25 bytes `[126.9780, 37.5665]`
  - 50개: 1,250 bytes

**Route 1개**: 200 + 2,000 + 1,250 = **3,450 bytes = 3.45 KB**

**400개 Route**: 3.45 KB × 400 = **1,380 KB = 1.38 MB**

---

### 4. Demands 배열

#### 4.1 Demand 1건당 크기

```json
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
          // 평균 20개 좌표
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
```

**구성 요소**:
- 기본 정보: ~300 bytes
- Isochrone polygon (20개 좌표): 500 bytes
- Timeline & Metrics: ~200 bytes

**Demand 1건**: 300 + 500 + 200 = **1,000 bytes = 1 KB**

**400건**: 1 KB × 400 = **400 KB = 0.4 MB**

---

### 5. Events 배열 (Global Timeline)

#### 5.1 이벤트 수 추정

- 시뮬레이션 시작/종료: 2개
- 수요별 이벤트 (발생, 배차, 도착, 작업시작, 작업완료): 5 × 400 = 2,000개
- **총 이벤트**: ~2,000개

#### 5.2 이벤트 1개당 크기

```json
{
  "timestamp": 25450,
  "type": "vehicle_dispatched",
  "vehicleId": "vehicle_001",
  "demandId": "demand_001",
  "location": [126.9780, 37.5665]
}
```

**Event 1개**: ~120 bytes

**2,000개 Event**: 120 × 2,000 = **240,000 bytes = 240 KB = 0.24 MB**

---

## 📦 총 파일 크기 계산

### 전략 B: 1초마다 위치 저장

| 항목 | 크기 |
|-----|------|
| Metadata & Configuration | 2 KB |
| Vehicles (기본 정보) | 6 KB |
| **Vehicles Timeline (1초마다)** | **129.6 MB** |
| Routes (400건) | 1.38 MB |
| Demands (400건) | 0.4 MB |
| Events (2,000개) | 0.24 MB |
| **총계** | **~131.6 MB** |

---

## 🎯 저장 전략 비교

### 전략 A: 이벤트만 저장 (권장)

Timeline에 주요 이벤트만 저장 (배차, 도착, 완료):
- 차량당 평균 20건 수요 처리
- 수요당 이벤트 4개 (배차, 도착, 작업시작, 완료)
- 차량당 이벤트: 20 × 4 = 80개
- 20대 차량: 80 × 20 = 1,600개

**Timeline 크기**: 1,600 × 150 bytes = **240 KB = 0.24 MB**

| 항목 | 크기 |
|-----|------|
| Metadata & Configuration | 2 KB |
| Vehicles (기본 정보) | 6 KB |
| **Vehicles Timeline (이벤트만)** | **0.24 MB** |
| Routes (400건) | 1.38 MB |
| Demands (400건) | 0.4 MB |
| Events (2,000개) | 0.24 MB |
| **총계** | **~2.3 MB** |

---

### 전략 B: 1초마다 위치 저장

| 항목 | 크기 |
|-----|------|
| **총계** | **~131.6 MB** |

---

## 📊 비교 분석

| 항목 | 전략 A (이벤트만) | 전략 B (1초마다) | 비율 |
|-----|----------------|----------------|------|
| 파일 크기 | **2.3 MB** | **131.6 MB** | **57배** |
| 저장 시간 | 빠름 | 느림 | - |
| 재생 계산 | 필요 (보간) | 불필요 | - |
| 재생 속도 | 매우 빠름 | 빠름 | - |
| 메모리 사용 | 낮음 | 높음 | - |

---

## 💡 최적화 방안

### 1. Gzip 압축

JSON은 압축률이 매우 좋습니다 (텍스트 데이터 + 반복 패턴):

- **압축률**: 일반적으로 70~80% 압축
- **전략 A**: 2.3 MB → **0.5~0.7 MB**
- **전략 B**: 131.6 MB → **26~40 MB**

### 2. 스파스 샘플링 (Sparse Sampling)

이동 중인 차량만 기록:
- IDLE 상태: 위치 저장 안 함
- MOVING 상태: 1초마다 저장
- WORKING 상태: 위치 저장 안 함

**예상 절감**:
- 차량 가동률 60% 가정
- 가동 시간의 50%가 이동 (나머지 50%는 작업)
- 실제 저장: 43,200초 × 0.6 × 0.5 = 12,960초
- **파일 크기**: 131.6 MB × 0.3 = **39.5 MB**

### 3. 혼합 전략 (Hybrid)

- **주요 이벤트**: 모두 저장
- **이동 중 위치**: 5초마다 저장
- **IDLE/WORKING**: 위치 저장 안 함

**예상 크기**:
- Timeline: 12,960초 / 5 = 2,592개 엔트리
- 2,592 × 150 bytes × 20대 = **7.8 MB**
- 전체: 2 KB + 6 KB + 7.8 MB + 1.38 MB + 0.4 MB + 0.24 MB = **~9.8 MB**
- Gzip 압축 후: **~2~3 MB**

---

## 🎯 권장 사항

### 12시간, 차량 20대, 수요 400건 시나리오

| 전략 | 원본 크기 | 압축 후 | 재생 품질 | 권장도 |
|-----|---------|--------|---------|-------|
| **전략 A (이벤트만)** | 2.3 MB | 0.5 MB | 매우 좋음 | ⭐⭐⭐⭐⭐ |
| **혼합 (5초마다)** | 9.8 MB | 2~3 MB | 매우 좋음 | ⭐⭐⭐⭐ |
| **전략 B (1초마다)** | 131.6 MB | 26~40 MB | 완벽 | ⭐⭐ |

### 최종 권장: **전략 A (이벤트만 저장)**

**이유**:
1. 파일 크기: 압축 후 **0.5 MB** (매우 작음)
2. Route segments 정보로 정확한 보간 가능
3. 재생 속도 조절 용이
4. 메모리 효율적
5. 브라우저에서 처리 가능

**재생 시**:
- Route segments를 사용한 실시간 보간
- 60fps 재생 시에도 부드러운 애니메이션
- 빨리감기/되감기 쉬움

---

## 💻 구현 코드 예제

```javascript
// 전략 A: 이벤트만 저장
class EventRecorder {
  recordVehicleEvent(vehicle, type, additionalData = {}) {
    const event = {
      timestamp: this.currentTime,
      type: type,
      state: vehicle.state,
      location: vehicle.location,
      ...additionalData
    };
    
    vehicle.timeline.push(event);
  }
}

// 재생 시 보간
class SimulationReplay {
  interpolatePosition(vehicle, currentTime) {
    const timeline = vehicle.timeline;
    
    // 현재 시간에 해당하는 이벤트 찾기
    for (let i = 0; i < timeline.length - 1; i++) {
      const event = timeline[i];
      const nextEvent = timeline[i + 1];
      
      if (currentTime >= event.timestamp && currentTime < nextEvent.timestamp) {
        if (event.state === 'moving' && event.routeId) {
          // Route segments로 보간
          const route = this.routes.find(r => r.id === event.routeId);
          return this.interpolateAlongRoute(route, currentTime);
        }
        return event.location; // IDLE or WORKING
      }
    }
  }
}
```

---

## 결론

**12시간, 차량 20대, 수요 400건 시나리오에서:**

- **1초마다 위치 저장 시**: 원본 **131.6 MB**, 압축 **26~40 MB**
- **이벤트만 저장 시** (권장): 원본 **2.3 MB**, 압축 **0.5 MB**

**파일 크기 차이**: **57배** (압축 기준 52~80배)

→ **전략 A (이벤트만 저장 + 재생 시 보간)**를 강력 권장합니다!
