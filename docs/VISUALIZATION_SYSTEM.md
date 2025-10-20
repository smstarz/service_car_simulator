# 시뮬레이션 시각화 시스템 구현 완료

## 📋 개요

타임스탬프 기반으로 차량 이동, 경로, 수요 발생을 Mapbox GL JS로 실시간 애니메이션하는 시각화 시스템을 구현했습니다.

## 🎯 주요 기능

### 1. **차량 레이어 (Vehicle Layer)**
- **표시 방식**: GeoJSON Circle Layer
- **기능**:
  - 실시간 위치 업데이트 (타임라인 이벤트 간 선형 보간)
  - 상태별 색상 구분
    - 🔵 파랑 (`#0d6efd`): 이동 중 (moving)
    - 🟢 초록 (`#198754`): 작업 중 (working)
    - ⚪ 회색 (`#6c757d`): 대기 (idle)
    - 🔴 빨강 (`#dc3545`): 오프라인 (offline)
  - 차량 ID 라벨 표시
  - 클릭 시 상세 정보 팝업 (작업 건수, 총 이동거리 등)

### 2. **경로 레이어 (Route Layer)**
- **표시 방식**: GeoJSON LineString Layer
- **기능**:
  - 차량이 이동 중일 때만 활성 경로 표시
  - 두 개의 레이어로 구성:
    - 메인 라인: 굵은 색상 라인
    - 애니메이션 라인: 점선 효과로 움직임 강조
  - 경로 타입별 색상
    - 🔵 파랑: 픽업 이동
    - 🟢 초록: 작업지 이동

### 3. **수요 레이어 (Demand Layer)**
- **표시 방식**: GeoJSON Circle Layer
- **기능**:
  - 요청 시간에 맞춰 동적 생성
  - 상태별 색상 변화
    - 🟡 노랑 (`#ffc107`): 대기 중 (pending)
    - 🔵 청록 (`#0dcaf0`): 배차됨 (dispatched)
    - 🔷 청록(어두움) (`#17a2b8`): 도착 (arrived)
    - 🟠 주황 (`#fd7e14`): 작업 중 (working)
    - 🟢 초록 (`#198754`): 완료 (completed)
    - 🔴 빨강 (`#dc3545`): 거절됨 (rejected)
  - 수요 주소/ID 라벨 표시
  - 클릭 시 상세 정보 팝업

## 🏗️ 시스템 구조

```
┌─────────────────────────────────────────────────┐
│          SimulationVisualizer                   │
│  (public/utils/simulationVisualizer.js)         │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ Vehicle │   │  Route  │   │ Demand  │
   │  Layer  │   │  Layer  │   │  Layer  │
   └─────────┘   └─────────┘   └─────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
         ┌────────────▼────────────┐
         │   Mapbox GL JS Map      │
         └─────────────────────────┘
```

## 📁 파일 구조

```
public/
├── utils/
│   └── simulationVisualizer.js  (새로 생성) ✨
│       └── SimulationVisualizer 클래스
├── app.js  (수정) 🔧
│   ├── DemandMarkersManager → SimulationVisualizer 교체
│   ├── loadProjectDemand() - 시뮬레이션 결과 자동 로드
│   ├── startPlayback() - 실시간 시각화 업데이트
│   ├── nouiUpdateHandler() - 슬라이더 드래그 시 업데이트
│   └── stopBtn - 정지 시 초기화
└── index.html (변경 없음)

server.js  (수정) 🔧
└── GET /projects/:name/simulation-result  (새 API 추가) ✨
```

## 🔄 데이터 플로우

```
1. 프로젝트 선택
   └─> loadProjectDemand(projectName)
       ├─> GET /projects/:name/demand (CSV)
       └─> GET /projects/:name/simulation-result (JSON) ✨
           └─> simulationVisualizer.loadSimulationData(data)
               ├─> 지도 중심 이동
               └─> 초기 상태 시각화

2. 플레이백 재생
   └─> startPlayback()
       └─> loop() (requestAnimationFrame)
           ├─> current += dt * speed
           └─> simulationVisualizer.updateVisualization(current)
               ├─> updateVehicles(current)
               │   └─> 차량 위치 보간 + GeoJSON 업데이트
               ├─> updateRoutes(current)
               │   └─> 활성 경로 필터링 + 표시
               └─> updateDemands(current)
                   └─> 시간대별 수요 상태 계산 + 표시

3. 슬라이더 드래그
   └─> nouiUpdateHandler()
       └─> simulationVisualizer.updateVisualization(current)

4. 정지 버튼
   └─> stopBtn click
       ├─> current = startTime
       └─> simulationVisualizer.updateVisualization(current)
```

## 💡 핵심 알고리즘

### 차량 위치 보간 (Linear Interpolation)

