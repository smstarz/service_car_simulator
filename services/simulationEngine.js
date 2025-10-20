const fs = require('fs').promises;
const path = require('path');
const DispatchEngine = require('./dispatchEngine');
const { VehicleStateManager } = require('./vehicleStateManager');
const JobTypeManager = require('./jobTypeManager');
const { TmapRouteService } = require('./tmapRouteService');

/**
 * SimulationEngine
 * 시뮬레이션을 실행하고 timestamp 기반 이벤트 JSON을 생성
 */
class SimulationEngine {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectName = path.basename(projectPath);
    
    // Managers
    this.dispatchEngine = null;
    this.vehicleStateManager = null;
    this.jobTypeManager = null;
    this.tmapRouteService = null;
    
    // Configuration
    this.config = null;
    
    // Data
    this.vehicles = [];
    this.demands = [];
    this.routes = [];
    this.events = [];
    
    // Simulation state
    this.currentTime = 0;
    this.startTimeSeconds = 0;
    this.endTimeSeconds = 0;
    
    // Statistics
    this.stats = {
      completedDemands: 0,
      rejectedDemands: 0,
      totalWaitTime: 0,
      totalServiceTime: 0
    };
    
    // ID counters
    this.routeIdCounter = 1;
  }

  /**
   * 시뮬레이션 초기화
   */
  async initialize() {
    console.log('🚀 Initializing simulation...');
    
    // 1. Load project configuration
    await this.loadProjectConfig();
    
    // 2. Load job types
    this.jobTypeManager = new JobTypeManager();
    await this.jobTypeManager.loadJobTypes(path.join(this.projectPath, 'job_type.csv'));
    
    // 3. Load vehicles
    await this.loadVehicles();
    
    // 4. Load demands
    await this.loadDemands();
    
    // 5. Initialize managers
    this.vehicleStateManager = new VehicleStateManager();
    
    // Add vehicles to state manager
    this.vehicles.forEach(vehicle => {
      this.vehicleStateManager.registerVehicle(vehicle);
    });
    
    this.dispatchEngine = new DispatchEngine();
    this.tmapRouteService = new TmapRouteService();
    
    // 6. Set simulation time
    this.startTimeSeconds = this.parseTimeToSeconds(this.config.operatingTime.start);
    this.endTimeSeconds = this.parseTimeToSeconds(this.config.operatingTime.end);
    this.currentTime = this.startTimeSeconds;
    
    console.log(`✅ Simulation initialized`);
    console.log(`   Project: ${this.projectName}`);
    console.log(`   Vehicles: ${this.vehicles.length}`);
    console.log(`   Demands: ${this.demands.length}`);
    console.log(`   Time: ${this.config.operatingTime.start} ~ ${this.config.operatingTime.end}`);
    console.log(`   Duration: ${this.endTimeSeconds - this.startTimeSeconds} seconds`);
  }

  /**
   * Load project configuration
   */
  async loadProjectConfig() {
    const configPath = path.join(this.projectPath, 'project.json');
    const content = await fs.readFile(configPath, 'utf-8');
    this.config = JSON.parse(content);
  }

  /**
   * Load vehicles from CSV
   */
  async loadVehicles() {
    const vehiclePath = path.join(this.projectPath, 'vehicle_set.csv');
    const content = await fs.readFile(vehiclePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header: name,start_latitude,start_longitude,job_type
    const dataLines = lines.slice(1);
    
    this.vehicles = dataLines.map((line, index) => {
      const [name, lat, lng, job_type] = line.split(',').map(s => s.trim());
      
      return {
        id: `vehicle_${String(index + 1).padStart(3, '0')}`,
        name: name,
        initialLocation: [parseFloat(lng), parseFloat(lat)],
        location: [parseFloat(lng), parseFloat(lat)],
        job_type: job_type,
        state: 'idle',
        
        // Tracking data
        currentDemand: null,
        route: null,
        routeStartTime: null,
        workStartTime: null,
        workEndTime: null,
        
        // Timeline for output
        timeline: [],
        
        // Statistics
        statistics: {
          total_jobs: 0,
          total_distance: 0,
          total_service_time: 0,
          idle_time: 0,
          moving_time: 0,
          working_time: 0
        }
      };
    });
  }

  /**
   * Update demand_data.csv with simulation results
   */
  async updateDemandDataCSV() {
    const demandPath = path.join(this.projectPath, 'demand_data.csv');
    
    try {
      // Read existing CSV
      const content = await fs.readFile(demandPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Parse header
      const header = lines[0].split(',').map(s => s.trim());
      
      // Check if result columns exist, if not add them
      const requiredColumns = ['result', 'vehicle', 'distance', 'arrived_time', 'complete_time'];
      let headersToAdd = [];
      
      for (const col of requiredColumns) {
        if (!header.includes(col)) {
          headersToAdd.push(col);
        }
      }
      
      // Update header if needed
      if (headersToAdd.length > 0) {
        header.push(...headersToAdd);
        lines[0] = header.join(',');
      }
      
      // Get column indices
      const idIdx = header.indexOf('id');
      const resultIdx = header.indexOf('result');
      const vehicleIdx = header.indexOf('vehicle');
      const distanceIdx = header.indexOf('distance');
      const arrivedTimeIdx = header.indexOf('arrived_time');
      const completeTimeIdx = header.indexOf('complete_time');
      
      // Create a map of demand results
      const demandMap = new Map();
      this.demands.forEach(demand => {
        demandMap.set(demand.id, {
          result: demand.status || '',
          vehicle: demand.assignedVehicle || '',
          distance: demand.dispatchInfo?.distanceToVehicle ? demand.dispatchInfo.distanceToVehicle.toFixed(3) : '',
          arrived_time: demand.timeline.arrived ? this.formatSecondsToTime(demand.timeline.arrived) : '',
          complete_time: demand.timeline.workCompleted ? this.formatSecondsToTime(demand.timeline.workCompleted) : ''
        });
      });
      
      // Update data lines
      for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',').map(s => s.trim());
        
        // Ensure fields array has enough elements
        while (fields.length < header.length) {
          fields.push('');
        }
        
        const demandId = fields[idIdx];
        const demandResult = demandMap.get(demandId);
        
        if (demandResult) {
          fields[resultIdx] = demandResult.result;
          fields[vehicleIdx] = demandResult.vehicle;
          fields[distanceIdx] = demandResult.distance;
          fields[arrivedTimeIdx] = demandResult.arrived_time;
          fields[completeTimeIdx] = demandResult.complete_time;
        }
        
        lines[i] = fields.join(',');
      }
      
      // Write back to file with BOM for Excel compatibility
      const BOM = '\uFEFF';
      const contentWithBOM = BOM + lines.join('\n') + '\n';
      await fs.writeFile(demandPath, contentWithBOM);
      console.log(`✅ Updated demand_data.csv with simulation results`);
      
    } catch (error) {
      console.error('❌ Failed to update demand_data.csv:', error);
      throw error;
    }
  }

  /**
   * Load demands from CSV
   */
  async loadDemands() {
    const demandPath = path.join(this.projectPath, 'demand_data.csv');
    const content = await fs.readFile(demandPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse header to get field indices
    const header = lines[0].split(',').map(s => s.trim());
    const idIdx = header.indexOf('id');
    const addressIdx = header.indexOf('address');
    const longitudeIdx = header.indexOf('longitude');
    const latitudeIdx = header.indexOf('latitude');
    const timeIdx = header.indexOf('time');
    const jobTypeIdx = header.indexOf('job_type');
    
    const dataLines = lines.slice(1);
    
    this.demands = dataLines.map((line, index) => {
      const fields = line.split(',').map(s => s.trim());
      
      const id = fields[idIdx];
      const address = fields[addressIdx];
      const longitude = fields[longitudeIdx];
      const latitude = fields[latitudeIdx];
      const time = fields[timeIdx];
      const job_type = fields[jobTypeIdx];
      
      const timestamp = this.parseTimeToSeconds(time);
      
      return {
        id: id,
        timestamp: timestamp,
        requestTime: time,
        location: [parseFloat(longitude), parseFloat(latitude)],
        address: address,
        job_type: job_type,
        status: 'pending',
        assignedVehicle: null,
        
        // Dispatch info (will be filled during simulation)
        dispatchInfo: null,
        
        // Timeline
        timeline: {
          requested: timestamp,
          dispatched: null,
          arrived: null,
          workStarted: null,
          workCompleted: null
        },
        
        // Metrics
        metrics: {
          waitTime: null,
          serviceTime: null,
          totalTime: null
        }
      };
    });
    
    // Sort by timestamp
    this.demands.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Parse time string (HH:MM or HH:MM:SS) to seconds
   */
  parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format seconds to HH:MM:SS
   */
  formatSecondsToTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Run simulation
   * @param {Function} progressCallback - Optional callback for progress updates (progress, currentTime, message)
   * @param {Function} checkCancelled - Optional function to check if simulation should be cancelled
   */
  async run(progressCallback = null, checkCancelled = null) {
    console.log('\n🎬 Starting simulation...\n');
    
    // Record simulation start
    this.recordEvent('simulation_start', {
      vehicles: this.vehicles.length,
      initialIdleVehicles: this.vehicles.length,
      demands: this.demands.length
    });
    
    // Record initial vehicle states through VehicleStateManager
    this.vehicles.forEach(vehicle => {
      this.vehicleStateManager.updateVehicleState(
        vehicle.id,
        'idle',
        this.currentTime,
        {
          type: 'simulation_start',
          force: true
        }
      );
    });
    
    let demandIndex = 0;
    let lastProgressUpdate = 0;
    let lastProgressCallback = 0;
    
    const totalDuration = this.endTimeSeconds - this.startTimeSeconds;
    
    // Main simulation loop
    while (this.currentTime <= this.endTimeSeconds) {
      // Check if cancelled
      if (checkCancelled && checkCancelled()) {
        console.log('\n⏹️  Simulation cancelled by user\n');
        return;
      }
      
      // Progress indicator (console)
      if (this.currentTime - lastProgressUpdate >= 600) { // Every 10 minutes
        const progress = ((this.currentTime - this.startTimeSeconds) / totalDuration * 100).toFixed(1);
        console.log(`⏱️  ${this.formatSecondsToTime(this.currentTime)} - Progress: ${progress}%`);
        lastProgressUpdate = this.currentTime;
      }
      
      // Progress callback (for SSE)
      if (progressCallback && this.currentTime - lastProgressCallback >= 60) { // Every 1 minute
        const progress = ((this.currentTime - this.startTimeSeconds) / totalDuration * 100).toFixed(1);
        progressCallback({
          progress: parseFloat(progress),
          currentTime: this.formatSecondsToTime(this.currentTime),
          message: `Processing: ${this.formatSecondsToTime(this.currentTime)} (${progress}%)`,
          completed: this.stats.completedDemands,
          rejected: this.stats.rejectedDemands,
          pending: this.demands.length - this.stats.completedDemands - this.stats.rejectedDemands
        });
        lastProgressCallback = this.currentTime;
      }
      
      // Process demands at current time
      while (demandIndex < this.demands.length && this.demands[demandIndex].timestamp === this.currentTime) {
        const demand = this.demands[demandIndex];
        await this.processDemand(demand);
        demandIndex++;
      }
      
      // Update vehicle states
      this.vehicleStateManager.updateSimulationTime(this.currentTime);
      
      // Update all vehicle positions (TMAP route-based interpolation)
      this.updateVehiclePositions();
      
      // Check for state changes and record events
      this.checkVehicleStateChanges();
      
      // Advance time by 1 second
      this.currentTime++;
    }
    
    // Record simulation end
    this.recordEvent('simulation_end', {
      completedDemands: this.stats.completedDemands,
      rejectedDemands: this.stats.rejectedDemands,
      totalVehicleJobs: this.stats.completedDemands
    });
    
    console.log('\n✅ Simulation completed!\n');
    this.printStatistics();
    
    // Final progress callback
    if (progressCallback) {
      progressCallback({
        progress: 100,
        currentTime: this.formatSecondsToTime(this.currentTime),
        message: 'Simulation completed',
        completed: this.stats.completedDemands,
        rejected: this.stats.rejectedDemands,
        pending: 0
      });
    }
    
    // Generate and save result
    return await this.generateResultJSON();
  }

  /**
   * Get route from TMAP API with detailed geometry
   */
  async getRoute(start, end) {
    try {
      // Use TMAP Route Service for accurate route
      const tmapResult = await this.tmapRouteService.getCarRoute({
        startPoint: start,
        endPoint: end,
        departureTime: this.formatSecondsToTime(this.currentTime)
      });
      
      // Convert TMAP result to expected format
      const route = {
        duration: tmapResult.summary.totalTime,  // seconds
        distance: tmapResult.summary.totalDistance,  // meters
        geometry: tmapResult.route,  // GeoJSON LineString
        features: tmapResult.rawData ? tmapResult.rawData.features : []
      };
      
      return route;
      
    } catch (error) {
      console.warn(`⚠️  TMAP API failed, using fallback: ${error.message}`);
      
      // Fallback to simple route
      const distance = this.calculateDistance(start[0], start[1], end[0], end[1]);
      const duration = Math.ceil(distance * 120); // Rough estimate: 30 km/h = 120s per km
      
      return {
        duration: duration,
        distance: distance * 1000, // Convert to meters
        geometry: {
          type: 'LineString',
          coordinates: [start, end]
        },
        features: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [start, end]
            },
            properties: {
              time: duration,
              distance: distance * 1000,
              name: 'Direct route (fallback)'
            }
          }
        ]
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lng1, lat1, lng2, lat2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * Process a demand (dispatch vehicle)
   */
  async processDemand(demand) {
    console.log(`📞 Demand ${demand.id} at ${demand.requestTime} (${demand.address})`);
    
    // Record demand occurrence
    this.recordEvent('demand_occurred', {
      demandId: demand.id,
      location: demand.location,
      job_type: demand.job_type
    });
    
    try {
      // Prepare demand with required format for Isochrone API
      const demandForAPI = {
        ...demand,
        origin_lng: demand.location[0],
        origin_lat: demand.location[1]
      };
      
      // Calculate Isochrone
      const isochroneResult = await this.dispatchEngine.calculateIsochrone(
        demandForAPI,
        this.config.waitTimeLimit
      );
      
      if (!isochroneResult.success) {
        throw new Error(`Isochrone calculation failed: ${isochroneResult.error}`);
      }
      
      // Get available vehicles from VehicleStateManager
      const allVehicles = this.vehicleStateManager.getAllVehicles();
      
      // Assign vehicle (use demandForAPI with origin_lng/lat)
      const assignedVehicle = this.dispatchEngine.assignVehicle(
        demandForAPI,
        allVehicles,
        isochroneResult.coordinates
      );
      
      if (assignedVehicle) {
        // Get TMAP route
        const route = await this.getRoute(assignedVehicle.location, demand.location);
        
        if (!route) {
          throw new Error('Failed to get route from TMAP');
        }
        
        // Generate route ID
        const routeId = `route_${String(this.routeIdCounter++).padStart(3, '0')}`;
        
        // Store route data (optimized - only keep essential data)
        const routeData = {
          id: routeId,
          vehicleId: assignedVehicle.id,
          demandId: demand.id,
          type: 'to_demand',
          startTime: this.currentTime,
          endTime: this.currentTime + route.duration,
          duration: route.duration,
          distance: route.distance,
          startLocation: [...assignedVehicle.location],
          endLocation: [...demand.location],
          geometry: route.geometry,
          // Store features with minimal data for interpolation
          // Segments are redundant since they're derived from features
          features: this.compactFeatures(route.features || [])
        };
        
        this.routes.push(routeData);
        
        // Update vehicle state through VehicleStateManager
        this.vehicleStateManager.dispatchVehicle(
          assignedVehicle.id,
          demand.id,
          route,
          demand.location,
          this.currentTime,
          {
            routeId: routeId,
            estimatedArrival: this.currentTime + route.duration
          }
        );
        
        // Update demand
        demand.status = 'assigned';
        demand.assignedVehicle = assignedVehicle.id;
        demand.timeline.dispatched = this.currentTime;
        demand.dispatchInfo = {
          dispatchTime: this.currentTime,
          waitTime: this.currentTime - demand.timestamp,
          // Remove isochrone polygon to reduce file size
          // Keep only essential metrics
          waitTimeLimit: this.config.waitTimeLimit,
          candidateVehicles: [assignedVehicle.id],
          selectedReason: 'closest_distance',
          distanceToVehicle: assignedVehicle.distanceToDemand
        };
        
        // Record global event
        this.recordEvent('vehicle_dispatched', {
          vehicleId: assignedVehicle.id,
          demandId: demand.id,
          routeId: routeId
        });
        
        console.log(`   ✅ Assigned to ${assignedVehicle.name} (distance: ${assignedVehicle.distanceToDemand.toFixed(2)}km, ETA: ${route.duration}s)`);
        
      } else {
        // No vehicle available
        demand.status = 'rejected';
        demand.timeline.dispatched = null;
        this.stats.rejectedDemands++;
        
        this.recordEvent('demand_rejected', {
          demandId: demand.id,
          reason: 'no_vehicle_available'
        });
        
        console.log(`   ❌ No vehicle available`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing demand: ${error.message}`);
      demand.status = 'error';
      this.stats.rejectedDemands++;
    }
  }

  /**
   * Compact TMAP features to reduce file size
   * Keep only essential data needed for interpolation
   */
  compactFeatures(features) {
    return features.map(feature => ({
      geometry: {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates
      },
      properties: {
        time: feature.properties.time || 0,
        distance: feature.properties.distance || 0
        // Remove: name, description, index, turnType, etc. (not needed for interpolation)
      }
    }));
  }

  /**
   * Update all vehicle positions based on TMAP route interpolation
   * Records position update events for accurate frontend animation
   */
  updateVehiclePositions() {
    const vehicles = this.vehicleStateManager.getAllVehicles();
    
    vehicles.forEach(vehicle => {
      // Only update position for moving vehicles
      if (vehicle.state === 'moving' && vehicle.current_route) {
        // Use VehicleStateManager's interpolation logic
        const newPosition = this.vehicleStateManager.interpolateVehiclePosition(
          vehicle,
          this.currentTime
        );
        
        // Update vehicle position
        vehicle.current_lng = newPosition[0];
        vehicle.current_lat = newPosition[1];
        vehicle.location = newPosition;
        
        // Record position every 10 seconds to reduce file size
        // Frontend can interpolate between these points
        const secondsSinceStart = this.currentTime - vehicle.route_start_time;
        if (secondsSinceStart % 10 === 0 || secondsSinceStart === 0) {
          this.recordVehicleEvent(vehicle, 'position_updated', {
            // Remove redundant data - location already in event
          });
        }
      }
    });
  }

  /**
   * Check if position changed significantly (> 10 meters)
   * To avoid recording too many position events
   */
  hasPositionChangedSignificantly(oldPos, newPos, threshold = 0.0001) {
    const lngDiff = Math.abs(newPos[0] - oldPos[0]);
    const latDiff = Math.abs(newPos[1] - oldPos[1]);
    return lngDiff > threshold || latDiff > threshold;
  }

  /**
   * Calculate route progress (0.0 to 1.0)
   */
  calculateRouteProgress(vehicle) {
    if (!vehicle.route_start_time || !vehicle.estimated_arrival) {
      return 0;
    }
    
    const elapsed = this.currentTime - vehicle.route_start_time;
    const total = vehicle.estimated_arrival - vehicle.route_start_time;
    
    if (total <= 0) return 1.0;
    
    return Math.min(Math.max(elapsed / total, 0), 1.0);
  }

  /**
   * Check vehicle state changes and record events
   */
  checkVehicleStateChanges() {
    const vehicles = this.vehicleStateManager.getAllVehicles();
    
    vehicles.forEach(vehicle => {
      // Check if vehicle arrived at demand
      if (vehicle.state === 'moving' && vehicle.route_start_time !== null) {
        const arrivalTime = vehicle.estimated_arrival;
        
        if (this.currentTime >= arrivalTime && this.currentTime < arrivalTime + 1) {
          // Just arrived
          const demand = this.demands.find(d => d.id === vehicle.assigned_demand_id);
          
          if (demand) {
            const serviceTime = this.jobTypeManager.getServiceTimeInSeconds(demand.job_type);
            
            // Update vehicle state through VehicleStateManager
            this.vehicleStateManager.arriveAtDemand(
              vehicle.id,
              this.currentTime,
              serviceTime
            );
            
            // Update demand
            demand.timeline.arrived = this.currentTime;
            demand.timeline.workStarted = this.currentTime;
            demand.metrics.waitTime = this.currentTime - demand.timestamp;
            demand.metrics.serviceTime = serviceTime;
            
            // Record events
            this.recordEvent('vehicle_arrived', {
              vehicleId: vehicle.id,
              demandId: demand.id
            });
            
            this.recordEvent('work_started', {
              vehicleId: vehicle.id,
              demandId: demand.id
            });
            
            console.log(`   🚗 ${vehicle.name} arrived at ${demand.id}`);
          }
        }
      }
      
      // Check if work completed
      if (vehicle.state === 'working' && vehicle.service_end_time !== null) {
        if (this.currentTime >= vehicle.service_end_time && this.currentTime < vehicle.service_end_time + 1) {
          // Work completed
          const demand = this.demands.find(d => d.id === vehicle.assigned_demand_id);
          
          if (demand) {
            const serviceTime = vehicle.service_end_time - vehicle.service_start_time;
            
            // Update vehicle state through VehicleStateManager
            this.vehicleStateManager.completeWork(
              vehicle.id,
              this.currentTime
            );
            
            // Update demand
            demand.status = 'completed';
            demand.timeline.workCompleted = this.currentTime;
            demand.metrics.totalTime = this.currentTime - demand.timestamp;
            
            // Record event
            this.recordEvent('work_completed', {
              vehicleId: vehicle.id,
              demandId: demand.id
            });
            
            // Update global statistics
            this.stats.completedDemands++;
            this.stats.totalServiceTime += serviceTime;
            this.stats.totalWaitTime += demand.metrics.waitTime;
            
            console.log(`✅ 작업 완료: ${vehicle.name} → IDLE (총 ${vehicle.statistics.total_jobs}건 처리)`);
            console.log(`   완료된 수요: ${demand.id}`);
          }
        }
      }
    });
  }

  /**
   * Record global event
   */
  recordEvent(type, data) {
    this.events.push({
      timestamp: this.currentTime,
      type: type,
      data: data
    });
  }

  /**
   * Record vehicle timeline event
   */
  recordVehicleEvent(vehicle, type, additionalData = {}) {
    const event = {
      timestamp: this.currentTime,
      type: type,
      state: vehicle.state,
      location: [...vehicle.location],
      ...additionalData
    };
    
    vehicle.timeline.push(event);
  }

  /**
   * Generate simulation result JSON
   */
  async generateResultJSON() {
    console.log('\n📝 Generating simulation result JSON...');
    
    // Get vehicles from VehicleStateManager
    const vehicles = this.vehicleStateManager.getAllVehicles();
    
    // Calculate final statistics
    const totalDuration = this.endTimeSeconds - this.startTimeSeconds;
    
    vehicles.forEach(vehicle => {
      vehicle.statistics.idle_time = totalDuration - vehicle.statistics.moving_time - vehicle.statistics.working_time;
    });
    
    const result = {
      metadata: {
        projectName: this.projectName,
        generatedAt: new Date().toISOString(),
        simulationVersion: '2.0',
        startTime: this.config.operatingTime.start,
        endTime: this.config.operatingTime.end,
        startTimeSeconds: this.startTimeSeconds,
        endTimeSeconds: this.endTimeSeconds,
        totalDurationSeconds: totalDuration,
        vehicleCount: vehicles.length,
        demandCount: this.demands.length,
        completedDemands: this.stats.completedDemands,
        rejectedDemands: this.stats.rejectedDemands,
        averageWaitTime: this.stats.completedDemands > 0 ? this.stats.totalWaitTime / this.stats.completedDemands : 0,
        averageServiceTime: this.stats.completedDemands > 0 ? this.stats.totalServiceTime / this.stats.completedDemands : 0,
        vehicleUtilizationRate: this.calculateUtilizationRate(vehicles)
      },
      
      configuration: {
        waitTimeLimit: this.config.waitTimeLimit,
        operatingTime: this.config.operatingTime,
        jobTypes: this.jobTypeManager.jobTypes
      },
      
      vehicles: vehicles.map(v => ({
        id: v.id,
        name: v.name,
        initialLocation: v.initialLocation,
        job_type: v.job_type,
        statistics: v.statistics,
        timeline: v.timeline
      })),
      
      routes: this.routes,
      
      demands: this.demands,
      
      events: this.events
    };
    
    // Save to file
    const outputPath = path.join(this.projectPath, 'simulation_result.json');
    // Use compact format by default to reduce file size (6-7x smaller)
    // Set DEBUG_MODE=true environment variable for pretty-printed JSON
    const indent = process.env.DEBUG_MODE === 'true' ? 2 : 0;
    await fs.writeFile(outputPath, JSON.stringify(result, null, indent));
    
    const fileSizeKB = (JSON.stringify(result, null, indent).length / 1024).toFixed(2);
    console.log(`✅ Simulation result saved to: ${outputPath}`);
    console.log(`   File size: ${fileSizeKB} KB${indent === 0 ? ' (compact)' : ' (formatted)'}`);
    
    // Update demand_data.csv with simulation results
    await this.updateDemandDataCSV();
    
    return result;
  }

  /**
   * Calculate vehicle utilization rate
   */
  calculateUtilizationRate(vehicles) {
    const totalDuration = this.endTimeSeconds - this.startTimeSeconds;
    let totalActiveTime = 0;
    
    vehicles.forEach(vehicle => {
      totalActiveTime += vehicle.statistics.moving_time + vehicle.statistics.working_time;
    });
    
    return totalActiveTime / (totalDuration * vehicles.length);
  }

  /**
   * Print statistics
   */
  printStatistics() {
    const vehicles = this.vehicleStateManager.getAllVehicles();
    
    // Count completed demands from demand status
    const actualCompleted = this.demands.filter(d => d.status === 'completed').length;
    const actualRejected = this.demands.filter(d => d.status === 'rejected').length;
    
    console.log('📊 Simulation Statistics:');
    console.log('─────────────────────────────────────');
    console.log(`Total Demands: ${this.demands.length}`);
    console.log(`Completed: ${actualCompleted} (stats: ${this.stats.completedDemands})`);
    console.log(`Rejected: ${actualRejected} (stats: ${this.stats.rejectedDemands})`);
    console.log(`Completion Rate: ${(actualCompleted / this.demands.length * 100).toFixed(1)}%`);
    console.log(`Average Wait Time: ${(actualCompleted > 0 ? this.stats.totalWaitTime / actualCompleted : 0).toFixed(1)}s`);
    console.log(`Average Service Time: ${(actualCompleted > 0 ? this.stats.totalServiceTime / actualCompleted : 0).toFixed(1)}s`);
    console.log(`Vehicle Utilization: ${(this.calculateUtilizationRate(vehicles) * 100).toFixed(1)}%`);
    console.log('─────────────────────────────────────');
  }
}

module.exports = SimulationEngine;
