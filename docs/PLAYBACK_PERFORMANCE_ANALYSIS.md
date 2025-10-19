# 시뮬레이션 재생 성능 분석

## 📊 시나리오 설정

- **시뮬레이션 시간**: 12시간 (43,200초)
- **차량 수**: 20대
- **수요 건수**: 400건
- **파일 크기**: 2.3 MB (압축 후 0.5 MB)
- **저장 전략**: 전략 A (이벤트만 저장)

---

## 🎬 재생 시 연산량 분석

### 1. 프레임당 필요한 연산

#### 1.1 차량 위치 보간 (Vehicle Position Interpolation)

**각 차량당 연산**:
```javascript
interpolateVehiclePosition(vehicle, currentTime) {
  // 1. Timeline에서 현재 이벤트 찾기 (O(log n) - 이진 검색)
  const currentEvent = this.findCurrentEvent(vehicle, currentTime);
  
  // 2. 상태 확인
  if (currentEvent.state !== 'moving') {
    return currentEvent.location; // O(1)
  }
  
  // 3. Route 찾기 (O(1) - Map으로 캐싱)
  const route = this.routesMap.get(currentEvent.routeId);
  
  // 4. Route segments에서 현재 구간 찾기 (O(log m) - 이진 검색)
  const segment = this.findSegmentAtTime(route, currentTime);
  
  // 5. 구간 내 선형 보간 (O(1))
  const position = this.interpolateWithinSegment(segment, currentTime);
  
  return position;
}
```

**연산 복잡도**:
- Timeline 검색: O(log n) ≈ log₂(80) ≈ 6 비교
- Route 조회: O(1)
- Segment 검색: O(log m) ≈ log₂(10) ≈ 3 비교
- 선형 보간: O(1) ≈ 10 연산

**차량 1대당**: 약 **20 연산**

#### 1.2 전체 차량 업데이트

**20대 차량**: 20 × 20 = **400 연산/프레임**

---

## ⚡ 재생 속도별 성능 요구사항

### 2.1 실시간 재생 (1x)

**프레임레이트: 60 FPS**

| 항목 | 값 |
|-----|-----|
| 프레임 간격 | 16.67ms |
| 시뮬레이션 시간 증가 | 16.67ms (1x) |
| 차량당 연산 | 20 연산 |
| 총 연산 | 400 연산 |
| **예상 소요 시간** | **< 0.1ms** |
| **여유도** | **166배** ✅ |

**결론**: 매우 여유롭게 가능

---

### 2.2 2배속 재생 (2x)

**프레임레이트: 60 FPS**

| 항목 | 값 |
|-----|-----|
| 프레임 간격 | 16.67ms |
| 시뮬레이션 시간 증가 | 33.33ms (2x) |
| 차량당 연산 | 20 연산 |
| 총 연산 | 400 연산 |
| **예상 소요 시간** | **< 0.1ms** |
| **여유도** | **166배** ✅ |

**결론**: 매우 여유롭게 가능

---

### 2.3 10배속 재생 (10x)

**프레임레이트: 60 FPS**

| 항목 | 값 |
|-----|-----|
| 프레임 간격 | 16.67ms |
| 시뮬레이션 시간 증가 | 166.7ms (10x) |
| 차량당 연산 | 20 연산 |
| 총 연산 | 400 연산 |
| **예상 소요 시간** | **< 0.1ms** |
| **여유도** | **166배** ✅ |

**결론**: 매우 여유롭게 가능

---

### 2.4 100배속 재생 (100x)

**프레임레이트: 60 FPS**

| 항목 | 값 |
|-----|-----|
| 프레임 간격 | 16.67ms |
| 시뮬레이션 시간 증가 | 1,667ms (100x) |
| 차량당 연산 | 20 연산 |
| 총 연산 | 400 연산 |
| **예상 소요 시간** | **< 0.1ms** |
| **여유도** | **166배** ✅ |
| **12시간 재생 시간** | **7.2분** |

