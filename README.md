# Service Car Simulator

서비스 차량 배차 및 운행 시뮬레이터입니다. Mapbox GL JS와 TMAP Route API를 활용하여 실시간 차량 배차, 경로 추적, 그리고 **인터랙티브 시각화 재생** 기능을 제공합니다.

## 🚀 주요 기능

### 1. **시뮬레이션 엔진**
- 시간 기반 이벤트 처리
- Mapbox Isochrone API를 활용한 배차 가능 영역 계산
- TMAP Route API를 통한 정확한 경로 정보
- 차량 상태 관리 (IDLE → MOVING → WORKING)
- 실시간 위치 보간 (Route segment 기반)

### 2. **🎬 인터랙티브 시각화 (NEW!)**
- **차량 실시간 추적**: 타임라인 이벤트 기반 위치 보간 애니메이션
- **경로 시각화**: 이동 중인 차량의 경로 실시간 표시
- **수요 상태 변화**: 발생 → 배차 → 완료/거절 단계별 색상 변화
- **플레이백 컨트롤**: 재생/정지, 속도 조절 (x1, x2, x5), 타임라인 슬라이더
- **상호작용**: 차량/수요 클릭 시 상세 정보 팝업

**자세한 내용**: [시각화 시스템 문서](./docs/VISUALIZATION_SYSTEM.md)

### 3. **Timestamp 기반 기록**
- 모든 이벤트를 timestamp와 함께 기록
- 차량 timeline, 수요 처리 내역, 경로 정보 포함
- JSON 파일로 저장 (재생 가능)

### 4. **배차 알고리즘**
- 4단계 필터링: 상태 체크 → Isochrone 폴리곤 → Job type 매칭 → 최단 거리
- Ray Casting Algorithm으로 폴리곤 내부 차량 판정
- Haversine Formula로 거리 계산

## 🚀 설치 및 실행

### 환경 설정

Windows PowerShell:

```powershell
# .env 파일에 API 토큰 설정
# MAPBOX_TOKEN과 TMAP_API_KEY를 설정하세요

npm install
npm start
```

앱은 기본적으로 http://localhost:5000 에서 제공됩니다.

## 📋 환경 변수

`.env` 파일에 다음 값들을 설정하세요:

```env
MAPBOX_TOKEN=your_mapbox_token_here
TMAP_API_KEY=your_tmap_api_key_here
PORT=5000
```

