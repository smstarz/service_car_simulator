# UI 모드 설계: 시뮬레이션 실행 vs 재생

## 🎯 두 가지 모드 구분

### Mode 1: **SETUP & RUN** (시뮬레이션 실행 모드)
- **목적**: 새로운 시뮬레이션 설정 및 실행
- **입력**: demand_data.csv + 시뮬레이션 파라미터
- **출력**: simulation_result.json 생성
- **UI 상태**: 설정 가능, 실행 버튼 활성화

### Mode 2: **REPLAY** (재생 모드)
- **목적**: 기존 시뮬레이션 결과 시각화
- **입력**: simulation_result.json
- **출력**: 지도 시각화, 통계 표시
- **UI 상태**: 설정 비활성화, 재생 컨트롤만 활성화

---

## 📊 데이터 구조

### 프로젝트 상태 정의

```javascript
// 프로젝트는 3가지 상태 중 하나
const PROJECT_STATE = {
  NO_DATA: 'no_data',           // 빈 프로젝트
  DEMAND_ONLY: 'demand_only',   // demand_data.csv만 있음 → RUN 가능
  SIMULATION_READY: 'simulation_ready'  // simulation_result.json 있음 → REPLAY 가능
};
```

### 프로젝트 메타데이터 확장

```json
// projects/{project-name}/project.json
{
  "name": "default",
  "createdAt": "2025-10-17T10:00:00Z",
  "waitTimeLimit": 10,
  "operatingTime": {
    "start": "09:00",
    "end": "18:00"
  },
  "simulation": {
    "hasResult": true,  // simulation_result.json 존재 여부
    "lastRunAt": "2025-10-17T15:30:00Z",
    "vehicleCount": 20,
    "demandCount": 150,
    "parameters": {
      "vehicleCount": 20,
      "vehicleCapacity": 4,
      "dispatchAlgorithm": "nearest",
      "operatingStart": "09:00",
      "operatingEnd": "18:00"
    },
    "results": {
      "servedDemands": 142,
      "rejectedDemands": 8,
      "avgWaitTime": 330,  // 초
      "avgTravelTime": 450,
      "utilizationRate": 0.78
    }
  }
}
```

---

## 🎨 UI 구조 재설계

### 1. 모드 전환 인디케이터

```
┌─────────────────────────────────────────────────────┐
│ Project: default                [REPLAY MODE] 🔄    │
│                                                      │
│ Simulation: 2025-10-17 15:30 | 142/150 demands      │
│ Vehicles: 20 | Avg Wait: 5m 30s | Utilization: 78%  │
└─────────────────────────────────────────────────────┘
```

### 2. Left Section 업데이트

#### Mode: DEMAND_ONLY (실행 가능)

```html
<div id="left-section">
  <!-- Project 섹션 -->
  <div class="panel-section project-row">
    <div class="section-title">Project</div>
    <div class="project-controls">
      <select id="project-select"></select>
      <button id="project-new">+ New</button>
    </div>
    <!-- 상태 표시 -->
    <div class="project-status">
      <span class="badge bg-warning">⚙️ Ready to Run</span>
      <small>150 demands loaded</small>
    </div>
  </div>

  <!-- Settings 섹션 - 활성화 -->
  <div class="panel-section">
    <div class="section-title">Simulation Settings</div>
    <div class="settings-content">
      <!-- 차량 수 설정 추가 -->
      <div class="vehicle-count-row">
        <label>Number of Vehicles</label>
        <input type="number" id="vehicle-count" value="20" min="1" max="100">
      </div>

      <div class="wait-row">
        <label>Wait Time Limit (min)</label>
        <input type="number" value="10" id="wait-time">
      </div>

      <div class="operating-time-row">
        <label>Operating Time</label>
        <div class="time-picker-group">
          <input type="time" id="operating-start" value="09:00">
          <span>~</span>
          <input type="time" id="operating-end" value="18:00">
        </div>
      </div>

      <!-- 배차 알고리즘 선택 -->
      <div class="algorithm-row">
        <label>Dispatch Algorithm</label>
        <select id="dispatch-algorithm">
          <option value="nearest" selected>Nearest Vehicle</option>
          <option value="fcfs">First Come First Served</option>
          <option value="optimal">Optimal Assignment</option>
        </select>
      </div>
    </div>
  </div>

  <!-- 실행 버튼 -->
  <div class="panel-section">
    <button id="run-simulation" class="btn btn-primary btn-lg w-100">
      <i class="fas fa-play-circle"></i> Run Simulation
    </button>
    <small class="text-muted">This will generate simulation results</small>
  </div>
</div>
```

