/**
 * reportGenerator.js
 * Generates HTML report with charts for simulation results
 */

export class ReportGenerator {
  constructor() {
    this.simulationData = null;
    this.charts = {};
    this.projectName = null;
  }

  /**
   * Load simulation data
   */
  async loadSimulationData(projectName) {
    try {
      this.projectName = projectName;
      const response = await fetch(`/projects/${projectName}/simulation-result`);
      if (!response.ok) {
        throw new Error('Failed to load simulation result');
      }
      this.simulationData = await response.json();
      return this.simulationData;
    } catch (error) {
      console.error('Error loading simulation data:', error);
      throw error;
    }
  }

  /**
   * Check if report HTML already exists
   */
  async reportExists() {
    try {
      const response = await fetch(`/projects/${this.projectName}/report`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load existing report HTML
   */
  async loadExistingReport() {
    try {
      const response = await fetch(`/projects/${this.projectName}/report`);
      if (!response.ok) {
        throw new Error('Failed to load report');
      }
      const html = await response.text();
      return html;
    } catch (error) {
      console.error('Error loading existing report:', error);
      throw error;
    }
  }

  /**
   * Save report HTML to server
   */
  async saveReportHTML(html) {
    try {
      const response = await fetch(`/projects/${this.projectName}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: html
      });
      
      if (!response.ok) {
        throw new Error('Failed to save report');
      }
      
      const result = await response.json();
      console.log('Report saved successfully:', result);
      return result;
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    if (!this.simulationData || !this.simulationData.vehicles) {
      return null;
    }

    const vehicles = this.simulationData.vehicles;
    const totalVehicles = vehicles.length;
    const totalJobs = vehicles.reduce((sum, v) => sum + (v.statistics.total_jobs || 0), 0);
    const totalDistance = vehicles.reduce((sum, v) => sum + (v.statistics.total_distance || 0), 0);
    const totalMovingTime = vehicles.reduce((sum, v) => sum + (v.statistics.moving_time || 0), 0);

    return {
      totalVehicles,
      totalJobs,
      totalDistance: totalDistance.toFixed(2),
      totalMovingTime: (totalMovingTime / 60).toFixed(1) // Convert to minutes
    };
  }

  /**
   * Get vehicle statistics for charts
   */
  getVehicleStats() {
    if (!this.simulationData || !this.simulationData.vehicles) {
      return null;
    }

    const vehicles = this.simulationData.vehicles;
    const totalDuration = this.simulationData.metadata.totalDurationSeconds;

    return vehicles.map(v => {
      const utilizationRate = totalDuration > 0 
        ? ((v.statistics.moving_time + v.statistics.working_time) / totalDuration * 100)
        : 0;
      
      const avgDistancePerJob = v.statistics.total_jobs > 0
        ? (v.statistics.total_distance / v.statistics.total_jobs)
        : 0;

      return {
        name: v.name,
        totalJobs: v.statistics.total_jobs || 0,
        totalDistance: v.statistics.total_distance || 0,
        idleTime: (v.statistics.idle_time || 0) / 60, // Convert to minutes
        utilizationRate: utilizationRate.toFixed(1),
        avgDistancePerJob: avgDistancePerJob.toFixed(2)
      };
    });
  }

  /**
   * Get demand statistics for charts
   */
  getDemandStats() {
    if (!this.simulationData || !this.simulationData.demands) {
      return null;
    }

    const demands = this.simulationData.demands;
    const routes = this.simulationData.routes || [];
    const totalDemands = demands.length;
    const completedDemands = demands.filter(d => d.status === 'completed').length;
    const rejectedDemands = demands.filter(d => d.status === 'rejected').length;
    const completionRate = totalDemands > 0 ? (completedDemands / totalDemands * 100).toFixed(1) : 0;

    // Build route map for faster lookup
    const routeMap = {};
    routes.forEach(route => {
      if (route.demandId) {
        routeMap[route.demandId] = route.distance || 0;
      }
    });

    // Calculate distance statistics
    const distanceStats = demands
      .filter(d => d.status === 'completed')
      .map(d => {
        // Try to get distance from metrics first, then from route
        let distance = 0;
        if (d.metrics && d.metrics.distance) {
          distance = parseFloat(d.metrics.distance);
        } else if (routeMap[d.id]) {
          distance = routeMap[d.id] / 1000; // Convert meters to km
        }
        return { id: d.id, distance };
      });

    // Calculate wait time statistics (arrived time - requested time)
    const waitTimeStats = demands
      .filter(d => d.status === 'completed' && d.timeline.arrived && d.timeline.requested)
      .map(d => {
        const waitTime = (d.timeline.arrived - d.timeline.requested) / 60; // Convert to minutes
        return { id: d.id, waitTime };
      });

    // Calculate hourly demand processing
    const startTime = this.simulationData.metadata.startTimeSeconds || 0;
    const endTime = this.simulationData.metadata.endTimeSeconds || startTime + 36000;
    const timeSlots = {};
    
    // Initialize 10-minute slots
    for (let time = startTime; time < endTime; time += 600) {
      const slotKey = Math.floor((time - startTime) / 600) * 10;
      timeSlots[slotKey] = 0;
    }
    
    // Count completed demands by time slot
    demands.filter(d => d.status === 'completed').forEach(d => {
      if (d.timeline.workCompleted) {
        const slotKey = Math.floor((d.timeline.workCompleted - startTime) / 600) * 10;
        if (timeSlots.hasOwnProperty(slotKey)) {
          timeSlots[slotKey]++;
        }
      }
    });

    // Calculate job type statistics
    const jobTypeStats = {};
    demands.forEach(d => {
      const jobType = d.job_type || 'Unknown';
      if (!jobTypeStats[jobType]) {
        jobTypeStats[jobType] = { total: 0, completed: 0 };
      }
      jobTypeStats[jobType].total++;
      if (d.status === 'completed') {
        jobTypeStats[jobType].completed++;
      }
    });

    return {
      summary: {
        totalDemands,
        completedDemands,
        rejectedDemands,
        completionRate
      },
      distanceStats,
      waitTimeStats,
      timeSlots,
      jobTypeStats
    };
  }

  /**
   * Create report popup window
   */
  createReportPopup() {
    if (!this.simulationData) {
      alert('No simulation data available. Please run a simulation first.');
      return;
    }

    const summary = this.calculateSummary();
    const vehicleStats = this.getVehicleStats();

    if (!summary || !vehicleStats) {
      alert('Failed to calculate statistics.');
      return;
    }

    const html = this.generateReportHTML(summary, vehicleStats);
    
    // Save report to server
    this.saveReportHTML(html).catch(error => {
      console.warn('Failed to save report to server:', error);
    });

    const reportWindow = window.open('', 'SimulationReport', 'width=1200,height=800,scrollbars=yes');
    
    reportWindow.document.write(html);
    reportWindow.document.close();

    // 이미 HTML에 DOMContentLoaded 핸들러가 있으므로 추가 처리 불필요
    // 파일을 다운로드하여 열어도 차트가 자동으로 초기화됨
  }

  /**
   * Generate HTML for report
   * Summary 데이터는 HTML에 직접 포함, 차트 데이터는 JavaScript로 생성
   */
  generateReportHTML(summary, vehicleStats) {
    // 차트 데이터를 JSON으로 인라인 스크립트에 포함
    const demandStats = this.getDemandStats();
    const chartDataScript = `
    window.vehicleChartData = ${JSON.stringify(vehicleStats)};
    window.demandStats = ${JSON.stringify(demandStats)};
    `;
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulation Report - ${this.simulationData.metadata.projectName}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
    }
    
    .header h1 {
      font-size: 20px;
      margin-bottom: 8px;
    }
    
    .header .meta {
      font-size: 12px;
      opacity: 0.9;
      line-height: 1.4;
    }
    
    .tabs {
      display: flex;
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
    }
    
    .tab {
      padding: 12px 20px;
      cursor: pointer;
      background: transparent;
      border: none;
      font-size: 13px;
      font-weight: 500;
      color: #6c757d;
      transition: all 0.3s;
    }
    
    .tab:hover {
      background: #e9ecef;
    }
    
    .tab.active {
      color: #667eea;
      border-bottom: 3px solid #667eea;
      background: white;
    }
    
    .tab-content {
      padding: 20px;
    }
    
    .tab-pane {
      display: none;
    }
    
    .tab-pane.active {
      display: block;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .card:nth-child(2) {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    
    .card:nth-child(3) {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    .card:nth-child(4) {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    
    .card-title {
      font-size: 11px;
      opacity: 0.9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .card-value {
      font-size: 22px;
      font-weight: bold;
    }
    
    .card-unit {
      font-size: 11px;
      opacity: 0.9;
      margin-left: 3px;
    }
    
    .chart-section {
      margin-bottom: 20px;
    }
    
    .chart-title {
      font-size: 12px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9ecef;
    }
    
    .chart-container {
      position: relative;
      height: 250px;
      background: white;
      padding: 8px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      width: 100%;
    }
    
    .chart-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
    }
    
    @media print {
      body {
        background: white;
      }
      
      .container {
        box-shadow: none;
      }
      
      .chart-container {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Simulation Report</h1>
      <div class="meta">
        <div>Project: ${this.simulationData.metadata.projectName}</div>
        <div>Generated: ${new Date(this.simulationData.metadata.generatedAt).toLocaleString('ko-KR')}</div>
        <div>Simulation Period: ${this.simulationData.metadata.startTime} ~ ${this.simulationData.metadata.endTime}</div>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" data-tab="vehicle">Vehicle Analysis</button>
      <button class="tab" data-tab="demand">Demand Analysis</button>
    </div>
    
    <div class="tab-content">
      <!-- Vehicle Tab -->
      <div id="vehicle-tab" class="tab-pane active">
        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Total Vehicles</div>
            <div class="card-value">${summary.totalVehicles}<span class="card-unit">units</span></div>
          </div>
          <div class="card">
            <div class="card-title">Total Jobs</div>
            <div class="card-value">${summary.totalJobs}<span class="card-unit">jobs</span></div>
          </div>
          <div class="card">
            <div class="card-title">Total Distance</div>
            <div class="card-value">${summary.totalDistance}<span class="card-unit">km</span></div>
          </div>
          <div class="card">
            <div class="card-title">Total Moving Time</div>
            <div class="card-value">${summary.totalMovingTime}<span class="card-unit">min</span></div>
          </div>
        </div>
        
        <div class="chart-section">
          <div class="chart-title">📈 Vehicle Performance Metrics</div>
          <div class="chart-grid">
            <div class="chart-container">
              <canvas id="chart-jobs"></canvas>
            </div>
            <div class="chart-container">
              <canvas id="chart-distance"></canvas>
            </div>
          </div>
          <div class="chart-grid">
            <div class="chart-container">
              <canvas id="chart-idle"></canvas>
            </div>
            <div class="chart-container">
              <canvas id="chart-utilization"></canvas>
            </div>
          </div>
          <div class="chart-grid">
            <div class="chart-container">
              <canvas id="chart-avg-distance"></canvas>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Demand Tab -->
      <div id="demand-tab" class="tab-pane">
        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Total Demands</div>
            <div class="card-value"><span id="total-demands">0</span><span class="card-unit">demands</span></div>
          </div>
          <div class="card">
            <div class="card-title">Completed</div>
            <div class="card-value"><span id="completed-demands">0</span><span class="card-unit">demands</span></div>
          </div>
          <div class="card">
            <div class="card-title">Rejected</div>
            <div class="card-value"><span id="rejected-demands">0</span><span class="card-unit">demands</span></div>
          </div>
          <div class="card">
            <div class="card-title">Completion Rate</div>
            <div class="card-value"><span id="completion-rate">0</span><span class="card-unit">%</span></div>
          </div>
        </div>
        
        <div class="chart-section">
          <div class="chart-title">📈 Demand Analysis</div>
          <div class="chart-grid">
            <div class="chart-container">
              <canvas id="chart-demand-distance"></canvas>
            </div>
            <div class="chart-container">
              <canvas id="chart-demand-wait-time"></canvas>
            </div>
          </div>
          <div class="chart-grid" style="grid-template-columns: 1fr;">
            <div class="chart-container">
              <canvas id="chart-demand-hourly"></canvas>
            </div>
          </div>
          <div class="chart-grid">
            <div class="chart-container">
              <canvas id="chart-job-type"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    ${chartDataScript}
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and panes
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding pane
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(tabName + '-tab').classList.add('active');
      });
    });
    
    // 페이지 로드 시 차트 초기화
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOMContentLoaded - vehicleChartData:', window.vehicleChartData);
      console.log('DOMContentLoaded - demandStats:', window.demandStats);
      
      if (window.vehicleChartData && window.Chart) {
        initializeAllCharts();
      }
      if (window.demandStats && window.Chart) {
        initializeDemandCharts();
      } else {
        console.warn('demandStats or Chart not available');
      }
    });
    
    // 차트 초기화 함수
    function initializeAllCharts() {
      if (!window.vehicleChartData || window.vehicleChartData.length === 0) {
        console.error('No vehicle data available');
        return;
      }
      
      const vehicleNames = window.vehicleChartData.map(v => v.name);
      const Chart = window.Chart;
      
      // Helper function to calculate average
      function getAverage(data) {
        return data.reduce((a, b) => a + b, 0) / data.length;
      }

      // Helper function to format average label
      function formatAvgLabel(avg) {
        return 'Avg: ' + avg.toFixed(2);
      }

      // Plugin to draw average line
      const averageLinePlugin = {
        id: 'averageLine',
        afterDatasetsDraw(chart) {
          const ctx = chart.ctx;
          const yScale = chart.scales.y;
          const xScale = chart.scales.x;
          
          if (!chart.avgData) return;
          
          const avgValue = chart.avgData.value;
          const avgLabel = chart.avgData.label;
          const avgColor = 'rgb(192, 0, 0)'; // Red color
          
          const yPixel = yScale.getPixelForValue(avgValue);
          
          // Draw dashed line
          ctx.strokeStyle = avgColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xScale.left, yPixel);
          ctx.lineTo(xScale.right, yPixel);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw average label with white border
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          const textX = xScale.right - 5;
          const textY = yPixel - 20; // Moved up more
          const padding = 3;
          
          // Draw white border
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.strokeText(avgLabel, textX - padding, textY + padding);
          
          // Draw text with red color
          ctx.fillStyle = avgColor;
          ctx.fillText(avgLabel, textX - padding, textY + padding);
        }
      };

      // Chart 1: Jobs per Vehicle
      const ctxJobs = document.getElementById('chart-jobs');
      if (ctxJobs) {
        const jobsData = window.vehicleChartData.map(v => v.totalJobs);
        const jobsAvg = getAverage(jobsData);
        
        const chartJobs = new Chart(ctxJobs, {
          type: 'bar',
          data: {
            labels: vehicleNames,
            datasets: [{
              label: 'Jobs Completed',
              data: jobsData,
              backgroundColor: 'rgba(102, 126, 234, 0.8)',
              borderColor: 'rgba(102, 126, 234, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Jobs Completed by Vehicle',
                font: { size: 11, weight: 'bold' }
              },
              legend: {
                display: false,
                labels: { font: { size: 9 } }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: { size: 9 }
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  font: { size: 9 }
                }
              }
            }
          },
          plugins: [averageLinePlugin]
        });
        
        chartJobs.avgData = {
          value: jobsAvg,
          color: 'rgb(192, 0, 0)',
          label: formatAvgLabel(jobsAvg)
        };
        chartJobs.update('none');
      }
      
      // Chart 2: Distance per Vehicle
      const ctxDistance = document.getElementById('chart-distance');
      if (ctxDistance) {
        const distanceData = window.vehicleChartData.map(v => v.totalDistance);
        const distanceAvg = getAverage(distanceData);
        
        const chartDistance = new Chart(ctxDistance, {
          type: 'bar',
          data: {
            labels: vehicleNames,
            datasets: [{
              label: 'Distance (km)',
              data: distanceData,
              backgroundColor: 'rgba(240, 147, 251, 0.8)',
              borderColor: 'rgba(240, 147, 251, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Total Distance Traveled by Vehicle',
                font: { size: 11, weight: 'bold' }
              },
              legend: {
                display: false,
                labels: { font: { size: 9 } }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: { size: 9 }
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  font: { size: 9 }
                }
              }
            }
          },
          plugins: [averageLinePlugin]
        });
        
        chartDistance.avgData = {
          value: distanceAvg,
          color: 'rgb(192, 0, 0)',
          label: formatAvgLabel(distanceAvg)
        };
        chartDistance.update('none');
      }
      
      // Chart 3: Idle Time per Vehicle
      const ctxIdle = document.getElementById('chart-idle');
      if (ctxIdle) {
        const idleData = window.vehicleChartData.map(v => v.idleTime);
        const idleAvg = getAverage(idleData);
        
        const chartIdle = new Chart(ctxIdle, {
          type: 'bar',
          data: {
            labels: vehicleNames,
            datasets: [{
              label: 'Idle Time (min)',
              data: idleData,
              backgroundColor: 'rgba(79, 172, 254, 0.8)',
              borderColor: 'rgba(79, 172, 254, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Idle Time by Vehicle',
                font: { size: 11, weight: 'bold' }
              },
              legend: {
                display: false,
                labels: { font: { size: 9 } }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: { size: 9 }
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  font: { size: 9 }
                }
              }
            }
          },
          plugins: [averageLinePlugin]
        });
        
        chartIdle.avgData = {
          value: idleAvg,
          color: 'rgb(192, 0, 0)',
          label: formatAvgLabel(idleAvg)
        };
        chartIdle.update('none');
      }
      
      // Chart 4: Utilization Rate per Vehicle
      const ctxUtilization = document.getElementById('chart-utilization');
      if (ctxUtilization) {
        const utilizationData = window.vehicleChartData.map(v => parseFloat(v.utilizationRate));
        const utilizationAvg = getAverage(utilizationData);
        
        const chartUtilization = new Chart(ctxUtilization, {
          type: 'bar',
          data: {
            labels: vehicleNames,
            datasets: [{
              label: 'Utilization Rate (%)',
              data: utilizationData,
              backgroundColor: 'rgba(67, 233, 123, 0.8)',
              borderColor: 'rgba(67, 233, 123, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Vehicle Utilization Rate',
                font: { size: 11, weight: 'bold' }
              },
              legend: {
                display: false,
                labels: { font: { size: 9 } }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: { size: 9 }
                }
              },
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  font: { size: 9 },
                  callback: function(value) {
                    return value + '%';
                  }
                }
              }
            }
          },
          plugins: [averageLinePlugin]
        });
        
        chartUtilization.avgData = {
          value: utilizationAvg,
          color: 'rgb(192, 0, 0)',
          label: formatAvgLabel(utilizationAvg)
        };
        chartUtilization.update('none');
      }
      
      // Chart 5: Average Distance per Job
      const ctxAvgDistance = document.getElementById('chart-avg-distance');
      if (ctxAvgDistance) {
        const avgDistanceData = window.vehicleChartData.map(v => parseFloat(v.avgDistancePerJob));
        const avgDistanceAvg = getAverage(avgDistanceData);
        
        const chartAvgDistance = new Chart(ctxAvgDistance, {
          type: 'bar',
          data: {
            labels: vehicleNames,
            datasets: [{
              label: 'Avg Distance per Job (km)',
              data: avgDistanceData,
              backgroundColor: 'rgba(255, 99, 132, 0.8)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Average Distance per Job by Vehicle',
                font: { size: 11, weight: 'bold' }
              },
              legend: {
                display: false,
                labels: { font: { size: 9 } }
              }
            },
            scales: {
              x: {
                ticks: {
                  font: { size: 9 }
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  font: { size: 9 }
                }
              }
            }
          },
          plugins: [averageLinePlugin]
        });
        
        chartAvgDistance.avgData = {
          value: avgDistanceAvg,
          color: 'rgb(192, 0, 0)',
          label: formatAvgLabel(avgDistanceAvg)
        };
        chartAvgDistance.update('none');
      }
    }
    
    // Initialize demand charts
    function initializeDemandCharts() {
      if (!window.demandStats) {
        console.error('No demand data available');
        return;
      }
      
      const stats = window.demandStats;
      const Chart = window.Chart;
      
      console.log('Initializing demand charts with stats:', stats);
      
      // Plugin to draw average line (same as vehicle charts)
      const averageLinePlugin = {
        id: 'averageLine',
        afterDatasetsDraw(chart) {
          const ctx = chart.ctx;
          const yScale = chart.scales.y;
          const xScale = chart.scales.x;
          
          if (!chart.avgData) return;
          
          const avgValue = chart.avgData.value;
          const avgLabel = chart.avgData.label;
          const avgColor = 'rgb(192, 0, 0)'; // Red color
          
          const yPixel = yScale.getPixelForValue(avgValue);
          
          // Draw dashed line
          ctx.strokeStyle = avgColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(xScale.left, yPixel);
          ctx.lineTo(xScale.right, yPixel);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw average label with white border
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          const textX = xScale.right - 5;
          const textY = yPixel - 20;
          const padding = 3;
          
          // Draw white border
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
          ctx.strokeText(avgLabel, textX - padding, textY + padding);
          
          // Draw text with red color
          ctx.fillStyle = avgColor;
          ctx.fillText(avgLabel, textX - padding, textY + padding);
        }
      };
      
      // Update summary cards
      try {
        document.getElementById('total-demands').textContent = stats.summary.totalDemands;
        document.getElementById('completed-demands').textContent = stats.summary.completedDemands;
        document.getElementById('rejected-demands').textContent = stats.summary.rejectedDemands;
        document.getElementById('completion-rate').textContent = stats.summary.completionRate;
        console.log('Summary cards updated successfully');
      } catch (error) {
        console.error('Error updating summary cards:', error);
      }
      
      // Chart 1: Demand Distance Distribution
      const ctxDemandDistance = document.getElementById('chart-demand-distance');
      if (ctxDemandDistance && stats.distanceStats && stats.distanceStats.length > 0) {
        try {
          const sortedStats = stats.distanceStats.sort((a, b) => a.distance - b.distance);
          const distances = sortedStats.map(d => d.distance);
          const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
          
          const chartDistanceInstance = new Chart(ctxDemandDistance, {
            type: 'bar',
            data: {
              labels: sortedStats.map(d => d.id),
              datasets: [{
                label: 'Distance (km)',
                data: distances,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'x',
              plugins: {
                title: {
                  display: true,
                  text: 'Distance per Demand',
                  font: { size: 11, weight: 'bold' }
                },
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    title: function(context) {
                      return 'Demand ID: ' + context[0].label;
                    },
                    label: function(context) {
                      return 'Distance: ' + context.parsed.y.toFixed(2) + ' km';
                    }
                  }
                }
              },
              scales: {
                x: {
                  ticks: {
                    font: { size: 8 },
                    maxRotation: 45
                  }
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    font: { size: 9 }
                  },
                  title: {
                    display: true,
                    text: 'Distance (km)',
                    font: { size: 9 }
                  }
                }
              }
            },
            plugins: [averageLinePlugin]
          });
          
          chartDistanceInstance.avgData = {
            value: avgDistance,
            color: 'rgb(192, 0, 0)',
            label: 'Avg: ' + avgDistance.toFixed(2)
          };
          chartDistanceInstance.update('none');
          console.log('Distance chart created');
        } catch (error) {
          console.error('Error creating distance chart:', error);
        }
      } else {
        console.warn('No distance stats available or container not found');
      }
      
      // Chart 2: Wait Time Distribution
      const ctxWaitTime = document.getElementById('chart-demand-wait-time');
      if (ctxWaitTime && stats.waitTimeStats && stats.waitTimeStats.length > 0) {
        try {
          const sortedStats = stats.waitTimeStats.sort((a, b) => a.waitTime - b.waitTime);
          const waitTimes = sortedStats.map(d => d.waitTime);
          const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
          
          const chartWaitTimeInstance = new Chart(ctxWaitTime, {
            type: 'bar',
            data: {
              labels: sortedStats.map(d => d.id),
              datasets: [{
                label: 'Wait Time (min)',
                data: waitTimes,
                backgroundColor: 'rgba(240, 147, 251, 0.8)',
                borderColor: 'rgba(240, 147, 251, 1)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'x',
              plugins: {
                title: {
                  display: true,
                  text: 'Wait Time per Demand',
                  font: { size: 11, weight: 'bold' }
                },
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    title: function(context) {
                      return 'Demand ID: ' + context[0].label;
                    },
                    label: function(context) {
                      return 'Wait Time: ' + context.parsed.y.toFixed(2) + ' min';
                    }
                  }
                }
              },
              scales: {
                x: {
                  ticks: {
                    font: { size: 8 },
                    maxRotation: 45
                  }
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    font: { size: 9 }
                  },
                  title: {
                    display: true,
                    text: 'Wait Time (min)',
                    font: { size: 9 }
                  }
                }
              }
            },
            plugins: [averageLinePlugin]
          });
          
          chartWaitTimeInstance.avgData = {
            value: avgWaitTime,
            color: 'rgb(192, 0, 0)',
            label: 'Avg: ' + avgWaitTime.toFixed(2)
          };
          chartWaitTimeInstance.update('none');
          console.log('Wait time chart created');
        } catch (error) {
          console.error('Error creating wait time chart:', error);
        }
      } else {
        console.warn('No wait time stats available or container not found');
      }
      
      // Chart 3: Hourly Demand Processing
      const ctxHourly = document.getElementById('chart-demand-hourly');
      if (ctxHourly && stats.timeSlots) {
        try {
          const times = Object.keys(stats.timeSlots).sort((a, b) => parseInt(a) - parseInt(b));
          const labels = times.map(t => t + ' min');
          const data = times.map(t => stats.timeSlots[t]);
          let cumulativeSum = 0;
          const cumulativeData = data.map(d => (cumulativeSum += d, cumulativeSum));
          
          new Chart(ctxHourly, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: 'Cumulative Demands Processed',
                data: cumulativeData,
                backgroundColor: 'rgba(79, 172, 254, 0.1)',
                borderColor: 'rgba(79, 172, 254, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: 'rgba(79, 172, 254, 1)'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: 'Cumulative Demand Processing (10-min intervals)',
                  font: { size: 11, weight: 'bold' }
                },
                legend: {
                  display: false
                }
              },
              scales: {
                x: {
                  ticks: {
                    font: { size: 8 },
                    maxRotation: 45
                  }
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    font: { size: 9 }
                  }
                }
              }
            }
          });
          console.log('Hourly chart created');
        } catch (error) {
          console.error('Error creating hourly chart:', error);
        }
      } else {
        console.warn('No time slot data available or container not found');
      }
      
      // Chart 4: Job Type Statistics
      const ctxJobType = document.getElementById('chart-job-type');
      if (ctxJobType && stats.jobTypeStats) {
        try {
          const jobTypes = Object.keys(stats.jobTypeStats);
          const totalByType = jobTypes.map(type => stats.jobTypeStats[type].total);
          const completedByType = jobTypes.map(type => stats.jobTypeStats[type].completed);
          
          new Chart(ctxJobType, {
            type: 'bar',
            data: {
              labels: jobTypes,
              datasets: [
                {
                  label: 'Total Demands',
                  data: totalByType,
                  backgroundColor: 'rgba(102, 126, 234, 0.8)',
                  borderColor: 'rgba(102, 126, 234, 1)',
                  borderWidth: 2
                },
                {
                  label: 'Completed',
                  data: completedByType,
                  backgroundColor: 'rgba(67, 233, 123, 0.8)',
                  borderColor: 'rgba(67, 233, 123, 1)',
                  borderWidth: 2
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: 'Demands by Job Type',
                  font: { size: 11, weight: 'bold' }
                },
                legend: {
                  display: true,
                  labels: { font: { size: 9 } }
                }
              },
              scales: {
                x: {
                  ticks: {
                    font: { size: 9 }
                  }
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    font: { size: 9 }
                  }
                }
              }
            }
          });
          console.log('Job type chart created');
        } catch (error) {
          console.error('Error creating job type chart:', error);
        }
      } else {
        console.warn('No job type data available or container not found');
      }
    }
  </script>
</body>
</html>
    `;
  }

  /**
   * Initialize all charts in the report window
   */
  initializeCharts(reportWindow, vehicleStats) {
    const Chart = reportWindow.Chart;
    const vehicleNames = vehicleStats.map(v => v.name);

    // Chart 1: Jobs per Vehicle
    const ctxJobs = reportWindow.document.getElementById('chart-jobs');
    if (ctxJobs) {
      new Chart(ctxJobs, {
        type: 'bar',
        data: {
          labels: vehicleNames,
          datasets: [{
            label: 'Jobs Completed',
            data: vehicleStats.map(v => v.totalJobs),
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Jobs Completed by Vehicle',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    }

    // Chart 2: Distance per Vehicle
    const ctxDistance = reportWindow.document.getElementById('chart-distance');
    if (ctxDistance) {
      new Chart(ctxDistance, {
        type: 'bar',
        data: {
          labels: vehicleNames,
          datasets: [{
            label: 'Distance (km)',
            data: vehicleStats.map(v => v.totalDistance),
            backgroundColor: 'rgba(240, 147, 251, 0.8)',
            borderColor: 'rgba(240, 147, 251, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Total Distance Traveled by Vehicle',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    // Chart 3: Idle Time per Vehicle
    const ctxIdle = reportWindow.document.getElementById('chart-idle');
    if (ctxIdle) {
      new Chart(ctxIdle, {
        type: 'bar',
        data: {
          labels: vehicleNames,
          datasets: [{
            label: 'Idle Time (min)',
            data: vehicleStats.map(v => v.idleTime),
            backgroundColor: 'rgba(79, 172, 254, 0.8)',
            borderColor: 'rgba(79, 172, 254, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Idle Time by Vehicle',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    // Chart 4: Utilization Rate per Vehicle
    const ctxUtilization = reportWindow.document.getElementById('chart-utilization');
    if (ctxUtilization) {
      new Chart(ctxUtilization, {
        type: 'bar',
        data: {
          labels: vehicleNames,
          datasets: [{
            label: 'Utilization Rate (%)',
            data: vehicleStats.map(v => parseFloat(v.utilizationRate)),
            backgroundColor: 'rgba(67, 233, 123, 0.8)',
            borderColor: 'rgba(67, 233, 123, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Vehicle Utilization Rate',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    }

    // Chart 5: Average Distance per Job
    const ctxAvgDistance = reportWindow.document.getElementById('chart-avg-distance');
    if (ctxAvgDistance) {
      new Chart(ctxAvgDistance, {
        type: 'bar',
        data: {
          labels: vehicleNames,
          datasets: [{
            label: 'Avg Distance per Job (km)',
            data: vehicleStats.map(v => parseFloat(v.avgDistancePerJob)),
            backgroundColor: 'rgba(255, 99, 132, 0.8)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Average Distance per Job by Vehicle',
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }
}