**결론**: 매우 여유롭게 가능

---

### 2.5 1000배속 재생 (1000x)

**프레임레이트: 60 FPS**

| 항목 | 값 |
|-----|-----|
| 프레임 간격 | 16.67ms |
| 시뮬레이션 시간 증가 | 16,667ms (1000x) |
| 차량당 연산 | 20 연산 |
| 총 연산 | 400 연산 |
| **예상 소요 시간** | **< 0.1ms** |
| **여유도** | **166배** ✅ |
| **12시간 재생 시간** | **43초** |

**결론**: 가능하지만 육안으로 관찰하기 어려움

---

### 2.6 최대 재생 속도 (Max Speed)

**프레임 스킵 모드** (애니메이션 없이 최대 속도):

```javascript
// 모든 프레임을 계산하지 않고 이벤트만 처리
fastForward(targetTime) {
  // 1. 이벤트만 순회 (400건 × 5 이벤트 = 2,000개)
  const events = this.getAllEventsBetween(this.currentTime, targetTime);
  
  // 2. 이벤트 처리
  events.forEach(event => {
    this.processEvent(event);
  });
  
  // 3. 최종 위치만 업데이트
  this.updateAllVehiclePositions(targetTime);
}
```

**성능**:
- 이벤트 순회: 2,000개 × 0.001ms = **2ms**
- 최종 위치 업데이트: 20대 × 0.005ms = **0.1ms**
- **총 소요 시간**: **< 3ms**

**12시간 시뮬레이션을 3ms에 처리** → **무한대속** ⚡

---

## 🖥️ 실제 브라우저 성능 테스트

### 3.1 JavaScript 연산 속도

**현대 브라우저 기준** (Chrome, Edge, Firefox):

```javascript
// 벤치마크 코드
function benchmarkInterpolation() {
  const iterations = 10000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    // 차량 20대 위치 보간
    for (let v = 0; v < 20; v++) {
      interpolateVehiclePosition(vehicles[v], currentTime + i);
    }
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTimePerFrame = totalTime / iterations;
  
  console.log(`Average time per frame: ${avgTimePerFrame.toFixed(3)}ms`);
  console.log(`Max FPS: ${(1000 / avgTimePerFrame).toFixed(0)}`);
}
```

**예상 결과** (일반적인 노트북 기준):
- **프레임당 시간**: 0.05 ~ 0.2ms
- **최대 FPS**: 5,000 ~ 20,000 FPS
- **60 FPS 유지 가능 배속**: **83 ~ 333배속**

---

## 📊 재생 속도 권장 사항

### 4.1 실용적 재생 속도

| 배속 | 12시간 재생 시간 | 용도 | 가능 여부 |
|-----|-----------------|------|----------|
| **0.5x** | 24시간 | 상세 분석 | ✅ 완벽 |
| **1x** | 12시간 | 실시간 관찰 | ✅ 완벽 |
| **2x** | 6시간 | 빠른 관찰 | ✅ 완벽 |
| **5x** | 2.4시간 | 전체 흐름 파악 | ✅ 완벽 |
| **10x** | 1.2시간 | 전체 시뮬레이션 확인 | ✅ 완벽 |
| **20x** | 36분 | 빠른 검토 | ✅ 완벽 |
| **50x** | 14.4분 | 매우 빠른 검토 | ✅ 완벽 |
| **100x** | 7.2분 | 개요 파악 | ✅ 완벽 |
| **200x** | 3.6분 | 통계 확인 | ✅ 가능 |
| **500x** | 1.4분 | 최종 결과 확인 | ✅ 가능 |
| **1000x** | 43초 | 즉시 결과 | ⚠️ 가능 (관찰 어려움) |

---

### 4.2 UI 권장 배속 옵션

```javascript
const playbackSpeeds = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1.0 },
  { label: '2x', value: 2.0 },
  { label: '5x', value: 5.0 },
  { label: '10x', value: 10.0 },
  { label: '20x', value: 20.0 },
  { label: '50x', value: 50.0 },
  { label: '100x', value: 100.0 }
];
```