#### Mode: SIMULATION_READY (재생 가능)

```html
<div id="left-section">
  <!-- Project 섹션 -->
  <div class="panel-section project-row">
    <div class="section-title">Project</div>
    <div class="project-controls">
      <select id="project-select"></select>
      <button id="project-new">+ New</button>
    </div>
    <!-- 상태 표시 -->
    <div class="project-status">
      <span class="badge bg-success">✓ Simulation Ready</span>
      <small>Last run: 2025-10-17 15:30</small>
    </div>
  </div>

  <!-- Simulation Info 섹션 - 읽기 전용 -->
  <div class="panel-section">
    <div class="section-title">
      Simulation Info
      <button id="edit-simulation" class="btn btn-sm btn-outline-secondary">
        <i class="fas fa-edit"></i> Edit & Re-run
      </button>
    </div>
    <div class="simulation-info-content">
      <!-- 읽기 전용 정보 표시 -->
      <div class="info-row">
        <label>Vehicles</label>
        <span class="info-value">20</span>
      </div>
      <div class="info-row">
        <label>Operating Time</label>
        <span class="info-value">09:00 ~ 18:00</span>
      </div>
      <div class="info-row">
        <label>Algorithm</label>
        <span class="info-value">Nearest Vehicle</span>
      </div>
      <div class="info-row">
        <label>Wait Time Limit</label>
        <span class="info-value">10 min</span>
      </div>
    </div>
  </div>

  <!-- 시뮬레이션 결과 통계 -->
  <div class="panel-section">
    <div class="section-title">Results Summary</div>
    <div class="results-summary">
      <div class="result-card">
        <div class="result-label">Demands Served</div>
        <div class="result-value">142 / 150</div>
        <div class="result-percent">94.7%</div>
      </div>
      <div class="result-card">
        <div class="result-label">Avg Wait Time</div>
        <div class="result-value">5m 30s</div>
      </div>
      <div class="result-card">
        <div class="result-label">Utilization</div>
        <div class="result-value">78%</div>
      </div>
    </div>
  </div>

  <!-- 재실행 버튼 -->
  <div class="panel-section">
    <button id="rerun-simulation" class="btn btn-warning w-100">
      <i class="fas fa-redo"></i> Re-run Simulation
    </button>
  </div>
</div>
```

### 3. Playback Controls 동적 업데이트

#### DEMAND_ONLY 모드: 비활성화
```html
<div id="playback-controls" class="disabled">
  <button id="play-toggle" disabled>
    <i class="fas fa-play"></i>
  </button>
  <!-- ... 모든 컨트롤 비활성화 ... -->
  <div class="playback-message">
    <i class="fas fa-info-circle"></i>
    Run simulation first to enable playback
  </div>
</div>
```

#### SIMULATION_READY 모드: 활성화
```html
<div id="playback-controls" class="active">
  <button id="play-toggle" class="btn btn-primary">
    <i class="fas fa-play"></i>
  </button>
  
  <!-- Timeline -->
  <div class="timeline-container">
    <span id="current-time">09:00:00</span>
    <div id="timeline-slider"></div>
    <span id="total-time">18:00:00</span>
  </div>

  <!-- 속도 선택 - 확장 -->
  <select id="speed-select">
    <option value="0.5">x0.5</option>
    <option value="1">x1</option>
    <option value="2">x2</option>
    <option value="5" selected>x5</option>
    <option value="10">x10</option>
    <option value="30">x30</option>
    <option value="60">x60</option>
  </select>

  <!-- 추가 컨트롤 -->
  <button id="stop-btn">
    <i class="fas fa-stop"></i>
  </button>

  <!-- 통계 모드 토글 -->
  <button id="stats-mode-toggle" title="Show statistics only">
    <i class="fas fa-chart-bar"></i>
  </button>
</div>
```

