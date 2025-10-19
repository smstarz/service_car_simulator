# TMAP Route Service 사용 가이드

TMAP API를 사용하여 차량 경로 탐색 및 이동 정보를 추출하는 서비스입니다.

## 📋 목차
1. [설정](#설정)
2. [API 엔드포인트](#api-엔드포인트)
3. [사용 예시](#사용-예시)
4. [데이터 구조](#데이터-구조)
5. [시뮬레이션 통합](#시뮬레이션-통합)

---

## ⚙️ 설정

### 1. 환경 변수 설정

`.env` 파일에 TMAP API 키를 추가하세요:

```env
TMAP_API_KEY=your_tmap_api_key_here
MAPBOX_TOKEN=your_mapbox_token_here
PORT=5000
```

### 2. 패키지 설치

```bash
npm install
```

필요한 의존성:
- `axios` - HTTP 요청
- `express` - 웹 서버
- `dotenv` - 환경 변수 관리

---

## 🚀 API 엔드포인트

### 1. 단일 경로 탐색

**POST** `/api/route`

차량의 현재 위치에서 목적지까지의 경로를 탐색합니다.

#### 요청 (Request)

```json
{
  "startPoint": [126.9784, 37.5665],
  "endPoint": [127.0276, 37.4979],
  "departureTime": "09:30:00"
}
```

#### 응답 (Response)

```json
{
  "success": true,
  "data": {
    "summary": {
      "startPoint": [126.9784, 37.5665],
      "endPoint": [127.0276, 37.4979],
      "departureTime": "09:30:00",
      "totalDistance": 12500,
      "totalTime": 1200,
      "totalDistanceKm": "12.50",
      "totalTimeMinutes": "20.0"
    },
    "route": {
      "type": "LineString",
      "coordinates": [
        [126.9784, 37.5665],
        [126.9800, 37.5650],
        ...
      ]
    },
    "segments": [
      {
        "index": 0,
        "name": "강남대로",
        "distance": 500,
        "time": 60,
        "description": "직진",
        "turnType": 0,
        "pointCount": 10
      },
      ...
    ],
    "coordinates": [[126.9784, 37.5665], ...]
  }
}
```

### 2. 다중 경로 탐색 (배치)

**POST** `/api/route/batch`

여러 경로를 한 번에 탐색합니다.

#### 요청

```json
{
  "routes": [
    {
      "vehicleId": "vehicle_001",
      "startPoint": [126.9784, 37.5665],
      "endPoint": [127.0276, 37.4979],
      "departureTime": "09:30:00"
    },
    {
      "vehicleId": "vehicle_002",
      "startPoint": [127.0000, 37.5000],
      "endPoint": [127.0500, 37.5500],
      "departureTime": "09:35:00"
    }
  ]
}
```

#### 응답

```json
{
  "success": true,
  "count": 2,
  "data": [
    { /* 경로 1 데이터 */ },
    { /* 경로 2 데이터 */ }
  ]
}
```

### 3. Timestamp 이벤트 생성

**POST** `/api/route/events`

경로 정보를 timestamp 기반 이벤트로 변환합니다. 시뮬레이션 기록용입니다.

#### 요청

```json
{
  "startPoint": [126.9784, 37.5665],
  "endPoint": [127.0276, 37.4979],
  "departureTime": "09:30:00",
  "startTimestamp": 34200
}
```

#### 응답

```json
{
  "success": true,
  "data": {
    "route": { /* 경로 정보 */ },
    "events": [
      {
        "timestamp": 34200,
        "type": "route_start",
        "location": [126.9784, 37.5665],
        "remainingDistance": 12500,
        "remainingTime": 1200
      },
      {
        "timestamp": 34260,
        "type": "route_segment",
        "segmentIndex": 0,
        "segmentName": "강남대로",
        "location": [126.9800, 37.5650],
        "distanceTraveled": 500,
        "timeTaken": 60,
        "remainingDistance": 12000,
        "remainingTime": 1140
      },
      ...
      {
        "timestamp": 35400,
        "type": "route_end",
        "location": [127.0276, 37.4979],
        "totalDistance": 12500,
        "totalTime": 1200
      }
    ]
  }
}
```

### 4. API 테스트

**GET** `/api/route/test`

TMAP API 설정 상태를 확인합니다.

#### 응답

```json
{
  "configured": true,
  "message": "TMAP API is configured",
  "apiKeyLength": 40,
  "apiKeyPrefix": "abc12345..."
}
```

---

## 💡 사용 예시

### JavaScript (프론트엔드)

```javascript
// 단일 경로 탐색
async function getRoute(vehicleLocation, demandLocation, time) {
  const response = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startPoint: vehicleLocation,
      endPoint: demandLocation,
      departureTime: time
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('총 거리:', result.data.summary.totalDistanceKm, 'km');
    console.log('소요 시간:', result.data.summary.totalTimeMinutes, '분');
    console.log('경로 좌표:', result.data.coordinates);
  }
  
  return result.data;
}

// 사용
const routeInfo = await getRoute(
  [126.9784, 37.5665],  // 차량 위치
  [127.0276, 37.4979],  // demand 위치
  '09:30:00'            // 출발 시간
);
```

### Node.js (서버 측)

```javascript
const tmapRouteService = require('./services/tmapRouteService');

async function findRouteForVehicle(vehicle, demand, currentTime) {
  try {
    const routeData = await tmapRouteService.getCarRoute({
      startPoint: [vehicle.lng, vehicle.lat],
      endPoint: [demand.pickup_lng, demand.pickup_lat],
      departureTime: currentTime
    });
    
    console.log(`차량 ${vehicle.id} → Demand ${demand.id}`);
    console.log(`거리: ${routeData.summary.totalDistanceKm} km`);
    console.log(`시간: ${routeData.summary.totalTimeMinutes} 분`);
    
    return routeData;
  } catch (error) {
    console.error('경로 탐색 실패:', error.message);
    return null;
  }
}
```

---

## 📊 데이터 구조

### RouteData 구조

```typescript
interface RouteData {
  // 요약 정보
  summary: {
    startPoint: [number, number];      // 출발지 [경도, 위도]
    endPoint: [number, number];        // 도착지 [경도, 위도]
    departureTime: string;             // 출발 시간 "HH:MM:SS"
    totalDistance: number;             // 총 거리 (미터)
    totalTime: number;                 // 총 시간 (초)
    totalDistanceKm: string;           // 총 거리 (킬로미터)
    totalTimeMinutes: string;          // 총 시간 (분)
  };
  
  // GeoJSON LineString 형식의 경로
  route: {
    type: 'LineString';
    coordinates: Array<[number, number]>;
  };
  
  // 구간별 상세 정보
  segments: Array<{
    index: number;           // 구간 인덱스
    name: string;           // 도로명
    distance: number;       // 구간 거리 (미터)
    time: number;          // 구간 소요 시간 (초)
    description: string;   // 설명
    turnType: number;      // 회전 타입
    pointCount: number;    // 좌표 개수
  }>;
  
  // 전체 좌표 배열
  coordinates: Array<[number, number]>;
}
```

### Timestamp Event 구조

```typescript
interface RouteEvent {
  timestamp: number;              // 이벤트 시간 (초)
  type: 'route_start' | 'route_segment' | 'route_end';
  location: [number, number];     // 위치 [경도, 위도]
  
  // route_segment 타입일 때
  segmentIndex?: number;
  segmentName?: string;
  distanceTraveled?: number;
  timeTaken?: number;
  remainingDistance?: number;
  remainingTime?: number;
  
  // route_end 타입일 때
  totalDistance?: number;
  totalTime?: number;
}
```

---

## 🔄 시뮬레이션 통합

### 1. 차량 배차 시 경로 탐색

```javascript
// 시뮬레이션 엔진에서 사용
async function dispatchVehicle(vehicle, demand, currentSimTime) {
  // 1. 경로 탐색
  const routeData = await tmapRouteService.getCarRoute({
    startPoint: [vehicle.currentLng, vehicle.currentLat],
    endPoint: [demand.pickup_lng, demand.pickup_lat],
    departureTime: formatTime(currentSimTime)
  });
  
  // 2. timestamp 이벤트 생성
  const events = tmapRouteService.generateTimestampEvents(
    routeData, 
    currentSimTime
  );
  
  // 3. 차량 상태 업데이트
  vehicle.status = 'en_route_to_pickup';
  vehicle.targetDemand = demand.id;
  vehicle.route = routeData.route;
  vehicle.arrivalTime = currentSimTime + routeData.summary.totalTime;
  
  // 4. 시뮬레이션 결과에 기록
  simulationResult.vehicles.push({
    id: vehicle.id,
    events: events
  });
  
  simulationResult.routes.push({
    id: `route_${Date.now()}`,
    vehicleId: vehicle.id,
    demandId: demand.id,
    type: 'to_pickup',
    startTime: currentSimTime,
    endTime: vehicle.arrivalTime,
    duration: routeData.summary.totalTime,
    distance: routeData.summary.totalDistance,
    path: routeData.coordinates
  });
  
  return routeData;
}
```

### 2. 배치 처리 (여러 차량 동시에)

```javascript
async function findBestVehicleForDemand(demand, availableVehicles, currentTime) {
  // 모든 차량에서 demand까지의 경로 탐색
  const routeRequests = availableVehicles.map(vehicle => ({
    vehicleId: vehicle.id,
    startPoint: [vehicle.lng, vehicle.lat],
    endPoint: [demand.pickup_lng, demand.pickup_lat],
    departureTime: formatTime(currentTime)
  }));
  
  // 배치 요청
  const routes = await tmapRouteService.getMultipleRoutes(routeRequests);
  
  // 가장 가까운 차량 선택
  let bestVehicle = null;
  let minTime = Infinity;
  
  routes.forEach((route, index) => {
    if (route && route.summary.totalTime < minTime) {
      minTime = route.summary.totalTime;
      bestVehicle = {
        vehicle: availableVehicles[index],
        route: route
      };
    }
  });
  
  return bestVehicle;
}
```

### 3. 시뮬레이션 결과 저장

```javascript
// simulation_result.json 형식에 맞게 저장
const simulationResult = {
  metadata: {
    projectName: 'default',
    startTime: '09:00:00',
    endTime: '18:00:00',
    vehicleCount: 10,
    demandCount: 150,
    generatedAt: new Date().toISOString()
  },
  vehicles: [],
  routes: [],
  demands: []
};

// 각 배차마다 경로 정보 추가
for (const dispatch of dispatches) {
  const routeData = await tmapRouteService.getCarRoute({
    startPoint: dispatch.from,
    endPoint: dispatch.to,
    departureTime: dispatch.time
  });
  
  simulationResult.routes.push({
    id: `route_${dispatch.id}`,
    vehicleId: dispatch.vehicleId,
    type: dispatch.type, // 'to_pickup' 또는 'to_destination'
    startTime: dispatch.startTime,
    endTime: dispatch.startTime + routeData.summary.totalTime,
    duration: routeData.summary.totalTime,
    distance: routeData.summary.totalDistance,
    path: routeData.coordinates,
    segments: routeData.segments
  });
}

// 파일 저장
fs.writeFileSync(
  './projects/default/simulation_result.json',
  JSON.stringify(simulationResult, null, 2)
);
```

---

## 🧪 테스트

### 1. API 연결 테스트

```bash
curl http://localhost:5000/api/route/test
```

### 2. 경로 탐색 테스트

```bash
curl -X POST http://localhost:5000/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "startPoint": [126.9784, 37.5665],
    "endPoint": [127.0276, 37.4979],
    "departureTime": "09:30:00"
  }'
```

### 3. 프론트엔드에서 테스트

브라우저 콘솔에서:

```javascript
// 경로 탐색
fetch('/api/route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startPoint: [126.9784, 37.5665],
    endPoint: [127.0276, 37.4979],
    departureTime: '09:30:00'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 📝 참고사항

### 좌표 형식
- **입력**: `[경도(longitude), 위도(latitude)]` 형식
- **예시**: `[126.9784, 37.5665]` (서울시청)

### 시간 형식
- **departureTime**: `"HH:MM:SS"` 형식 (24시간)
- **timestamp**: 초 단위 (예: 09:00:00 = 32400초)

### API 제한사항
- TMAP API 호출 제한에 유의하세요
- 배치 처리 시 적절한 딜레이를 추가할 수 있습니다
- API 키가 없으면 에러가 발생합니다

### 에러 처리
- API 키 미설정: `TMAP_API_KEY is not configured`
- 잘못된 좌표: `startPoint and endPoint must be [longitude, latitude]`
- 경로 없음: `No route found in response`

---

## 🎯 다음 단계

1. ✅ TMAP API 경로 탐색 기능 구현
2. 📋 시뮬레이션 엔진에 통합
3. 📊 실시간 경로 시각화
4. 🔄 Record-Replay 시스템 구현
5. 📈 성능 최적화 및 캐싱

---

**문서 작성일**: 2025-10-18
**버전**: 1.0.0