- **MAPBOX_TOKEN**: Mapbox 지도 표시 및 Isochrone API용 토큰 (https://mapbox.com)
- **TMAP_API_KEY**: TMAP 경로 탐색 API 키 (https://tmapapi.tmapmobility.com)
- **PORT**: 서버 포트 (기본값: 5000)

## 🎮 시뮬레이션 실행

### 1. 빠른 테스트 (30분 시뮬레이션)

```powershell
node tests/run_quick_simulation.js
```

- 프로젝트: `projects/test-simulation`
- 시간: 07:00 ~ 07:30 (30분)
- 차량: 3대
- 수요: 5건

### 2. 전체 시뮬레이션 (Default 프로젝트)

```powershell
node tests/test_simulation.js
```

- 프로젝트: `projects/default`
- 시간: project.json에서 설정
- 차량/수요: CSV 파일에서 로드

### 3. 결과 확인

시뮬레이션 완료 후 `projects/{project-name}/simulation_result.json` 파일이 생성됩니다.

```json
{
  "metadata": {
    "projectName": "test-simulation",
    "simulationVersion": "2.0",
    "startTime": "07:00",
    "endTime": "07:30",
    "completedDemands": 0,
    "rejectedDemands": 5,
    "vehicleUtilizationRate": 0
  },
  "vehicles": [...],
  "routes": [...],
  "demands": [...],
  "events": [...]
}
```

## 📁 프로젝트 구조

```
projects/{project-name}/
├── project.json          # 프로젝트 설정
├── vehicle_set.csv       # 차량 정보
├── demand_data.csv       # 수요 데이터
├── job_type.csv          # 작업 유형 및 서비스 시간
└── simulation_result.json # 시뮬레이션 결과 (자동 생성)
```

### project.json

```json
{
  "waitTimeLimit": 10,
  "operatingTime": {
    "start": "07:00",
    "end": "10:00"
  }
}
```

### vehicle_set.csv

```csv
name,start_latitude,start_longitude,job_type
Vehicle_1,37.5665,126.9780,call
Vehicle_2,37.5700,126.9800,call
```

### demand_data.csv

```csv
request_time,lat,lng,address,job_type
07:05,37.5680,126.9790,서울특별시 종로구 삼일대로,call
07:10,37.5720,126.9810,서울특별시 종로구 종로,call
```

### job_type.csv

```csv
id,job,service_time
0001,call,15
0002,delivery,20
```

## 🛣️ TMAP Route Service

차량 경로 탐색 및 이동 정보 추출 기능이 구현되어 있습니다.

### API 엔드포인트

- `POST /api/route` - 단일 경로 탐색
- `POST /api/route/batch` - 다중 경로 탐색 (배치)
- `POST /api/route/events` - Timestamp 이벤트 생성
- `GET /api/route/test` - API 연결 테스트

자세한 사용법은 [TMAP Route Service 가이드](./docs/TMAP_ROUTE_SERVICE.md)를 참고하세요.

### 테스트 실행

```powershell
node tests/test_tmap_route.js
```

## 🚗 배차 엔진 (Dispatch Engine)

Mapbox Isochrone API를 사용하여 수요 발생 시 도달 가능한 영역을 계산하고, 최적의 차량을 배차합니다.

### 주요 기능

1. **Isochrone 계산**: 수요 위치에서 설정된 대기시간 내 도달 가능한 영역 폴리곤 생성
2. **차량 상태 관리**: 차량의 실시간 상태(IDLE, MOVING_TO_DEMAND, WORKING 등) 추적 및 관리
3. **실시간 위치 보간**: TMAP Route의 구간별 시간/좌표 정보를 활용한 정확한 차량 위치 추적
4. **자동 상태 전이**: 시뮬레이션 시간에 따라 자동으로 차량 상태 변경 (이동→작업→완료)
5. **Job Type별 작업 시간 관리**: `job_type.csv`에서 각 작업 유형의 service_time 자동 조회
6. **폴리곤 내부 차량 탐색**: Ray Casting 알고리즘을 사용하여 Isochrone 영역 내 차량 필터링
7. **Job Type 매칭**: 수요의 job_type과 일치하는 차량만 선택
8. **최단 거리 차량 배차**: Haversine 공식으로 직선 거리를 계산하여 가장 가까운 차량 배차

### 차량 상태(State)

**시나리오**: 수요 위치로 이동 → 작업 수행 → 완료

```
IDLE → MOVING_TO_DEMAND → WORKING → IDLE
```

- **IDLE**: 대기 중 (배차 가능)
- **MOVING_TO_DEMAND**: 수요 위치로 이동 중 (실시간 위치 보간)
- **WORKING**: 작업 중 (service_time 처리)

### 실시간 위치 추적

차량이 이동 중일 때 TMAP Route의 구간별 정보를 활용하여 정확한 위치를 계산합니다.

**TMAP Route 구간 구조:**
```javascript
{
  geometry: {
    coordinates: [[126.985, 37.567], [126.986, 37.567]]
  },
  properties: {
    time: 26,      // 구간 이동 시간 (초)
    distance: 74   // 구간 거리 (미터)
  }
}
```

**위치 보간 로직:**
1. 각 구간의 시간과 좌표를 누적하여 타임라인 생성
2. 현재 시뮬레이션 시간으로 해당 구간 찾기
3. 구간 내 진행률 계산하여 정확한 위치 보간
4. `updateSimulationTime()` 호출 시 자동으로 모든 차량 위치 업데이트

### Job Type 관리

각 수요(demand)의 `job_type`에 따라 작업 시간이 자동으로 결정됩니다.

**설정 파일**: `projects/{project-name}/job_type.csv`

```csv
id,job,service_time
0001,call,15
0002,delivery,20
0003,pickup,10
```

- 수요의 `job_type`이 CSV에 있으면 해당 `service_time` 사용 (분 단위)
- 매칭되는 값이 없으면 기본값 **10분** 사용

자세한 내용은 [차량 상태 관리 설계](./docs/VEHICLE_STATE_MANAGEMENT.md)를 참고하세요.

### 배차 로직

```
수요 발생
  ↓
배차 가능 차량 필터링 (상태 = IDLE)
  ↓
Isochrone 폴리곤 생성 (waitTimeLimit)
  ↓
폴리곤 내부 차량 필터링
  ↓
Job Type 일치 차량 필터링
  ↓
최단 거리 차량 선택
  ↓
배차 완료 (상태 → MOVING_TO_DEMAND)
  ↓
현장 도착 (상태 → WORKING)
  ↓
작업 완료 (상태 → IDLE)
```

### 테스트 실행

기본 배차 테스트:
```powershell
node tests/test_dispatch_engine.js
```

차량 상태 관리 통합 테스트:
```powershell
node tests/test_vehicle_state.js
```

Job Type 관리 테스트:
```powershell
node tests/test_job_type_manager.js
```

실시간 위치 보간 테스트:
```powershell
node tests/test_realtime_position.js
```

테스트 후 생성되는 결과:
- `tests/dispatch_result.json`: 전체 배차 결과
- `tests/isochrone_result.json`: Isochrone 및 차량/수요 위치 (GeoJSON)
- `tests/realtime_position_track.json`: 차량 위치 추적 이력 (GeoJSON)

GeoJSON 파일을 [geojson.io](http://geojson.io)에서 시각화하여 배차 결과를 확인할 수 있습니다.

## 📚 문서

- [SIMULATION_ARCHITECTURE.md](./SIMULATION_ARCHITECTURE.md) - 시뮬레이션 아키텍처 설계
- [UI_MODE_DESIGN.md](./UI_MODE_DESIGN.md) - UI 모드 설계
- [docs/TMAP_ROUTE_SERVICE.md](./docs/TMAP_ROUTE_SERVICE.md) - TMAP 경로 탐색 서비스 가이드
- [docs/VEHICLE_STATE_MANAGEMENT.md](./docs/VEHICLE_STATE_MANAGEMENT.md) - 차량 상태 관리 시스템 설계

## 다음 단계
- ✅ TMAP API 경로 탐색 기능 구현
- ✅ 배차 엔진 Isochrone 계산 기능 구현
- ✅ 차량 배차 로직 구현 (폴리곤 내부 판정, Job Type 매칭, 최단 거리 선택)
- ✅ 차량 상태 관리 시스템 구현 (VehicleStateManager)
- ✅ 실시간 위치 보간 시스템 구현 (TMAP Route 구간별 정보 활용)
- 📋 시뮬레이션 엔진 개발 (이벤트 기록, 재생)
- 🎮 클라이언트 버튼들에 기능 연결
- 📊 수요(Demand) 테이블 CRUD 연결
- 🎨 추가 스타일/반응형 개선