### 4. Demand Table 업데이트

#### DEMAND_ONLY 모드
```html
<table class="demand-table">
  <thead>
    <tr>
      <th>no.</th>
      <th>id</th>
      <th>address</th>
      <th>longitude</th>
      <th>latitude</th>
      <th>time</th>
      <th>job_type</th>
      <!-- 시뮬레이션 결과 컬럼은 회색 처리 -->
      <th class="result-column disabled">result</th>
      <th class="result-column disabled">vehicle</th>
      <th class="result-column disabled">wait_time</th>
      <th class="result-column disabled">pickup_time</th>
      <th class="result-column disabled">dropoff_time</th>
    </tr>
  </thead>
</table>
```

#### SIMULATION_READY 모드
```html
<table class="demand-table">
  <thead>
    <tr>
      <th>no.</th>
      <th>id</th>
      <th>address</th>
      <th>longitude</th>
      <th>latitude</th>
      <th>time</th>
      <th>job_type</th>
      <!-- 결과 컬럼 활성화 -->
      <th class="result-column active">result</th>
      <th class="result-column active">vehicle</th>
      <th class="result-column active">wait_time</th>
      <th class="result-column active">pickup_time</th>
      <th class="result-column active">dropoff_time</th>
    </tr>
  </thead>
  <tbody>
    <tr class="demand-row completed">
      <td>1</td>
      <td>m5UdEg</td>
      <td>서울특별시 중구 이태원로 149</td>
      <td>126.9844</td>
      <td>37.4672</td>
      <td>09:00:00</td>
      <td>call</td>
      <!-- 시뮬레이션 결과 -->
      <td><span class="badge bg-success">✓ Completed</span></td>
      <td>vehicle_003</td>
      <td>5m 30s</td>
      <td>09:05:30</td>
      <td>09:15:20</td>
    </tr>
    <tr class="demand-row rejected">
      <td>2</td>
      <td>abc123</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>09:30:00</td>
      <td>call</td>
      <!-- 거부된 수요 -->
      <td><span class="badge bg-danger">✗ Rejected</span></td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
    </tr>
  </tbody>
</table>
```

---

## 🔄 모드 전환 플로우

### 프로젝트 로드 시

```javascript
async function loadProject(projectName) {
  // 1. 프로젝트 메타데이터 로드
  const meta = await fetch(`/projects/${projectName}/meta`).then(r => r.json());
  
  // 2. demand_data.csv 체크
  const hasDemand = await checkFileExists(`/projects/${projectName}/demand`);
  
  // 3. simulation_result.json 체크
  const hasSimulation = meta.simulation?.hasResult || 
                        await checkFileExists(`/projects/${projectName}/simulation`);
  
  // 4. 모드 결정
  let mode;
  if (!hasDemand) {
    mode = 'NO_DATA';
  } else if (!hasSimulation) {
    mode = 'DEMAND_ONLY';
  } else {
    mode = 'SIMULATION_READY';
  }
  
  // 5. UI 업데이트
  updateUIForMode(mode, meta);
}
```

### UI 업데이트 함수

