/**
 * Vehicle Settings Manager
 * 차량 설정 CSV 파일 관리 및 팝업 UI 제공
 */

export class VehicleSettingsManager {
  constructor() {
    this.currentProjectName = null;
    this.vehicleData = [];
    this.isModified = false;
  }

  /**
   * 프로젝트의 vehicle_set.csv 파일 로드
   */
  async loadVehicles(projectName) {
    this.currentProjectName = projectName;
    this.isModified = false;

    try {
      const res = await fetch(`/projects/${encodeURIComponent(projectName)}/vehicles`);
      
      if (!res.ok) {
        // 파일이 없으면 기본 데이터로 초기화
        this.vehicleData = this.getDefaultVehicles();
        return;
      }

      const text = await res.text();
      this.vehicleData = this.parseCSV(text);
      
      if (this.vehicleData.length === 0) {
        this.vehicleData = this.getDefaultVehicles();
      }
    } catch (error) {
      console.error('Failed to load vehicles:', error);
      this.vehicleData = this.getDefaultVehicles();
    }
  }

  /**
   * CSV 파싱
   */
  parseCSV(text) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return [];
    }

    const header = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      
      header.forEach((key, idx) => {
        row[key] = values[idx] || '';
      });

      if (row.name) {
        data.push(row);
      }
    }

    return data;
  }

  /**
   * 기본 차량 데이터
   */
  getDefaultVehicles() {
    return [
      { name: 'Vehicle_1', start_latitude: '37.5665', start_longitude: '126.9780', job_type: 'call' }
    ];
  }

  /**
   * CSV로 변환
   */
  toCSV() {
    if (this.vehicleData.length === 0) {
      return 'name,start_latitude,start_longitude,job_type\n';
    }

    const header = 'name,start_latitude,start_longitude,job_type';
    const rows = this.vehicleData.map(v => {
      return `${v.name || ''},${v.start_latitude || ''},${v.start_longitude || ''},${v.job_type || ''}`;
    });

    return header + '\n' + rows.join('\n');
  }

  /**
   * 차량 데이터 저장
   */
  async saveVehicles() {
    if (!this.currentProjectName) {
      throw new Error('No project selected');
    }

    const csvContent = this.toCSV();

    const response = await fetch(`/projects/${encodeURIComponent(this.currentProjectName)}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: csvContent
    });

    if (!response.ok) {
      throw new Error('Failed to save vehicles');
    }

    this.isModified = false;
    console.log('Vehicles saved successfully');
  }

  /**
   * 팝업 HTML 생성
   */
  createPopupHTML() {
    const vehicleCount = this.vehicleData.length;

    const tableRows = this.vehicleData.map((vehicle, idx) => `
      <tr data-index="${idx}">
        <td>${idx + 1}</td>
        <td>
          <input type="text" class="vehicle-input" data-field="name" value="${this.escapeHTML(vehicle.name)}" />
        </td>
        <td>
          <input type="number" class="vehicle-input" data-field="start_latitude" step="0.0001" value="${vehicle.start_latitude}" />
        </td>
        <td>
          <input type="number" class="vehicle-input" data-field="start_longitude" step="0.0001" value="${vehicle.start_longitude}" />
        </td>
        <td>
          <input type="text" class="vehicle-input" data-field="job_type" value="${this.escapeHTML(vehicle.job_type)}" />
        </td>
        <td>
          <button class="btn-delete-vehicle" data-index="${idx}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    return `
      <div id="vehicle-settings-modal" class="modal-overlay">
        <div class="modal-container vehicle-modal">
          <div class="modal-header">
            <h3>Vehicle Settings</h3>
            <button class="modal-close" id="close-vehicle-modal">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="vehicle-info">
              <span>Total Vehicles: <strong>${vehicleCount}</strong></span>
              <button id="add-vehicle-btn" class="btn btn-primary btn-small">
                <i class="fas fa-plus"></i> Add Vehicle
              </button>
            </div>

            <div class="table-wrapper">
              <table class="vehicle-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">No.</th>
                    <th style="width: 120px;">Name</th>
                    <th style="width: 110px;">Start Latitude</th>
                    <th style="width: 110px;">Start Longitude</th>
                    <th style="width: 80px;">Job Type</th>
                    <th style="width: 50px;">Delete</th>
                  </tr>
                </thead>
                <tbody id="vehicle-table-body">
                  ${tableRows}
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer">
            <button id="cancel-vehicle-btn" class="btn btn-secondary">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button id="save-vehicle-btn" class="btn btn-primary">
              <i class="fas fa-save"></i> Save
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * HTML 이스케이프
   */
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 팝업 표시 및 이벤트 바인딩
   */
  showModal() {
    // 기존 모달 제거
    const existing = document.getElementById('vehicle-settings-modal');
    if (existing) existing.remove();

    // 새 모달 추가
    const modalHTML = this.createPopupHTML();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('vehicle-settings-modal');

    // 이벤트 리스너
    document.getElementById('close-vehicle-modal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-vehicle-btn').addEventListener('click', () => {
      if (this.isModified && !confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
      this.closeModal();
    });

    document.getElementById('save-vehicle-btn').addEventListener('click', async () => {
      try {
        await this.saveVehicles();
        alert('Vehicles saved successfully!');
        this.closeModal();
      } catch (error) {
        alert('Failed to save: ' + error.message);
      }
    });

    document.getElementById('add-vehicle-btn').addEventListener('click', () => {
      this.addVehicle();
    });

    // 삭제 버튼
    document.querySelectorAll('.btn-delete-vehicle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        if (confirm('Delete this vehicle?')) {
          this.deleteVehicle(idx);
        }
      });
    });

    // 입력 필드 변경 감지
    document.querySelectorAll('.vehicle-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const idx = parseInt(row.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const value = e.target.value;

        this.vehicleData[idx][field] = value;
        this.isModified = true;
      });

      input.addEventListener('input', (e) => {
        this.isModified = true;
      });
    });

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (this.isModified && !confirm('You have unsaved changes. Do you want to discard them?')) {
          return;
        }
        this.closeModal();
      }
    });
  }

  /**
   * 모달 닫기
   */
  closeModal() {
    const modal = document.getElementById('vehicle-settings-modal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * 차량 추가
   */
  addVehicle() {
    const newVehicle = {
      name: `Vehicle_${this.vehicleData.length + 1}`,
      start_latitude: '37.5665',
      start_longitude: '126.9780',
      job_type: 'call'
    };

    this.vehicleData.push(newVehicle);
    this.isModified = true;

    // 테이블 다시 렌더링
    this.updateTableBody();
  }

  /**
   * 차량 삭제
   */
  deleteVehicle(idx) {
    this.vehicleData.splice(idx, 1);
    this.isModified = true;

    // 테이블 다시 렌더링
    this.updateTableBody();
  }

  /**
   * 테이블 바디 업데이트
   */
  updateTableBody() {
    const tbody = document.getElementById('vehicle-table-body');
    const vehicleCount = this.vehicleData.length;

    const tableRows = this.vehicleData.map((vehicle, idx) => `
      <tr data-index="${idx}">
        <td>${idx + 1}</td>
        <td>
          <input type="text" class="vehicle-input" data-field="name" value="${this.escapeHTML(vehicle.name)}" />
        </td>
        <td>
          <input type="number" class="vehicle-input" data-field="start_latitude" step="0.0001" value="${vehicle.start_latitude}" />
        </td>
        <td>
          <input type="number" class="vehicle-input" data-field="start_longitude" step="0.0001" value="${vehicle.start_longitude}" />
        </td>
        <td>
          <input type="text" class="vehicle-input" data-field="job_type" value="${this.escapeHTML(vehicle.job_type)}" />
        </td>
        <td>
          <button class="btn-delete-vehicle" data-index="${idx}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = tableRows;

    // 다시 이벤트 바인딩
    document.querySelectorAll('.btn-delete-vehicle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        if (confirm('Delete this vehicle?')) {
          this.deleteVehicle(idx);
        }
      });
    });

    document.querySelectorAll('.vehicle-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const idx = parseInt(row.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const value = e.target.value;

        this.vehicleData[idx][field] = value;
        this.isModified = true;
      });

      input.addEventListener('input', (e) => {
        this.isModified = true;
      });
    });

    // 차량 수 업데이트
    const info = document.querySelector('.vehicle-info');
    if (info) {
      info.innerHTML = `
        <span>Total Vehicles: <strong>${vehicleCount}</strong></span>
        <button id="add-vehicle-btn" class="btn btn-primary btn-small">
          <i class="fas fa-plus"></i> Add Vehicle
        </button>
      `;
      document.getElementById('add-vehicle-btn').addEventListener('click', () => {
        this.addVehicle();
      });
    }
  }
}
