import { validateAndNormalizeRows } from './utils/csv.js';
import { DemandMarkersManager } from './utils/demandMarkers.js';
import { VehicleSettingsManager } from './utils/vehicleSettings.js';
import { JobTypeSettingsManager } from './utils/jobTypeSettings.js';

// Global instances
let demandMarkersManager = null;
let vehicleSettingsManager = null;
let jobTypeSettingsManager = null;

// Fetch token from server config endpoint and init Mapbox map
async function init(){
  console.log('init() function called');
  try{
    const res = await fetch('/config');
    const json = await res.json();
    const token = json.MAPBOX_TOKEN;
    if(!token){
      console.warn('No MAPBOX_TOKEN provided in environment. Map will load in limited mode.');
    }

    mapboxgl.accessToken = token || undefined;
    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [126.9784,37.5665], // Seoul
      zoom: 12
    });

    // Initialize demand markers manager
    demandMarkersManager = new DemandMarkersManager(map);

    // simple map placeholder controls
    map.addControl(new mapboxgl.NavigationControl());

    // wire Download Form button
    const downloadBtn = document.getElementById('download-form');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        window.location.href = '/download/form';
      });
    }

    // wire Download CSV (project demand) button
    const downloadCsvBtn = document.getElementById('download-csv');
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', () => {
        const projectName = projectSelect ? projectSelect.value : null;
        if (!projectName) {
          alert('Please select a project first');
          return;
        }
        window.location.href = `/projects/${encodeURIComponent(projectName)}/demand/download`;
      });
    }

    // wire Run Simulation button
    const runSimulationBtn = document.getElementById('run-simulation');
    if (runSimulationBtn) {
      runSimulationBtn.addEventListener('click', async () => {
        const projectName = projectSelect ? projectSelect.value : null;
        if (!projectName) {
          alert('프로젝트를 먼저 선택해주세요.');
          return;
        }

        // Show progress modal
        const progressModal = new bootstrap.Modal(document.getElementById('simulationProgressModal'));
        progressModal.show();

        // Get modal elements
        const statusText = document.getElementById('sim-status-text');
        const currentTimeText = document.getElementById('sim-current-time');
        const progressBar = document.getElementById('simulation-progress-bar');
        const completedText = document.getElementById('sim-completed');
        const rejectedText = document.getElementById('sim-rejected');
        const pendingText = document.getElementById('sim-pending');
        const cancelBtn = document.getElementById('cancel-simulation-btn');

        let sessionId = null;
        let eventSource = null;

        // Cancel button handler
        const cancelHandler = async () => {
          if (sessionId && eventSource) {
            try {
              await fetch(`/api/simulation/cancel/${sessionId}`, {
                method: 'POST'
              });
              statusText.textContent = 'Cancelling...';
              cancelBtn.disabled = true;
            } catch (error) {
              console.error('Failed to cancel simulation:', error);
            }
          }
        };

        cancelBtn.onclick = cancelHandler;

        try {
          console.log(`Starting simulation for project: ${projectName}`);
          
          // Create EventSource for SSE
          eventSource = new EventSource(`/api/simulation/run/${encodeURIComponent(projectName)}`);

          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('SSE message:', data);

            switch (data.type) {
              case 'started':
                sessionId = data.sessionId;
                statusText.textContent = 'Starting...';
                break;

              case 'progress':
                if (data.progress !== undefined) {
                  progressBar.style.width = `${data.progress}%`;
                  progressBar.textContent = `${data.progress.toFixed(1)}%`;
                  progressBar.setAttribute('aria-valuenow', data.progress);
                }
                if (data.currentTime) {
                  currentTimeText.textContent = data.currentTime;
                }
                if (data.message) {
                  statusText.textContent = data.message;
                }
                if (data.completed !== undefined) {
                  completedText.textContent = data.completed;
                }
                if (data.rejected !== undefined) {
                  rejectedText.textContent = data.rejected;
                }
                if (data.pending !== undefined) {
                  pendingText.textContent = data.pending;
                }
                break;

              case 'completed':
                eventSource.close();
                progressBar.style.width = '100%';
                progressBar.textContent = '100%';
                progressBar.classList.remove('progress-bar-animated');
                statusText.textContent = 'Completed!';
                
                // Hide modal after a short delay
                setTimeout(() => {
                  progressModal.hide();
                  
                  // Show success message
                  alert(
                    `✅ 시뮬레이션 완료!\n\n` +
                    `프로젝트: ${data.projectName}\n` +
                    `시뮬레이션 시간: ${data.summary.duration}초\n` +
                    `차량 수: ${data.summary.vehicles}대\n` +
                    `수요 건수: ${data.summary.demands}건\n` +
                    `완료: ${data.summary.completed}건\n` +
                    `거절: ${data.summary.rejected}건\n` +
                    `완료율: ${data.summary.completionRate}\n` +
                    `차량 가동률: ${data.summary.utilization}\n\n` +
                    `결과 파일: ${data.resultFile}`
                  );
                }, 500);
                break;

              case 'error':
                eventSource.close();
                progressModal.hide();
                alert(`❌ 시뮬레이션 실행 중 오류가 발생했습니다:\n\n${data.error}`);
                console.error('Simulation error:', data);
                break;

              case 'cancelled':
                eventSource.close();
                progressModal.hide();
                alert('⏹️ 시뮬레이션이 취소되었습니다.');
                break;
            }
          };

          eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            eventSource.close();
            progressModal.hide();
            alert('❌ 시뮬레이션 연결이 끊어졌습니다.');
          };

        } catch (error) {
          console.error('Simulation error:', error);
          progressModal.hide();
          alert(`❌ 시뮬레이션 실행 중 오류가 발생했습니다:\n\n${error.message}`);
        }

        // Cleanup on modal close
        document.getElementById('simulationProgressModal').addEventListener('hidden.bs.modal', () => {
          if (eventSource) {
            eventSource.close();
          }
          cancelBtn.onclick = null;
        }, { once: true });
      });
    }

  // populate project dropdown from server-side projects folder
    const projectSelect = document.getElementById('project-select');
    if (projectSelect) {
      fetch('/projects')
        .then(r => r.json())
        .then(json => {
          const list = Array.isArray(json.projects) ? json.projects : [];
          // clear existing options except the first placeholder
          while (projectSelect.options.length > 0) projectSelect.remove(0);
          list.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            projectSelect.appendChild(opt);
          });
          // if there's at least one project, select the first and load its demand
          if (list.length > 0) {
            projectSelect.value = list[0];
            loadProjectDemand(list[0]);
          }
        })
        .catch(err => {
          console.error('Failed to load projects', err);
        });
    }

  // state: current normalized rows and errors
  let currentRows = null; // array of rows (header + data rows)
  let currentErrors = [];

  // load demand CSV for the given project and populate the table
    async function loadProjectDemand(projectName) {
      try {
        // load project metadata and apply to UI
        try {
          const metaRes = await fetch(`/projects/${encodeURIComponent(projectName)}/meta`);
          if (metaRes.ok) {
            const meta = await metaRes.json();
            // apply waitTimeLimit and operatingTime if present
            const waitEl = document.getElementById('wait-time');
            if (waitEl && typeof meta.waitTimeLimit !== 'undefined') waitEl.value = String(meta.waitTimeLimit);
            const startEl = document.getElementById('operating-start');
            const endEl = document.getElementById('operating-end');
            if (meta.operatingTime && startEl && endEl) {
              if (typeof meta.operatingTime.start === 'string') startEl.value = meta.operatingTime.start;
              if (typeof meta.operatingTime.end === 'string') endEl.value = meta.operatingTime.end;
              // notify other UI that operating time changed
              const ev = new CustomEvent('operating-time-changed', { detail: { start: startEl.value, end: endEl.value } });
              document.dispatchEvent(ev);
            }
          }
        } catch (err) {
          console.warn('Failed to load project metadata', err);
        }

        const res = await fetch(`/projects/${encodeURIComponent(projectName)}/demand`);
        if (!res.ok) {
          // no file, clear table
          clearTablePlaceholder();
          if (demandMarkersManager) demandMarkersManager.clear();
          return;
        }
        const text = await res.text();
        const rows = parseCSV(text);
        const result = validateAndNormalizeRows(rows);
        currentRows = result.rows;
        currentErrors = result.errors || [];
        populateTableFromCSVText(currentRows, currentErrors);
        
        // Load demand data into markers manager
        if (demandMarkersManager && currentRows) {
          demandMarkersManager.loadDemandData(currentRows);
        }
      } catch (err) {
        console.error('Failed to load project demand', err);
      }
    }

    // attach change handler for project select
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        const name = e.target.value;
        if (name) {
          loadProjectDemand(name);
          // 프로젝트 변경 시 차량 설정 로드
          if (vehicleSettingsManager) {
            vehicleSettingsManager.loadVehicles(name).catch(err => {
              console.error('Failed to load vehicles:', err);
            });
          }
        }
      });
    }

  // handle + New project creation
    const projectNewBtn = document.getElementById('project-new');
    if (projectNewBtn && projectSelect) {
      projectNewBtn.addEventListener('click', async () => {
        const name = prompt('새 프로젝트 이름을 입력하세요 (영문/숫자/-/_만 가능):');
        if (!name) return;
        try {
          const res = await fetch('/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
          });
          const json = await res.json();
          if (!res.ok) {
            alert('프로젝트 생성 실패: ' + (json.error || res.statusText));
            return;
          }
          // add to dropdown and select
          const opt = document.createElement('option');
          opt.value = json.name;
          opt.textContent = json.name;
          projectSelect.appendChild(opt);
          projectSelect.value = json.name;
        } catch (err) {
          console.error('Failed to create project', err);
          alert('프로젝트 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
      });
    }

  // wire Upload CSV button
    const uploadBtn = document.getElementById('upload-csv');
    if (uploadBtn) {
      // create a hidden file input (only once)
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv,text/csv';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
          const text = evt.target.result;
          try {
            const rows = parseCSV(text);
            if (!rows || rows.length === 0) {
              alert('CSV 파일이 비어있습니다.');
              return;
            }

            // validate and normalize rows using utils
            const result = validateAndNormalizeRows(rows);
            const normalized = result.rows; // header + data rows
            // render normalized rows into table and highlight errors if any
            currentRows = normalized;
            currentErrors = result.errors || [];
            populateTableFromCSVText(currentRows, currentErrors);

            // Load demand data into markers manager
            if (demandMarkersManager && normalized) {
              demandMarkersManager.loadDemandData(normalized);
            }

            // save normalized CSV text into project if selected
            const currentProject = projectSelect ? projectSelect.value : null;
            if (currentProject) {
              // reconstruct CSV text from normalized rows
              const csvText = normalized.map(r => r.map(cell => {
                // escape if contains comma or quote
                if (cell == null) return '';
                const s = String(cell);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                  return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
              }).join(',')).join('\n');

              fetch(`/projects/${encodeURIComponent(currentProject)}/demand`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv: csvText })
              }).then(r => r.json()).then(j => {
                if (!j || j.error) console.warn('Failed to save CSV to project', j && j.error);
              }).catch(err => console.error('Failed to save csv to project', err));
            }

          } catch (err) {
            console.error('CSV parsing error', err);
            alert('CSV 파싱 중 오류가 발생했습니다. 콘솔을 확인하세요.');
          }
        };
        reader.readAsText(file, 'utf-8');
        // reset input so same file can be selected again if needed
        fileInput.value = null;
      });

      uploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
    }

    function clearTablePlaceholder() {
      const tbody = document.getElementById('demand-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const tr = document.createElement('tr');
      tr.className = 'empty-row';
      const td = document.createElement('td');
      td.colSpan = 12;
      td.textContent = 'No data loaded';
      tr.appendChild(td);
      tbody.appendChild(tr);
      const totalEl = document.querySelector('.total-count');
      if (totalEl) totalEl.textContent = 'Total Demand : 00';
      // reset state
      currentRows = null;
      currentErrors = [];
    }

    function populateTableFromCSVText(textOrRows, errors = []) {
      try {
        const rows = Array.isArray(textOrRows) ? textOrRows : parseCSV(textOrRows);
        if (!rows || rows.length === 0) {
          clearTablePlaceholder();
          return;
        }
        // store into currentRows/currentErrors if provided
        if (Array.isArray(textOrRows)) {
          currentRows = textOrRows;
        }
        currentErrors = errors || [];
        const header = rows[0].map(h => h.toString().trim().toLowerCase());
        const tableCols = ['id','address','longitude','latitude','time','job_type','result','vehicle','distance','arrived_time','complete_time'];
        const tbody = document.getElementById('demand-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        let rowNo = 0;
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (r.every(cell => cell === '' || cell == null)) continue;
          rowNo++;
          const tr = document.createElement('tr');
          const noTd = document.createElement('td');
          noTd.textContent = String(rowNo);
          tr.appendChild(noTd);
          for (let colIndex = 0; colIndex < tableCols.length; colIndex++) {
            const col = tableCols[colIndex];
            const td = document.createElement('td');
            const idx = header.indexOf(col);
            td.textContent = idx >= 0 ? (r[idx] ?? '') : '';
            // determine if this cell has an error
            const dataRowIndex = i; // matches error.row in utils
            const fieldErrors = errors.filter(er => er.row === dataRowIndex && er.field === col);
            if (fieldErrors.length > 0) {
              td.classList.add('cell-error');
              td.title = fieldErrors.map(fe => fe.message).join('; ');
            }
            // make editable except for id column
            if (col !== 'id') {
              td.contentEditable = 'true';
              // prevent Enter from inserting newlines; treat Enter as commit
              td.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  // collapse any newlines and trim
                  const cleaned = ev.target.textContent.replace(/\r?\n/g, ' ').trim();
                  ev.target.textContent = cleaned;
                  // trigger blur to reuse validation/save logic
                  ev.target.blur();
                }
              });
              td.addEventListener('blur', (ev) => {
                const newVal = ev.target.textContent.trim();
                // update currentRows
                if (currentRows && currentRows[i]) {
                  if (idx >= 0) currentRows[i][idx] = newVal;
                }
                // validate this cell according to rules
                let cellHasError = false;
                if (['address','longitude','latitude','time','job_type'].includes(col)) {
                  if (!newVal) cellHasError = true;
                  if (col === 'time' && newVal && !/^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(newVal)) {
                    cellHasError = true;
                  }
                }
                if (cellHasError) {
                  ev.target.classList.add('cell-error');
                } else {
                  ev.target.classList.remove('cell-error');
                  ev.target.removeAttribute('title');
                  // remove corresponding error from currentErrors
                  currentErrors = currentErrors.filter(er => !(er.row === dataRowIndex && er.field === col));
                  // async save entire CSV for current project
                  try {
                    const projectName = projectSelect ? projectSelect.value : null;
                    if (projectName && currentRows) {
                      // indicate saving
                      ev.target.classList.add('cell-saving');
                      const csvText = currentRows.map(r => r.map(cell => {
                        if (cell == null) return '';
                        const s = String(cell);
                        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                          return '"' + s.replace(/"/g, '""') + '"';
                        }
                        return s;
                      }).join(',')).join('\n');

                      fetch(`/projects/${encodeURIComponent(projectName)}/demand`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ csv: csvText })
                      }).then(r => r.json()).then(j => {
                        if (j && j.error) console.warn('Failed to save CSV to project', j.error);
                      }).catch(err => console.error('Failed to save csv to project', err)).finally(() => {
                        ev.target.classList.remove('cell-saving');
                      });
                    }
                  } catch (err) {
                    console.error('Async save error', err);
                  }
                }
              });
            } else {
              td.contentEditable = 'false';
            }
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        const total = tbody.querySelectorAll('tr').length;
        const totalEl = document.querySelector('.total-count');
        if (totalEl) totalEl.textContent = 'Total Demand : ' + String(total).padStart(2, '0');
      } catch (err) {
        console.error('populateTableFromCSVText error', err);
        clearTablePlaceholder();
      }
    }

  } catch(err){
    console.error('Failed to init map', err);
  }