```javascript
function updateUIForMode(mode, projectMeta) {
  const leftSection = document.getElementById('left-section');
  const playbackControls = document.getElementById('playback-controls');
  const demandTable = document.querySelector('.demand-table');
  
  switch(mode) {
    case 'NO_DATA':
      // 빈 프로젝트 상태
      leftSection.innerHTML = renderNoDataUI();
      playbackControls.classList.add('disabled');
      break;
      
    case 'DEMAND_ONLY':
      // 시뮬레이션 실행 가능 상태
      leftSection.innerHTML = renderSetupUI(projectMeta);
      playbackControls.classList.add('disabled');
      
      // Run Simulation 버튼 이벤트
      document.getElementById('run-simulation').addEventListener('click', () => {
        runSimulation(projectMeta);
      });
      break;
      
    case 'SIMULATION_READY':
      // 재생 가능 상태
      leftSection.innerHTML = renderReplayUI(projectMeta);
      playbackControls.classList.remove('disabled');
      
      // 시뮬레이션 결과 로드
      loadSimulationResult(projectMeta.name);
      
      // Edit & Re-run 버튼 이벤트
      document.getElementById('edit-simulation').addEventListener('click', () => {
        switchToSetupMode(projectMeta);
      });
      break;
  }
}
```

### 시뮬레이션 실행

```javascript
async function runSimulation(projectMeta) {
  // 1. UI 상태 변경
  showLoadingOverlay('Running simulation...');
  
  // 2. 파라미터 수집
  const params = {
    projectName: projectMeta.name,
    vehicleCount: parseInt(document.getElementById('vehicle-count').value),
    waitTimeLimit: parseInt(document.getElementById('wait-time').value),
    operatingStart: document.getElementById('operating-start').value,
    operatingEnd: document.getElementById('operating-end').value,
    dispatchAlgorithm: document.getElementById('dispatch-algorithm').value
  };
  
  // 3. 서버에 시뮬레이션 실행 요청
  const response = await fetch('/api/simulation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  const result = await response.json();
  
  if (result.success) {
    // 4. 성공 시 REPLAY 모드로 전환
    hideLoadingOverlay();
    showSuccessMessage(`Simulation completed! ${result.servedDemands}/${result.totalDemands} demands served`);
    
    // 프로젝트 다시 로드 (이제 SIMULATION_READY 상태)
    loadProject(projectMeta.name);
  } else {
    hideLoadingOverlay();
    showErrorMessage('Simulation failed: ' + result.error);
  }
}
```

---

## 🎨 CSS 스타일 추가

```css
/* 모드 상태 배지 */
.project-status {
  margin-top: 10px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.project-status .badge {
  margin-right: 8px;
}

/* 시뮬레이션 정보 (읽기 전용) */
.simulation-info-content .info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.simulation-info-content .info-value {
  font-weight: 600;
  color: #333;
}

/* 결과 통계 카드 */
.results-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px;
  border-radius: 8px;
}

.result-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 5px;
}

.result-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 5px;
}

.result-percent {
  font-size: 14px;
  opacity: 0.9;
}

/* Playback Controls 비활성화 */
#playback-controls.disabled {
  opacity: 0.5;
  pointer-events: none;
}

#playback-controls .playback-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
}

/* 테이블 결과 컬럼 */
.result-column.disabled {
  background: #f5f5f5;
  color: #999;
}

.result-column.active {
  background: #e8f5e9;
}

.demand-row.completed {
  background: #f1f8f4;
}

.demand-row.rejected {
  background: #fff3f3;
}
```

---

## 📡 서버 API 엔드포인트

### 1. 프로젝트 메타데이터 조회
```
GET /projects/:projectName/meta
Response: { name, simulation: { hasResult, lastRunAt, results, ... } }
```

### 2. 시뮬레이션 실행
```
POST /api/simulation/run
Body: { projectName, vehicleCount, waitTimeLimit, operatingStart, operatingEnd, dispatchAlgorithm }
Response: { success, servedDemands, totalDemands, resultPath }
```

### 3. 시뮬레이션 결과 조회
```
GET /projects/:projectName/simulation
Response: { metadata, vehicles, events, routes, demands }
```

### 4. 시뮬레이션 결과 삭제 (재실행 전)
```
DELETE /projects/:projectName/simulation
Response: { success }
```

---

## 🔧 서버 구현 예시 (server.js)

