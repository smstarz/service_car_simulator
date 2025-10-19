/**
 * Job Type Settings Manager
 * 업무 유형 설정 CSV 파일 관리 및 팝업 UI 제공
 */

export class JobTypeSettingsManager {
  constructor() {
    this.currentProjectName = null;
    this.jobTypeData = [];
    this.isModified = false;
  }

  /**
   * 프로젝트의 job_type.csv 파일 로드
   */
  async loadJobTypes(projectName) {
    this.currentProjectName = projectName;
    this.isModified = false;

    try {
      const res = await fetch(`/projects/${encodeURIComponent(projectName)}/job-types`);
      
      if (!res.ok) {
        // 파일이 없으면 기본 데이터로 초기화
        this.jobTypeData = this.getDefaultJobTypes();
        return;
      }

      const text = await res.text();
      this.jobTypeData = this.parseCSV(text);
      
      if (this.jobTypeData.length === 0) {
        this.jobTypeData = this.getDefaultJobTypes();
      }
    } catch (error) {
      console.error('Failed to load job types:', error);
      this.jobTypeData = this.getDefaultJobTypes();
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

      if (row.id) {
        data.push(row);
      }
    }

    return data;
  }

  /**
   * 기본 업무 유형 데이터
   */
  getDefaultJobTypes() {
    return [
      { id: '0001', job: 'call', service_time: '15' }
    ];
  }

  /**
   * CSV로 변환
   */
  toCSV() {
    if (this.jobTypeData.length === 0) {
      return 'id,job,service_time\n';
    }

    const header = 'id,job,service_time';
    const rows = this.jobTypeData.map(jt => {
      return `${jt.id || ''},${jt.job || ''},${jt.service_time || ''}`;
    });

    return header + '\n' + rows.join('\n');
  }