// Save metadata helper: collects from DOM and POSTs to server
async function saveProjectMetadata(projectName) {
  if (!projectName) return;
  const waitEl = document.getElementById('wait-time');
  const startEl = document.getElementById('operating-start');
  const endEl = document.getElementById('operating-end');
  const meta = {
    waitTimeLimit: waitEl ? Number(waitEl.value) || 0 : 0,
    operatingTime: {
      start: startEl ? startEl.value : '09:00',
      end: endEl ? endEl.value : '18:00'
    }
  };
  try {
    await fetch(`/projects/${encodeURIComponent(projectName)}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    });
    // notify UI that operating time may have changed
    const ev = new CustomEvent('operating-time-changed', { detail: { start: meta.operatingTime.start, end: meta.operatingTime.end } });
    document.dispatchEvent(ev);
  } catch (err) {
    console.warn('Failed to save project metadata', err);
  }
}

// wire settings inputs to save on change
const waitInput = document.getElementById('wait-time');
const opStart = document.getElementById('operating-start');
const opEnd = document.getElementById('operating-end');

// Validate operating time: end time must be after start time
function validateOperatingTime() {
  if (!opStart || !opEnd) return true;
  const startVal = opStart.value;
  const endVal = opEnd.value;
  if (!startVal || !endVal) return true;
  
  // Parse times to compare
  const startParts = startVal.split(':').map(Number);
  const endParts = endVal.split(':').map(Number);
  const startMinutes = startParts[0] * 60 + (startParts[1] || 0);
  const endMinutes = endParts[0] * 60 + (endParts[1] || 0);
  
  if (endMinutes <= startMinutes) {
    alert('운영 종료 시간은 시작 시간보다 늦어야 합니다.');
    return false;
  }
  return true;
}

function onSettingChanged() {
  const projectSelect = document.getElementById('project-select');
  const currentProject = projectSelect ? projectSelect.value : null;
  if (currentProject) saveProjectMetadata(currentProject);
}

if (waitInput) waitInput.addEventListener('change', onSettingChanged);
if (opStart) opStart.addEventListener('change', () => {
  if (validateOperatingTime()) {
    onSettingChanged();
  } else {
    // Reset to previous valid value or default
    opStart.value = '09:00';
  }
});
if (opEnd) opEnd.addEventListener('change', () => {
  if (validateOperatingTime()) {
    onSettingChanged();
  } else {
    // Reset to previous valid value or default
    opEnd.value = '18:00';
  }
});
}

// start
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Vehicle Settings Manager
  vehicleSettingsManager = new VehicleSettingsManager();
  
  // Initialize Job Type Settings Manager
  jobTypeSettingsManager = new JobTypeSettingsManager();

  // wire playback UI and make it follow operating time
  const playToggle = document.getElementById('play-toggle');
  const stopBtn = document.getElementById('stop-btn');
  const timelineEl = document.getElementById('timeline-slider');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');
  const speedSelect = document.getElementById('speed-select');

  let playing = false;
  let current = 0; // absolute seconds since midnight (may extend past 24h for ranges spanning midnight)
  let rafId = null;
  let noui = null;
  let updatingSlider = false; // flag to prevent nouiUpdateHandler from overwriting current during programmatic updates

  function parseTimeToSeconds(str) {
    if (!str) return NaN;
    const parts = str.split(':').map(p => Number(p || 0));
    if (parts.length === 2) return parts[0]*3600 + parts[1]*60;
    if (parts.length >= 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    return NaN;
  }

  function formatTime(s) {
    const secOfDay = Math.floor(s) % 86400;
    const h = Math.floor(secOfDay/3600).toString().padStart(2,'0');
    const m = Math.floor((secOfDay%3600)/60).toString().padStart(2,'0');
    const sec = Math.floor(secOfDay%60).toString().padStart(2,'0');
    return `${h}:${m}:${sec}`;
  }

  function getOperatingRange() {
    const startEl = document.getElementById('operating-start');
    const endEl = document.getElementById('operating-end');
    const startStr = startEl ? startEl.value : '09:00';
    const endStr = endEl ? endEl.value : '18:00';
    let startSec = parseTimeToSeconds(startStr);
    let endSec = parseTimeToSeconds(endStr);
    if (Number.isNaN(startSec) || Number.isNaN(endSec)) { startSec = 9*3600; endSec = 18*3600; }
    if (endSec <= startSec) endSec += 24*3600;
    return { startSec, endSec, duration: endSec - startSec, startStr, endStr };
  }

  function nouiUpdateHandler(values, handle) {
    const v = Number(values[handle]);
    // Only update current if user is dragging (not playing and not programmatically updating)
    if (!playing && !updatingSlider) {
      current = Math.floor(v);
      
      // Update markers when user drags the timeline (needs to rebuild from scratch)
      if (demandMarkersManager) {
        demandMarkersManager.clearAllMarkers();
        demandMarkersManager.update(current);
      }
    }
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
  }

  function applyOperatingRangeToSlider() {
    const range = getOperatingRange();
    // create or update slider
    if (timelineEl && window.noUiSlider) {
      updatingSlider = true; // set flag before updating
      if (!noui) {
        noui = noUiSlider.create(timelineEl, {
          start: range.startSec,
          connect: [true, false],
          range: { min: range.startSec, max: range.endSec },
          step: 1,
          behaviour: 'tap-drag',
          tooltips: false
        });
        noui.on('update', nouiUpdateHandler);
      } else {
        try {
          noui.updateOptions({ range: { min: range.startSec, max: range.endSec } });
        } catch (err) {
          // fallback: destroy and recreate
          try { noui.destroy(); } catch(e) {}
          noui = noUiSlider.create(timelineEl, {
            start: range.startSec,
            connect: [true, false],
            range: { min: range.startSec, max: range.endSec },
            step: 1,
            behaviour: 'tap-drag',
            tooltips: false
          });
          noui.on('update', nouiUpdateHandler);
        }
      }
      // clamp or initialize current
      if (!current || current < range.startSec || current > range.endSec) current = range.startSec;
      if (typeof noui.set === 'function') noui.set(current, false); // don't fire events
      updatingSlider = false; // clear flag after updating
    }
    if (totalTimeEl) totalTimeEl.textContent = formatTime(range.endSec);
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
  }

  function startPlayback() {
    if (playing) return;
    playing = true;
    if (playToggle) playToggle.setAttribute('aria-pressed','true');
    let last = performance.now();
    function loop(now) {
      const dt = (now - last)/1000; last = now;
      const rate = speedSelect ? Number(speedSelect.value) || 1 : 1;
      current += dt * rate;
      const range = getOperatingRange();
      
      // Update demand markers based on current time
      if (demandMarkersManager) {
        demandMarkersManager.update(current);
      }
      
      if (current >= range.endSec) {
        current = range.endSec;
        updatingSlider = true;
        if (noui && typeof noui.set === 'function') noui.set(current, false); // don't fire events
        updatingSlider = false;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
        stopPlayback();
        return;
      }
      updatingSlider = true;
      if (noui && typeof noui.set === 'function') noui.set(current, false); // don't fire events
      updatingSlider = false;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopPlayback() {
    playing = false;
    if (playToggle) playToggle.setAttribute('aria-pressed','false');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // initialize slider + UI
  applyOperatingRangeToSlider();

  if (playToggle) {
    playToggle.addEventListener('click', () => {
      if (!playing) startPlayback(); else stopPlayback();
      const ic = playToggle.querySelector('i');
      if (ic) ic.className = playing ? 'fas fa-pause' : 'fas fa-play';
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      const range = getOperatingRange();
      current = range.startSec;
      updatingSlider = true;
      if (noui && typeof noui.set === 'function') noui.set(current, false); // don't fire events
      updatingSlider = false;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
      stopPlayback();
      
      // Clear all demand markers on stop
      if (demandMarkersManager) {
        demandMarkersManager.clearAllMarkers();
      }
    });
  }

  // operating time inputs -> update slider
  const opStartEl = document.getElementById('operating-start');
  const opEndEl = document.getElementById('operating-end');
  if (opStartEl) opStartEl.addEventListener('change', applyOperatingRangeToSlider);
  if (opEndEl) opEndEl.addEventListener('change', applyOperatingRangeToSlider);

  // keyboard shortcuts: Space or 's' to toggle play/pause, ignore when typing
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space' || e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!playing) startPlayback(); else stopPlayback();
      const ic = playToggle && playToggle.querySelector('i');
      if (ic) ic.className = playing ? 'fas fa-pause' : 'fas fa-play';
    }
  });

  // respond to programmatic operating time updates
  document.addEventListener('operating-time-changed', (e) => {
    // Force reset current time to start of new operating range
    const range = getOperatingRange();
    current = range.startSec;
    applyOperatingRangeToSlider();
  });

  // wire Vehicle Settings buttons
  setTimeout(() => {
    console.log('Binding vehicle settings button...');
    const settingBoxes = document.querySelectorAll('.setting-box');
    const projectSelect = document.getElementById('project-select');
    
    console.log('Found setting boxes:', settingBoxes.length);
    console.log('vehicleSettingsManager:', vehicleSettingsManager);
    
    settingBoxes.forEach((box, idx) => {
      const label = box.querySelector('.setting-label-small');
      const labelText = label ? label.textContent : 'none';
      console.log(`Box ${idx}: label="${labelText}"`);
      
      if (label && label.textContent.trim() === 'Vehicle') {
        const btn = box.querySelector('.btn-setting');
        console.log('Found Vehicle setting button:', btn);
        
        if (btn) {
          btn.addEventListener('click', async () => {
            console.log('Vehicle Setting button clicked!');
            const projectName = projectSelect ? projectSelect.value : null;
            console.log('Selected project:', projectName);
            
            if (!projectName) {
              alert('Please select a project first');
              return;
            }
            try {
              console.log('Loading vehicles for project:', projectName);
              await vehicleSettingsManager.loadVehicles(projectName);
              console.log('Vehicles loaded, showing modal');
              vehicleSettingsManager.showModal();
            } catch (err) {
              console.error('Failed to load vehicles:', err);
              alert('Failed to load vehicles');
            }
          });
        }
      }
      
      if (label && label.textContent.trim() === 'Job type') {
        const btn = box.querySelector('.btn-setting');
        console.log('Found Job type setting button:', btn);
        
        if (btn) {
          btn.addEventListener('click', async () => {
            console.log('Job type Setting button clicked!');
            const projectName = projectSelect ? projectSelect.value : null;
            console.log('Selected project:', projectName);
            
            if (!projectName) {
              alert('Please select a project first');
              return;
            }
            try {
              console.log('Loading job types for project:', projectName);
              await jobTypeSettingsManager.loadJobTypes(projectName);
              console.log('Job types loaded, showing modal');
              jobTypeSettingsManager.showModal();
            } catch (err) {
              console.error('Failed to load job types:', err);
              alert('Failed to load job types');
            }
          });
        }
      }
    });
  }, 100);

});

init();

// Basic CSV parser that handles quoted fields and newlines inside quotes
function parseCSV(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i+1];
    if (ch === '"') {
      if (inQuotes && next === '"') { // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // end of row
      row.push(cur);
      cur = '';
      // skip empty CR or LF pair
      if (ch === '\r' && next === '\n') i++;
      // if the row is not just a single empty cell, push
      if (!(row.length === 1 && row[0] === '')) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += ch;
    }
  }
  // push last
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  // trim whitespace from each cell
  return rows.map(r => r.map(c => (c == null ? '' : c.toString().trim())));
}