```javascript
// 시뮬레이션 실행 엔드포인트
app.post('/api/simulation/run', async (req, res) => {
  const { projectName, vehicleCount, waitTimeLimit, operatingStart, operatingEnd, dispatchAlgorithm } = req.body;
  
  try {
    // 1. demand_data.csv 로드
    const demandPath = path.join(__dirname, 'projects', projectName, 'demand_data.csv');
    const demandData = await loadDemandCSV(demandPath);
    
    // 2. 시뮬레이션 실행
    const result = await runSimulationEngine({
      demands: demandData,
      vehicleCount,
      waitTimeLimit,
      operatingStart,
      operatingEnd,
      algorithm: dispatchAlgorithm
    });
    
    // 3. 결과 저장
    const resultPath = path.join(__dirname, 'projects', projectName, 'simulation_result.json');
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
    
    // 4. 프로젝트 메타데이터 업데이트
    const metaPath = path.join(__dirname, 'projects', projectName, 'project.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    meta.simulation = {
      hasResult: true,
      lastRunAt: new Date().toISOString(),
      vehicleCount,
      demandCount: demandData.length,
      parameters: { vehicleCount, waitTimeLimit, operatingStart, operatingEnd, dispatchAlgorithm },
      results: {
        servedDemands: result.metadata.servedDemands,
        rejectedDemands: result.metadata.rejectedDemands,
        avgWaitTime: calculateAvgWaitTime(result.demands),
        utilizationRate: calculateUtilization(result.vehicles)
      }
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    
    res.json({ success: true, ...result.metadata });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 시뮬레이션 결과 조회
app.get('/projects/:projectName/simulation', async (req, res) => {
  const resultPath = path.join(__dirname, 'projects', req.params.projectName, 'simulation_result.json');
  
  if (!fs.existsSync(resultPath)) {
    return res.status(404).json({ error: 'Simulation result not found' });
  }
  
  const result = JSON.parse(await fs.readFile(resultPath, 'utf-8'));
  res.json(result);
});
```

---

## 🎯 사용자 워크플로우

### 새 프로젝트 생성 → 시뮬레이션 실행
```
1. "+ New" 버튼 클릭 → 프로젝트 생성
2. "Upload CSV" → demand_data.csv 업로드
3. 상태: NO_DATA → DEMAND_ONLY
4. Settings 섹션에서 파라미터 설정
   - 차량 수: 20
   - 운영 시간: 09:00 ~ 18:00
   - 배차 알고리즘: Nearest Vehicle
5. "Run Simulation" 버튼 클릭
6. 진행 상황 표시 (로딩 오버레이)
7. 완료 후 자동으로 SIMULATION_READY 모드로 전환
8. Play 버튼으로 재생 시작
```

### 기존 프로젝트 재생
```
1. 프로젝트 드롭다운에서 선택
2. 자동으로 SIMULATION_READY 모드 로드
3. 결과 통계 표시
4. Play 버튼으로 즉시 재생 가능
```

### 파라미터 변경 후 재실행
```
1. "Edit & Re-run" 버튼 클릭
2. SIMULATION_READY → DEMAND_ONLY 모드로 전환
3. 설정 수정
4. "Run Simulation" 다시 클릭
5. 새로운 결과로 덮어쓰기
```

---

## 📊 정리

### 핵심 변경사항

1. **3가지 프로젝트 상태**: NO_DATA / DEMAND_ONLY / SIMULATION_READY
2. **동적 UI**: 상태에 따라 Left Section 완전히 재구성
3. **Playback Controls**: SIMULATION_READY일 때만 활성화
4. **Demand Table**: 결과 컬럼은 시뮬레이션 후에만 표시
5. **서버 API**: 시뮬레이션 실행 및 결과 관리 엔드포인트 추가
6. **통계 표시**: 재생 모드에서 요약 통계 표시

이 구조로 **실행**과 **재생**이 명확히 분리되며, 사용자는 직관적으로 워크플로우를 이해할 수 있습니다! 🚀