```javascript
// timeline에서 현재 시간의 전후 이벤트 찾기
let prevEvent = null, nextEvent = null;
for (let event of vehicle.timeline) {
  if (event.timestamp <= targetTime) prevEvent = event;
  if (event.timestamp > targetTime) {
    nextEvent = event;
    break;
  }
}

// 선형 보간
if (prevEvent && nextEvent) {
  const t = (targetTime - prevEvent.timestamp) / 
            (nextEvent.timestamp - prevEvent.timestamp);
  
  const interpolatedLocation = [
    prevEvent.location[0] + (nextEvent.location[0] - prevEvent.location[0]) * t,
    prevEvent.location[1] + (nextEvent.location[1] - prevEvent.location[1]) * t
  ];
}
```

### 수요 상태 결정 (State Machine)

```javascript
getDemandStatusAt(demand, currentTime) {
  const timeline = demand.timeline;
  
  // 역순으로 체크하여 현재 상태 결정
  if (timeline.workCompleted && currentTime >= timeline.workCompleted)
    return 'completed';
  if (timeline.workStarted && currentTime >= timeline.workStarted)
    return 'working';
  if (timeline.arrived && currentTime >= timeline.arrived)
    return 'arrived';
  if (timeline.dispatched && currentTime >= timeline.dispatched)
    return 'dispatched';
  if (demand.status === 'rejected')
    return 'rejected';
  
  return 'pending';
}
```

## 🎮 사용 방법

1. **프로젝트 선택**: 좌측 패널에서 프로젝트 선택
2. **시뮬레이션 실행**: "Run Simulation" 버튼 클릭
3. **재생**: 
   - ▶️ 플레이 버튼 클릭
   - 또는 스페이스바/S 키
4. **속도 조절**: x1.0, x2.0, x5.0 선택
5. **시간 이동**: 타임라인 슬라이더 드래그
6. **정지**: ⏹️ 버튼으로 처음으로 되돌리기

## 🎨 시각화 특징

### 실시간 업데이트
- 60 FPS로 부드러운 애니메이션
- `requestAnimationFrame` 기반 렌더링
- 속도 배율 지원 (1x, 2x, 5x)

### 인터랙티브
- 차량/수요 클릭으로 상세 정보 확인
- 마우스 오버 시 커서 변경
- 팝업으로 실시간 통계 표시

### 성능 최적화
- GeoJSON Source 재사용 (레이어 재생성 없음)
- 활성 경로만 렌더링
- 시간대별 필터링으로 불필요한 데이터 제외

## 🔧 API 엔드포인트

### 새로 추가된 API

```http
GET /projects/:name/simulation-result
```

**응답 예시:**
```json
{
  "metadata": {
    "startTimeSeconds": 43200,
    "endTimeSeconds": 46800,
    ...
  },
  "vehicles": [
    {
      "id": "vehicle_001",
      "initialLocation": [127.04428, 37.510775],
      "timeline": [
        {
          "timestamp": 43200,
          "type": "simulation_start",
          "state": "idle",
          "location": [127.04428, 37.510775]
        }
      ]
    }
  ],
  "demands": [
    {
      "id": "vpGPNz",
      "timestamp": 43800,
      "location": [127.037562, 37.517183],
      "status": "rejected",
      "timeline": { ... }
    }
  ],
  "routes": []
}
```

## ✅ 완료된 작업

- [x] SimulationVisualizer 클래스 생성
- [x] 차량 레이어 구현 (위치 보간, 상태별 색상)
- [x] 경로 레이어 구현 (활성 경로 표시)
- [x] 수요 레이어 구현 (타임스탬프 기반 생성/상태 변경)
- [x] app.js 통합 (기존 demandMarkers 제거)
- [x] 서버 API 추가 (simulation-result 엔드포인트)
- [x] 플레이백 연동 (재생/정지/슬라이더)
- [x] 자동 리로드 (시뮬레이션 완료 후)

## 🚀 다음 개선 사항

1. **고급 경로 시각화**
   - TMAP API의 실제 경로 geometry 활용
   - 경로 진행도 표시 (부분 라인 애니메이션)

2. **3D 시각화**
   - Mapbox GL JS pitch/bearing 활용
   - 차량 3D 모델 표시

3. **통계 대시보드**
   - 실시간 차트 (시간별 완료율, 차량 활용도)
   - 히트맵 레이어 (수요 밀집도)

4. **필터링**
   - 특정 차량만 보기
   - 상태별 필터 (완료/거절/진행 중)

5. **녹화/내보내기**
   - 시뮬레이션 비디오 저장
   - GIF 애니메이션 생성

## 🐛 알려진 제한사항

- 현재 모든 시뮬레이션 결과가 거절된 데이터만 있어 실제 이동 애니메이션 확인 불가
- 경로 데이터가 없는 경우 직선으로 표시
- 대량의 차량/수요 시 성능 최적화 필요

## 📝 테스트 방법

1. 배차가 성공한 시뮬레이션 데이터 생성 필요
2. 브라우저에서 `http://localhost:5000` 접속
3. 프로젝트 선택 후 시뮬레이션 실행
4. 플레이백 컨트롤로 재생/정지 테스트

---

**구현 완료 시각**: 2025-10-19
**버전**: 2.0
**개발자**: GitHub Copilot
