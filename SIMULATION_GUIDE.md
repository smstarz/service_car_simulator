# 시뮬레이션 실행 가이드

## 🚀 시뮬레이션 실행하기

### 1. 웹 UI에서 실행

1. 브라우저에서 http://localhost:5000 접속
2. 왼쪽 패널에서 프로젝트 선택
3. **"Run Simulation"** 버튼 클릭
4. 진행 팝업이 표시되며 실시간으로 진행률 확인
5. 완료 후 결과 요약 확인

### 2. 진행 팝업 기능

**표시 정보:**
- 진행률 바 (0-100%)
- 현재 시뮬레이션 시간
- 완료된 수요 수
- 거절된 수요 수
- 대기 중인 수요 수

**취소하기:**
- "Cancel" 버튼 클릭
- 시뮬레이션이 즉시 중단됨

### 3. 결과 확인

시뮬레이션 완료 후:
- `projects/{project-name}/simulation_result.json` 파일 생성
- 완료 팝업에서 요약 정보 확인:
  - 시뮬레이션 시간
  - 차량 수
  - 수요 건수
  - 완료율
  - 차량 가동률

## 🧪 테스트 실행

### 빠른 테스트 (30분)

```powershell
node tests/run_quick_simulation.js
```

- 프로젝트: test-simulation
- 시간: 07:00 ~ 07:30 (30분)
- 차량: 3대
- 수요: 5건

### 전체 시뮬레이션

```powershell
node tests/test_simulation.js
```

- 프로젝트: default
- project.json 설정에 따름

## 📋 프로젝트 구조

```
projects/{project-name}/
├── project.json          # 프로젝트 설정
├── vehicle_set.csv       # 차량 정보
├── demand_data.csv       # 수요 데이터
├── job_type.csv          # 작업 유형
└── simulation_result.json # 결과 (자동 생성)
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
```

### demand_data.csv

```csv
request_time,lat,lng,address,job_type
07:05,37.5680,126.9790,서울특별시 종로구,call
```

### job_type.csv

```csv
id,job,service_time
0001,call,15
```

## 🔧 API 엔드포인트

### 시뮬레이션 실행 (SSE)

```
GET /api/simulation/run/:projectName
```

**응답 (Server-Sent Events):**

```javascript
// 시작
data: {"type":"started","sessionId":"sim_123","projectName":"default"}

// 진행
data: {"type":"progress","progress":25.5,"currentTime":"07:15:00","completed":10,"rejected":2,"pending":15}

// 완료
data: {"type":"completed","success":true,"projectName":"default","summary":{...}}

// 에러
data: {"type":"error","error":"Error message"}

// 취소됨
data: {"type":"cancelled","message":"Simulation cancelled"}
```

### 시뮬레이션 취소

```
POST /api/simulation/cancel/:sessionId
```

### 결과 조회

```
GET /api/simulation/result/:projectName
```

### 상태 확인

```
GET /api/simulation/status/:projectName
```

## 🎯 진행률 업데이트 주기

- **콘솔 로그**: 10분마다 (시뮬레이션 시간)
- **SSE 업데이트**: 1분마다 (시뮬레이션 시간)
- **진행률 바**: 실시간 업데이트

## ⚠️ 문제 해결

### "연결이 끊어졌습니다" 에러

- 서버가 실행 중인지 확인: `npm start`
- 브라우저 새로고침
- 콘솔에서 에러 메시지 확인

### 시뮬레이션이 시작되지 않음

- 프로젝트 선택 확인
- CSV 파일들이 모두 존재하는지 확인
- 서버 콘솔에서 에러 로그 확인

### 진행률이 업데이트되지 않음

- 시뮬레이션 시간이 매우 짧은 경우 (1분 미만)
- 네트워크 연결 확인

## 📊 예상 소요 시간

시뮬레이션은 실시간보다 훨씬 빠르게 실행됩니다:

| 시뮬레이션 시간 | 실제 소요 시간 (예상) |
|----------------|---------------------|
| 30분 | 3-5초 |
| 3시간 | 10-20초 |
| 12시간 | 30-60초 |

*실제 소요 시간은 수요 건수, API 응답 속도에 따라 달라집니다.*

## 🎨 UI 기능

### 진행 팝업

- **다크 글래스모픽 디자인**
- **애니메이션 프로그레스 바**
- **실시간 통계 업데이트**
- **취소 버튼**

### 완료 알림

- 결과 요약 표시
- 파일 경로 안내
- 주요 통계 표시

## 📝 결과 파일 구조

```json
{
  "metadata": {
    "projectName": "default",
    "simulationVersion": "2.0",
    "startTime": "07:00",
    "endTime": "10:00",
    "completedDemands": 132,
    "rejectedDemands": 18
  },
  "vehicles": [...],
  "routes": [...],
  "demands": [...],
  "events": [...]
}
```

자세한 내용은 `docs/TIMESTAMP_EVENT_STRUCTURE_V2.md` 참고

## 🚀 다음 단계

1. ✅ 시뮬레이션 실행 및 결과 생성
2. 🔄 Replay 시스템 구현
3. 🎨 UI에서 재생 기능
4. 📊 통계 시각화

---

**문제가 발생하면 서버 콘솔과 브라우저 콘솔을 확인하세요!**