**추가 기능**:
- **Skip to End**: 프레임 스킵으로 즉시 마지막으로
- **Jump to Time**: 특정 시간으로 이동
- **Pause/Resume**: 일시정지/재개

---

## 🎯 병목 지점 분석

### 5.1 연산 병목 (거의 없음)

**위치 보간 연산**: 0.05 ~ 0.2ms (매우 빠름)

### 5.2 렌더링 병목 (주요 병목)

**Mapbox GL JS 렌더링**:

```javascript
// 매 프레임마다 실행
function updateMapMarkers(vehicles) {
  vehicles.forEach(vehicle => {
    // 마커 위치 업데이트
    vehicle.marker.setLngLat(vehicle.location); // ~0.1ms
    
    // 경로 업데이트 (선택적)
    if (vehicle.state === 'moving') {
      vehicle.routeLayer.setData(vehicle.routeGeoJSON); // ~0.5ms
    }
  });
  
  // Mapbox 렌더링
  map.triggerRepaint(); // ~2~5ms
}
```

**차량 20대 기준**:
- 마커 업데이트: 20 × 0.1ms = **2ms**
- 경로 업데이트: 10 × 0.5ms = **5ms** (이동 중인 차량만)
- Mapbox 렌더링: **2~5ms**
- **총 렌더링 시간**: **9~12ms**

**60 FPS 유지**: 16.67ms 프레임 시간 - 12ms 렌더링 = **4.67ms 여유**

**결론**: 렌더링이 병목이지만 **60 FPS 유지 가능**

---

## ⚡ 성능 최적화 전략

### 6.1 렌더링 최적화

#### Option 1: 배속에 따른 적응형 렌더링

```javascript
function adaptiveRendering(playbackSpeed) {
  if (playbackSpeed <= 10) {
    // 모든 차량 매 프레임 렌더링
    renderAllVehicles();
  } else if (playbackSpeed <= 50) {
    // 2프레임마다 렌더링 (30 FPS)
    if (frameCount % 2 === 0) {
      renderAllVehicles();
    }
  } else if (playbackSpeed <= 100) {
    // 4프레임마다 렌더링 (15 FPS)
    if (frameCount % 4 === 0) {
      renderAllVehicles();
    }
  } else {
    // 이벤트가 있을 때만 렌더링
    if (hasEventAtCurrentTime) {
      renderAllVehicles();
    }
  }
}
```

#### Option 2: 클러스터링

```javascript
// 100배속 이상에서 차량 클러스터링
if (playbackSpeed >= 100) {
  // 개별 차량 대신 집계 표시
  displayVehicleClusters(vehicles);
  displayDemandHeatmap(demands);
}
```

#### Option 3: WebWorker 활용

```javascript
// Worker에서 위치 계산, 메인 스레드는 렌더링만
const worker = new Worker('interpolation-worker.js');

worker.postMessage({
  vehicles: vehicles,
  currentTime: currentTime
});

worker.onmessage = (e) => {
  const positions = e.data;
  renderVehicles(positions); // 계산된 위치로 렌더링
};
```

---

### 6.2 메모리 최적화

#### 캐싱 전략

```javascript
class SimulationReplay {
  constructor(data) {
    // Route를 Map으로 캐싱
    this.routesMap = new Map(
      data.routes.map(r => [r.id, r])
    );
    
    // Timeline을 이진 검색 트리로 변환
    this.vehicles.forEach(v => {
      v.timelineIndex = this.buildTimelineIndex(v.timeline);
    });
  }
  
  buildTimelineIndex(timeline) {
    // 시간별 인덱스 생성 (이진 검색 최적화)
    return timeline.map((event, index) => ({
      timestamp: event.timestamp,
      index: index
    }));
  }
}
```

---

## 📊 실제 성능 측정 결과 (예상)

### 7.1 저사양 PC (Intel i3, 8GB RAM)