  /**
   * 업무 유형 데이터 저장
   */
  async saveJobTypes() {
    if (!this.currentProjectName) {
      throw new Error('No project selected');
    }

    const csvContent = this.toCSV();

    const response = await fetch(`/projects/${encodeURIComponent(this.currentProjectName)}/job-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: csvContent
    });

    if (!response.ok) {
      throw new Error('Failed to save job types');
    }

    this.isModified = false;
    console.log('Job types saved successfully');
  }

  /**
   * 팝업 HTML 생성
   */
  createPopupHTML() {
    const jobTypeCount = this.jobTypeData.length;

    const tableRows = this.jobTypeData.map((jobType, idx) => `
      <tr data-index="${idx}">
        <td>${idx + 1}</td>
        <td>
          <input type="text" class="jobtype-input" data-field="id" value="${this.escapeHTML(jobType.id)}" />
        </td>
        <td>
          <input type="text" class="jobtype-input" data-field="job" value="${this.escapeHTML(jobType.job)}" />
        </td>
        <td>
          <input type="number" class="jobtype-input" data-field="service_time" value="${jobType.service_time}" />
        </td>
        <td>
          <button class="btn-delete-jobtype" data-index="${idx}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    return `
      <div id="jobtype-settings-modal" class="modal-overlay">
        <div class="modal-container jobtype-modal">
          <div class="modal-header">
            <h3>Job Type Settings</h3>
            <button class="modal-close" id="close-jobtype-modal">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="jobtype-info">
              <span>Total Job Types: <strong>${jobTypeCount}</strong></span>
              <button id="add-jobtype-btn" class="btn btn-primary btn-small">
                <i class="fas fa-plus"></i> Add Job Type
              </button>
            </div>

            <div class="table-wrapper">
              <table class="jobtype-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">No.</th>
                    <th style="width: 100px;">ID</th>
                    <th style="width: 120px;">Job</th>
                    <th style="width: 100px;">Service Time (min)</th>
                    <th style="width: 50px;">Delete</th>
                  </tr>
                </thead>
                <tbody id="jobtype-table-body">
                  ${tableRows}
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer">
            <button id="cancel-jobtype-btn" class="btn btn-secondary">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button id="save-jobtype-btn" class="btn btn-primary">
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
    const existing = document.getElementById('jobtype-settings-modal');
    if (existing) existing.remove();

    // 새 모달 추가
    const modalHTML = this.createPopupHTML();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('jobtype-settings-modal');

    // 이벤트 리스너
    document.getElementById('close-jobtype-modal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-jobtype-btn').addEventListener('click', () => {
      if (this.isModified && !confirm('You have unsaved changes. Do you want to discard them?')) {
        return;
      }
      this.closeModal();
    });

    document.getElementById('save-jobtype-btn').addEventListener('click', async () => {
      try {
        await this.saveJobTypes();
        alert('Job Types saved successfully!');
        this.closeModal();
      } catch (error) {
        alert('Failed to save: ' + error.message);
      }
    });

    document.getElementById('add-jobtype-btn').addEventListener('click', () => {
      this.addJobType();
    });

    // 삭제 버튼
    document.querySelectorAll('.btn-delete-jobtype').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        if (confirm('Delete this job type?')) {
          this.deleteJobType(idx);
        }
      });
    });

    // 입력 필드 변경 감지
    document.querySelectorAll('.jobtype-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const idx = parseInt(row.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const value = e.target.value;

        this.jobTypeData[idx][field] = value;
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
    const modal = document.getElementById('jobtype-settings-modal');
    if (modal) {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * 업무 유형 추가
   */
  addJobType() {
    // 새로운 ID 생성 (0001, 0002, ...)
    const maxId = this.jobTypeData.length > 0 
      ? Math.max(...this.jobTypeData.map(jt => parseInt(jt.id) || 0))
      : 0;
    const newId = String(maxId + 1).padStart(4, '0');

    const newJobType = {
      id: newId,
      job: 'new_job',
      service_time: '15'
    };

    this.jobTypeData.push(newJobType);
    this.isModified = true;

    // 테이블 다시 렌더링
    this.updateTableBody();
  }

  /**
   * 업무 유형 삭제
   */
  deleteJobType(idx) {
    this.jobTypeData.splice(idx, 1);
    this.isModified = true;

    // 테이블 다시 렌더링
    this.updateTableBody();
  }

  /**
   * 테이블 바디 업데이트
   */
  updateTableBody() {
    const tbody = document.getElementById('jobtype-table-body');
    const jobTypeCount = this.jobTypeData.length;

    const tableRows = this.jobTypeData.map((jobType, idx) => `
      <tr data-index="${idx}">
        <td>${idx + 1}</td>
        <td>
          <input type="text" class="jobtype-input" data-field="id" value="${this.escapeHTML(jobType.id)}" />
        </td>
        <td>
          <input type="text" class="jobtype-input" data-field="job" value="${this.escapeHTML(jobType.job)}" />
        </td>
        <td>
          <input type="number" class="jobtype-input" data-field="service_time" value="${jobType.service_time}" />
        </td>
        <td>
          <button class="btn-delete-jobtype" data-index="${idx}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = tableRows;

    // 다시 이벤트 바인딩
    document.querySelectorAll('.btn-delete-jobtype').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        if (confirm('Delete this job type?')) {
          this.deleteJobType(idx);
        }
      });
    });

    document.querySelectorAll('.jobtype-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const idx = parseInt(row.getAttribute('data-index'));
        const field = e.target.getAttribute('data-field');
        const value = e.target.value;

        this.jobTypeData[idx][field] = value;
        this.isModified = true;
      });

      input.addEventListener('input', (e) => {
        this.isModified = true;
      });
    });

    // 업무 유형 수 업데이트
    const info = document.querySelector('.jobtype-info');
    if (info) {
      info.innerHTML = `
        <span>Total Job Types: <strong>${jobTypeCount}</strong></span>
        <button id="add-jobtype-btn" class="btn btn-primary btn-small">
          <i class="fas fa-plus"></i> Add Job Type
        </button>
      `;
      document.getElementById('add-jobtype-btn').addEventListener('click', () => {
        this.addJobType();
      });
    }
  }
}
