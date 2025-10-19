const fs = require('fs').promises;
const path = require('path');
const DispatchEngine = require('./dispatchEngine');
const { VehicleStateManager } = require('./vehicleStateManager');
const JobTypeManager = require('./jobTypeManager');

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
    
    // Skip header
    const dataLines = lines.slice(1);
    
    this.vehicles = dataLines.map((line, index) => {
      const [name, lat, lng, capacity, job_type] = line.split(',').map(s => s.trim());
      
      return {
        id: `vehicle_${String(index + 1).padStart(3, '0')}`,
        name: name,
        initialLocation: [parseFloat(lng), parseFloat(lat)],
        location: [parseFloat(lng), parseFloat(lat)],
        capacity: parseInt(capacity),
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
   * Load demands from CSV
   */
  async loadDemands() {
    const demandPath = path.join(this.projectPath, 'demand_data.csv');
    const content = await fs.readFile(demandPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header
    const dataLines = lines.slice(1);
    
    this.demands = dataLines.map((line, index) => {
      const [requestTime, lat, lng, address, job_type] = line.split(',').map(s => s.trim());
      
      const timestamp = this.parseTimeToSeconds(requestTime);
      
      return {
        id: `demand_${String(index + 1).padStart(3, '0')}`,
        timestamp: timestamp,
        requestTime: requestTime,
        location: [parseFloat(lng), parseFloat(lat)],
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
    
    // Record initial vehicle states
    this.vehicles.forEach(vehicle => {
      this.recordVehicleEvent(vehicle, 'simulation_start', {});
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
  }

  /**
   * Get route from TMAP (simplified - mock for now)
   */
  async getRoute(start, end) {
    // For now, return a simple mock route
    // TODO: Integrate with actual TMAP Route API
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
            coordinates: [start, end]
          },
          properties: {
            time: duration,
            distance: distance * 1000,
            name: 'Direct route'
          }
        }
      ]
    };
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
      
      // Assign vehicle
      const assignedVehicle = this.dispatchEngine.assignVehicle(
        demand,
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
        
        // Store route data
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
          segments: this.extractSegments(route, this.currentTime),
          geometry: route.geometry
        };
        
        this.routes.push(routeData);
        
        // Update vehicle state
        assignedVehicle.state = 'moving';
        assignedVehicle.assigned_demand_id = demand.id;
        assignedVehicle.current_route = route;
        assignedVehicle.route_start_time = this.currentTime;
        assignedVehicle.estimated_arrival = this.currentTime + route.duration;
        assignedVehicle.target_location = demand.location;
        
        // Update demand
        demand.status = 'assigned';
        demand.assignedVehicle = assignedVehicle.id;
        demand.timeline.dispatched = this.currentTime;
        demand.dispatchInfo = {
          dispatchTime: this.currentTime,
          waitTime: this.currentTime - demand.timestamp,
          isochrone: {
            waitTimeLimit: this.config.waitTimeLimit,
            polygon: isochroneResult.isochrone
          },
          candidateVehicles: [assignedVehicle.id], // Could track all candidates
          selectedReason: 'closest_distance',
          distanceToVehicle: assignedVehicle.distanceToDemand
        };
        
        // Record events
        this.recordEvent('vehicle_dispatched', {
          vehicleId: assignedVehicle.id,
          demandId: demand.id,
          routeId: routeId
        });
        
        this.recordVehicleEvent(assignedVehicle, 'demand_assigned', {
          demandId: demand.id,
          targetLocation: demand.location,
          routeId: routeId,
          estimatedArrival: this.currentTime + route.duration
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
   * Extract route segments with timing
   */
  extractSegments(route, startTime) {
    if (!route.features || route.features.length === 0) {
      return [];
    }
    
    const segments = [];
    let cumulativeTime = 0;
    
    route.features.forEach((feature, index) => {
      const duration = feature.properties.time || 0;
      const distance = feature.properties.distance || 0;
      const name = feature.properties.name || `Segment ${index + 1}`;
      
      segments.push({
        index: index,
        name: name,
        startTime: startTime + cumulativeTime,
        endTime: startTime + cumulativeTime + duration,
        duration: duration,
        distance: distance,
        coordinates: feature.geometry.coordinates
      });
      
      cumulativeTime += duration;
    });
    
    return segments;
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
            vehicle.state = 'working';
            vehicle.location = [...demand.location];
            vehicle.service_start_time = this.currentTime;
            
            const serviceTime = this.jobTypeManager.getServiceTimeInSeconds(demand.job_type);
            vehicle.service_end_time = this.currentTime + serviceTime;
            
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
            
            this.recordVehicleEvent(vehicle, 'arrived_at_demand', {
              location: vehicle.location,
              demandId: demand.id,
              serviceTime: serviceTime,
              estimatedCompletion: vehicle.service_end_time
            });
            
            // Update statistics
            if (vehicle.current_route) {
              vehicle.statistics.total_distance += vehicle.current_route.distance / 1000; // Convert to km
              vehicle.statistics.moving_time += vehicle.current_route.duration;
            }
            
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
            vehicle.state = 'idle';
            const serviceTime = vehicle.service_end_time - vehicle.service_start_time;
            
            vehicle.assigned_demand_id = null;
            vehicle.current_route = null;
            vehicle.route_start_time = null;
            vehicle.estimated_arrival = null;
            vehicle.target_location = null;
            vehicle.service_start_time = null;
            vehicle.service_end_time = null;
            
            // Update demand
            demand.status = 'completed';
            demand.timeline.workCompleted = this.currentTime;
            demand.metrics.totalTime = this.currentTime - demand.timestamp;
            
            // Record event
            this.recordEvent('work_completed', {
              vehicleId: vehicle.id,
              demandId: demand.id
            });
            
            this.recordVehicleEvent(vehicle, 'work_completed', {
              location: vehicle.location,
              demandId: demand.id
            });
            
            // Update statistics
            vehicle.statistics.total_jobs++;
            vehicle.statistics.total_service_time += serviceTime;
            vehicle.statistics.working_time += serviceTime;
            
            this.stats.completedDemands++;
            this.stats.totalServiceTime += serviceTime;
            this.stats.totalWaitTime += demand.metrics.waitTime;
            
            console.log(`   ✅ ${vehicle.name} completed ${demand.id} (service time: ${serviceTime}s)`);
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
        capacity: v.capacity,
        statistics: v.statistics,
        timeline: v.timeline
      })),
      
      routes: this.routes,
      
      demands: this.demands,
      
      events: this.events
    };
    
    // Save to file
    const outputPath = path.join(this.projectPath, 'simulation_result.json');
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
    
    console.log(`✅ Simulation result saved to: ${outputPath}`);
    console.log(`   File size: ${(JSON.stringify(result).length / 1024).toFixed(2)} KB`);
    
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
    
    console.log('📊 Simulation Statistics:');
    console.log('─────────────────────────────────────');
    console.log(`Total Demands: ${this.demands.length}`);
    console.log(`Completed: ${this.stats.completedDemands}`);
    console.log(`Rejected: ${this.stats.rejectedDemands}`);
    console.log(`Completion Rate: ${(this.stats.completedDemands / this.demands.length * 100).toFixed(1)}%`);
    console.log(`Average Wait Time: ${(this.stats.completedDemands > 0 ? this.stats.totalWaitTime / this.stats.completedDemands : 0).toFixed(1)}s`);
    console.log(`Average Service Time: ${(this.stats.completedDemands > 0 ? this.stats.totalServiceTime / this.stats.completedDemands : 0).toFixed(1)}s`);
    console.log(`Vehicle Utilization: ${(this.calculateUtilizationRate(vehicles) * 100).toFixed(1)}%`);
    console.log('─────────────────────────────────────');
  }
}

module.exports = SimulationEngine;