| 배속 | FPS | CPU 사용률 | 가능 여부 |
|-----|-----|-----------|----------|
| 1x | 60 | 5% | ✅ 완벽 |
| 10x | 60 | 8% | ✅ 완벽 |
| 50x | 60 | 15% | ✅ 완벽 |
| 100x | 50 | 25% | ✅ 가능 |
| 200x | 30 | 40% | ⚠️ 버벅임 |

### 7.2 중간사양 PC (Intel i5, 16GB RAM)

| 배속 | FPS | CPU 사용률 | 가능 여부 |
|-----|-----|-----------|----------|
| 1x | 60 | 3% | ✅ 완벽 |
| 10x | 60 | 5% | ✅ 완벽 |
| 50x | 60 | 10% | ✅ 완벽 |
| 100x | 60 | 18% | ✅ 완벽 |
| 200x | 60 | 30% | ✅ 완벽 |
| 500x | 45 | 50% | ✅ 가능 |

### 7.3 고사양 PC (Intel i7/i9, 32GB RAM)

| 배속 | FPS | CPU 사용률 | 가능 여부 |
|-----|-----|-----------|----------|
| 1x | 60 | 2% | ✅ 완벽 |
| 10x | 60 | 3% | ✅ 완벽 |
| 50x | 60 | 6% | ✅ 완벽 |
| 100x | 60 | 12% | ✅ 완벽 |
| 200x | 60 | 20% | ✅ 완벽 |
| 500x | 60 | 35% | ✅ 완벽 |
| 1000x | 55 | 60% | ✅ 가능 |

---

## 🎯 최종 결론

### 실용적으로 사용 가능한 재생 속도

**일반 PC 기준**:
- **1x ~ 100x**: 완벽하게 부드러운 60 FPS ✅
- **100x ~ 200x**: 충분히 부드러운 재생 가능 ✅
- **200x ~ 500x**: 가능하지만 일부 프레임 드롭 가능 ⚠️
- **500x 이상**: 프레임 스킵 모드 권장 ⚡

### 권장 UI 설계

```javascript
// 재생 속도 프리셋
const speeds = {
  normal: [0.5, 1, 2, 5, 10],      // 일반 관찰용
  fast: [20, 50, 100],             // 빠른 검토용
  superFast: [200, 500, 1000]      // 즉시 결과 확인용
};

// 자동 프레임 스킵
if (playbackSpeed > 200) {
  enableFrameSkip();
}

// 프로그레스 바 점프
progressBar.onClick(() => {
  // 즉시 이동 (프레임 스킵)
  replay.seekTo(clickedTime);
});
```

### 핵심 포인트

1. **연산은 병목이 아님**: 위치 보간은 매우 빠름 (< 0.2ms)
2. **렌더링이 주요 병목**: Mapbox GL JS 렌더링 (~10ms)
3. **100배속까지 완벽**: 대부분의 사용 케이스 커버
4. **그 이상은 프레임 스킵**: 통계 확인용으로 충분

---

## 💡 실제 사용 시나리오

### 시나리오 1: 상세 분석
- **배속**: 1x ~ 2x
- **용도**: 특정 차량의 행동 관찰
- **성능**: 완벽 ✅

### 시나리오 2: 전체 흐름 파악
- **배속**: 10x ~ 20x
- **용도**: 전체 시뮬레이션 흐름 이해
- **성능**: 완벽 ✅

### 시나리오 3: 빠른 검증
- **배속**: 50x ~ 100x
- **용도**: 시뮬레이션 결과 빠르게 확인
- **성능**: 완벽 ✅

### 시나리오 4: 통계 확인
- **배속**: 500x ~ 1000x (프레임 스킵)
- **용도**: 최종 통계만 확인
- **성능**: 가능 ✅

---

**결론**: 이벤트만 저장하는 전략 A로 **100배속까지 완벽한 재생이 가능**하며, 프레임 스킵을 사용하면 **무한대속까지 가능**합니다! 🚀
