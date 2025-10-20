/**
 * Simulation Visualizer
 * 시뮬레이션 데이터의 차량, 경로, 수요를 Mapbox GL JS로 시각화하는 통합 모듈
 */

export class SimulationVisualizer {
  constructor(map) {
    this.map = map;
    this.simulationData = null;
    this.currentTime = 0;
    this.isInitialized = false;
    // whether to show address in marker labels (default false)
    this.showAddressLabel = false;
    
    // Cache for previous frame data (change detection)
    this._lastVehicleHash = null;
    this._lastRouteHash = null;
    this._lastDemandHash = null;
    
    // 레이어 ID 정의
    this.layers = {
      vehicles: {
        sourceId: 'vehicles-source',
        layerId: 'vehicles-layer',
        labelId: 'vehicles-label'
      },
      routes: {
        sourceId: 'routes-source',
        layerId: 'routes-layer',
        animationId: 'routes-animation'
      },
      demands: {
        sourceId: 'demands-source',
        layerId: 'demands-layer',
        labelId: 'demands-label'
      }
    };
    
    // 상태별 색상 정의
    this.colors = {
      vehicle: {
        idle: '#6c757d',      // 회색 - 대기
        moving: '#0d6efd',    // 파랑 - 이동 중
        working: '#198754',   // 초록 - 작업 중
        offline: '#dc3545'    // 빨강 - 오프라인
      },
      demand: {
        pending: '#ffc107',    // 노랑 - 대기
        dispatched: '#0dcaf0', // 청록 - 배차됨
        arrived: '#17a2b8',    // 청록(어두움) - 도착
        working: '#fd7e14',    // 주황 - 작업 중
        completed: '#198754',  // 초록 - 완료
        rejected: '#dc3545'    // 빨강 - 거절
      },
      route: {
        toPickup: '#0d6efd',   // 파랑 - 픽업 이동
        toWork: '#198754'      // 초록 - 작업지 이동
      }
    };
    
    // 지도 로드 대기
    if (this.map.loaded()) {
      this.initializeLayers();
    } else {
      this.map.on('load', () => this.initializeLayers());
    }
  }
  
  /**
   * Mapbox 레이어 초기화
   */
  initializeLayers() {
    if (this.isInitialized) return;
    
    try {
      // 1. 차량 레이어 초기화
      this.initVehicleLayers();
      
      // 2. 경로 레이어 초기화
      this.initRouteLayers();
      
      // 3. 수요 레이어 초기화
      this.initDemandLayers();
      
      // 4. 클릭 이벤트 등록
      this.registerEvents();
      
      this.isInitialized = true;
      console.log('✅ SimulationVisualizer initialized');
    } catch (error) {
      console.error('❌ Failed to initialize layers:', error);
    }
  }
  
  /**
   * 차량 레이어 초기화
   */
  initVehicleLayers() {
    const { sourceId, layerId, labelId } = this.layers.vehicles;
    
    // 소스 추가
    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    // 차량 아이콘 레이어
    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6.7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      });
    }
    
    // 차량 라벨 레이어
    if (!this.map.getLayer(labelId)) {
      this.map.addLayer({
        id: labelId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5
        }
      });
    }
  }
  
  /**
   * 경로 레이어 초기화
   */
  initRouteLayers() {
    const { sourceId, layerId, animationId } = this.layers.routes;
    
    // 소스 추가
    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    // 경로 라인 레이어
    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.8
        }
      });
    }
    
    // 경로 애니메이션 레이어 (점선 효과)
    if (!this.map.getLayer(animationId)) {
      this.map.addLayer({
        id: animationId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
          'line-dasharray': [0, 2, 1],
          'line-opacity': 0.6
        }
      });
    }
  }
  
  /**
   * 수요 레이어 초기화
   */
  initDemandLayers() {
    const { sourceId, layerId, labelId } = this.layers.demands;
    
    // 소스 추가
    if (!this.map.getSource(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }
    
    // 수요 마커 레이어
    if (!this.map.getLayer(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85
        }
      });
    }
    
    // 수요 라벨 레이어
    if (!this.map.getLayer(labelId)) {
      this.map.addLayer({
        id: labelId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      });
    }
  }
  
  /**
   * 이벤트 등록
   */
  registerEvents() {
    // 차량 클릭 이벤트
    this.map.on('click', this.layers.vehicles.layerId, (e) => {
      const properties = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates.slice();
      
      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(`
          <div style="background: linear-gradient(135deg, rgba(20, 25, 35, 0.98), rgba(30, 35, 50, 0.95)); backdrop-filter: blur(12px); border: 1px solid rgba(100, 150, 255, 0.3); border-radius: 8px; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <h6 style="margin: 0 0 10px 0; font-weight: 600; color: #4da3ff; font-size: 14px;">${properties.vehicleId}</h6>
            <div style="font-size: 12px; color: #b8b8b8; line-height: 1.6;">
              <div><strong style="color: #e0e7ff;">상태:</strong> <span style="color: #60a5fa;">${this.getStateLabel(properties.state)}</span></div>
              <div><strong style="color: #e0e7ff;">작업:</strong> <span style="color: #60a5fa;">${properties.totalJobs || 0}건</span></div>
              <div><strong style="color: #e0e7ff;">거리:</strong> <span style="color: #60a5fa;">${(properties.totalDistance || 0).toFixed(2)}km</span></div>
            </div>
          </div>
        `)
        .addTo(this.map);
    });
    
    // 수요 클릭 이벤트
    this.map.on('click', this.layers.demands.layerId, (e) => {
      const properties = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates.slice();
      
      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(`
          <div style="background: linear-gradient(135deg, rgba(20, 25, 35, 0.98), rgba(30, 35, 50, 0.95)); backdrop-filter: blur(12px); border: 1px solid rgba(100, 150, 255, 0.3); border-radius: 8px; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <h6 style="margin: 0 0 10px 0; font-weight: 600; color: #4da3ff; font-size: 14px;">${properties.address || properties.demandId}</h6>
            <div style="font-size: 12px; color: #b8b8b8; line-height: 1.6;">
              <div><strong style="color: #e0e7ff;">상태:</strong> <span style="color: #60a5fa;">${this.getDemandStatusLabel(properties.status)}</span></div>
              <div><strong style="color: #e0e7ff;">요청시간:</strong> <span style="color: #60a5fa;">${properties.requestTime}</span></div>
              ${properties.assignedVehicle ? `<div><strong style="color: #e0e7ff;">배차차량:</strong> <span style="color: #60a5fa;">${properties.assignedVehicle}</span></div>` : ''}
            </div>
          </div>
        `)
        .addTo(this.map);
    });
    
    // 커서 변경
    this.map.on('mouseenter', this.layers.vehicles.layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', this.layers.vehicles.layerId, () => {
      this.map.getCanvas().style.cursor = '';
    });
    this.map.on('mouseenter', this.layers.demands.layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', this.layers.demands.layerId, () => {
      this.map.getCanvas().style.cursor = '';
    });
  }
  
  /**
   * 시뮬레이션 데이터 로드
   */
  loadSimulationData(data) {
    console.log('📊 Loading simulation data:', data);
    this.simulationData = data;
    this.currentTime = data.metadata.startTimeSeconds;
    
    // 초기 상태 표시
    this.updateVisualization(this.currentTime);
    
    // 지도 중심 설정 (첫 번째 차량 위치로)
    if (data.vehicles && data.vehicles.length > 0) {
      const firstVehicle = data.vehicles[0];
      this.map.flyTo({
        center: firstVehicle.initialLocation,
        zoom: 12,
        duration: 1000
      });
    }
  }
  
  /**
   * 특정 demand로 지도 포커싱 (테이블에서 클릭 시)
   */
  focusDemand(demandId, coordinates) {
    console.log(`🎯 Focusing on demand: ${demandId} at [${coordinates[0]}, ${coordinates[1]}]`);
    
    // 지도를 해당 위치로 이동
    this.map.flyTo({
      center: coordinates,
      zoom: 15,
      duration: 800
    });
  }
  
  /**
   * 특정 시간의 시각화 업데이트
   */
  updateVisualization(currentTimeSeconds) {
    if (!this.simulationData) return;
    
    this.currentTime = currentTimeSeconds;
    
    // 1. 차량 업데이트 (에러 발생 시 다른 레이어는 계속 진행)
    try {
      this.updateVehicles(currentTimeSeconds);
    } catch (error) {
      console.error('❌ Failed to update vehicles:', error);
    }
    
    // 2. 경로 업데이트
    try {
      this.updateRoutes(currentTimeSeconds);
    } catch (error) {
      console.error('❌ Failed to update routes:', error);
    }
    
    // 3. 수요 업데이트
    try {
      this.updateDemands(currentTimeSeconds);
    } catch (error) {
      console.error('❌ Failed to update demands:', error);
    }
  }
  
  /**
   * 차량 위치 업데이트
   */
  updateVehicles(currentTimeSeconds) {
    const vehicleFeatures = this.simulationData.vehicles.map(vehicle => {
      const state = this.getVehicleStateAt(vehicle, currentTimeSeconds);
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: state.location
        },
        properties: {
          vehicleId: vehicle.id,
          label: vehicle.name || vehicle.id,
          state: state.state,
          color: this.colors.vehicle[state.state] || this.colors.vehicle.idle,
          totalJobs: vehicle.statistics?.total_jobs || 0,
          totalDistance: vehicle.statistics?.total_distance || 0
        }
      };
    });
    
    // Create hash for change detection (simple serialization of key data)
    const currentHash = this._createSimpleHash(vehicleFeatures.map(f => 
      `${f.properties.vehicleId}:${f.geometry.coordinates.join(',')}`
    ).join('|'));
    
    // Only update if data has changed
    if (currentHash !== this._lastVehicleHash) {
      const source = this.map.getSource(this.layers.vehicles.sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: vehicleFeatures
        });
      }
      this._lastVehicleHash = currentHash;
    }
  }
  
  /**
   * 경로 업데이트
   */
  updateRoutes(currentTimeSeconds) {
    const routeFeatures = [];
    
    // 각 차량의 활성 경로 찾기
    this.simulationData.vehicles.forEach(vehicle => {
      const activeRoute = this.getActiveRoute(vehicle, currentTimeSeconds);
      if (activeRoute) {
        routeFeatures.push(activeRoute);
      }
    });
    
    // Create hash for change detection
    const currentHash = this._createSimpleHash(routeFeatures.map(f => 
      `${f.properties.vehicleId}:${f.geometry.coordinates?.length || 0}`
    ).join('|'));
    
    // Only update if data has changed
    if (currentHash !== this._lastRouteHash) {
      const source = this.map.getSource(this.layers.routes.sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: routeFeatures
        });
      }
      this._lastRouteHash = currentHash;
    }
  }
  
  /**
   * 수요 마커 업데이트
   */
  updateDemands(currentTimeSeconds) {
    const demandFeatures = [];
    
    this.simulationData.demands.forEach(demand => {
      // 수요 발생 시간 이후에만 표시
      if (demand.timestamp <= currentTimeSeconds) {
        const status = this.getDemandStatusAt(demand, currentTimeSeconds);
        
        // Determine label based on showAddressLabel flag
        // If OFF: show empty label (no marker text, only circle)
        // If ON: show address
        let label = '';
        if (this.showAddressLabel && demand.address) {
          label = demand.address;
        }
        
        demandFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: demand.location
          },
          properties: {
            demandId: demand.id,
            label: label,
            status: status,
            color: this.colors.demand[status] || this.colors.demand.pending,
            requestTime: demand.requestTime,
            assignedVehicle: demand.assignedVehicle,
            address: demand.address
          }
        });
      }
    });
    
    // Create hash for change detection
    const currentHash = this._createSimpleHash(demandFeatures.map(f => 
      `${f.properties.demandId}:${f.properties.status}`
    ).join('|'));
    
    // Only update if data has changed
    if (currentHash !== this._lastDemandHash) {
      const source = this.map.getSource(this.layers.demands.sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: demandFeatures
        });
      }
      this._lastDemandHash = currentHash;
    }
  }
  
  /**
   * 특정 시간의 차량 상태 가져오기 (위치 보간)
   */
  getVehicleStateAt(vehicle, targetTime) {
    const timeline = vehicle.timeline;
    if (!timeline || timeline.length === 0) {
      return {
        location: vehicle.initialLocation,
        state: 'idle'
      };
    }
    
    // Find the current state at targetTime
    let currentEvent = timeline[0];
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestamp <= targetTime) {
        currentEvent = timeline[i];
      } else {
        break;
      }
    }
    
    // If vehicle is moving, find the movement start and end events
    if (currentEvent && currentEvent.state === 'moving') {
      // Find the start of this movement (demand_assigned event)
      let movementStart = currentEvent;
      for (let i = timeline.indexOf(currentEvent); i >= 0; i--) {
        if (timeline[i].type === 'demand_assigned' && timeline[i].state === 'moving') {
          movementStart = timeline[i];
          break;
        }
      }
      
      // Find the end of this movement (arrived_at_demand or work_completed event)
      let movementEnd = null;
      for (let i = timeline.indexOf(currentEvent); i < timeline.length; i++) {
        const evt = timeline[i];
        if (evt.type === 'arrived_at_demand' || evt.type === 'work_completed' || 
            (evt.state && evt.state !== 'moving')) {
          movementEnd = evt;
          break;
        }
      }
      
      // Use route-based interpolation for the entire movement
      if (movementStart && movementEnd) {
        const interpolatedLocation = this.interpolateAlongRoute(
          vehicle,
          movementStart,
          movementEnd,
          targetTime
        );
        
        if (interpolatedLocation) {
          return {
            location: interpolatedLocation,
            state: 'moving'
          };
        }
      }
    }
    
    // No special interpolation needed, use current event
    // Always ensure a valid location is returned (fallback chain)
    const fallbackLocation = currentEvent.location 
      || vehicle.initialLocation 
      || [126.9784, 37.5665]; // Seoul center as last resort
    
    return {
      location: fallbackLocation,
      state: currentEvent.state || 'idle'
    };
  }

  /**
   * TMAP 경로를 따라 위치 보간
   * Uses route geometry and features for accurate road-following interpolation
   */
  interpolateAlongRoute(vehicle, startEvent, endEvent, currentTime) {
    // Validate input parameters
    if (!vehicle || !startEvent || !endEvent) {
      console.warn('[Interpolation] Invalid parameters:', { vehicle: !!vehicle, startEvent: !!startEvent, endEvent: !!endEvent });
      return null;
    }
    
    // Find the route for this vehicle during this time period
    const route = this.findRouteForVehicle(vehicle.id, startEvent.timestamp, endEvent.timestamp);
    
    if (!route || !route.features || route.features.length === 0) {
      // No route data available, use simple linear interpolation as fallback
      if (startEvent.location && endEvent.location) {
        const totalDuration = endEvent.timestamp - startEvent.timestamp;
        if (totalDuration > 0) {
          const elapsed = currentTime - startEvent.timestamp;
          const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
          
          // Linear interpolation between start and end
          return [
            startEvent.location[0] + (endEvent.location[0] - startEvent.location[0]) * progress,
            startEvent.location[1] + (endEvent.location[1] - startEvent.location[1]) * progress
          ];
        }
      }
      // If no locations available, return null
      return null;
    }
    
    // Calculate progress through the route
    const totalDuration = endEvent.timestamp - startEvent.timestamp;
    const elapsed = currentTime - startEvent.timestamp;
    const progress = elapsed / totalDuration;
    
    // Build route segments with cumulative time
    const segments = this.buildRouteSegmentsFromFeatures(route.features, startEvent.timestamp);
    
    if (segments.length === 0) {
      // Fallback to linear interpolation
      if (startEvent.location && endEvent.location) {
        return [
          startEvent.location[0] + (endEvent.location[0] - startEvent.location[0]) * progress,
          startEvent.location[1] + (endEvent.location[1] - startEvent.location[1]) * progress
        ];
      }
      return null;
    }
    
    // Log first time only
    if (!this._loggedRoutes) this._loggedRoutes = {};
    if (!this._loggedRoutes[route.id]) {
      console.log(`[Interpolation] Route ${route.id}: ${segments.length} segments, ${totalDuration}s total`);
      this._loggedRoutes[route.id] = true;
    }
    
    // Find position at current time
    const position = this.findPositionOnRoute(segments, currentTime);
    
    return position;
  }

  /**
   * Find the route for a vehicle during a specific time period
   */
  findRouteForVehicle(vehicleId, startTime, endTime) {
    if (!this.simulationData.routes) {
      return null;
    }
    
    // Find route that overlaps with the time period
    for (const route of this.simulationData.routes) {
      if (route.vehicleId === vehicleId &&
          route.startTime <= endTime &&
          route.endTime >= startTime) {
        return route;
      }
    }
    
    return null;
  }

  /**
   * Build route segments from TMAP features
   */
  buildRouteSegmentsFromFeatures(features, startTime) {
    const segments = [];
    let cumulativeTime = 0;
    
    features.forEach((feature, index) => {
      if (!feature.geometry || !feature.geometry.coordinates) {
        return;
      }
      
      // Skip Point features - only process LineString segments
      if (feature.geometry.type !== 'LineString') {
        return;
      }
      
      const coords = feature.geometry.coordinates;
      const segmentTime = feature.properties.time || 0;
      const segmentDistance = feature.properties.distance || 0;
      
      if (coords.length === 0 || segmentTime === 0) {
        return;
      }
      
      segments.push({
        index: index,
        name: feature.properties.name || `Segment ${index + 1}`,
        startTime: startTime + cumulativeTime,
        endTime: startTime + cumulativeTime + segmentTime,
        duration: segmentTime,
        distance: segmentDistance,
        coordinates: coords
      });
      
      cumulativeTime += segmentTime;
    });
    
    return segments;
  }

  /**
   * Find position on route at specific time
   */
  findPositionOnRoute(segments, currentTime) {
    if (segments.length === 0) {
      return null;
    }
    
    // Find the segment containing current time
    for (const segment of segments) {
      if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
        // Handle zero-duration segments
        if (segment.duration === 0) {
          const coords = segment.coordinates;
          return coords[coords.length - 1];
        }
        
        // Calculate progress within this segment
        const segmentProgress = (currentTime - segment.startTime) / segment.duration;
        
        // Interpolate within segment coordinates
        return this.interpolateWithinSegment(segment.coordinates, segmentProgress);
      }
    }
    
    // If past all segments, return last coordinate
    const lastSegment = segments[segments.length - 1];
    const lastCoords = lastSegment.coordinates;
    return lastCoords[lastCoords.length - 1];
  }

  /**
   * Interpolate position within a segment's coordinates
   */
  interpolateWithinSegment(coordinates, progress) {
    if (coordinates.length === 0) {
      return null;
    }
    
    if (coordinates.length === 1) {
      return coordinates[0];
    }
    
    if (coordinates.length === 2) {
      // Simple linear interpolation between two points
      const [start, end] = coordinates;
      return [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ];
    }
    
    // Multiple points: use distance-based interpolation
    const distances = this.calculateSegmentDistances(coordinates);
    const totalDistance = distances[distances.length - 1];
    const targetDistance = totalDistance * progress;
    
    // Find the two points that bracket the target distance
    for (let i = 0; i < distances.length - 1; i++) {
      if (targetDistance >= distances[i] && targetDistance <= distances[i + 1]) {
        const segmentDistance = distances[i + 1] - distances[i];
        const segmentProgress = (targetDistance - distances[i]) / segmentDistance;
        
        return [
          coordinates[i][0] + (coordinates[i + 1][0] - coordinates[i][0]) * segmentProgress,
          coordinates[i][1] + (coordinates[i + 1][1] - coordinates[i][1]) * segmentProgress
        ];
      }
    }
    
    // Fallback: return last point
    return coordinates[coordinates.length - 1];
  }

  /**
   * Calculate cumulative distances along coordinates
   */
  calculateSegmentDistances(coordinates) {
    const distances = [0];
    let cumulative = 0;
    
    for (let i = 1; i < coordinates.length; i++) {
      const dx = coordinates[i][0] - coordinates[i - 1][0];
      const dy = coordinates[i][1] - coordinates[i - 1][1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      cumulative += distance;
      distances.push(cumulative);
    }
    
    return distances;
  }

  /**
   * 활성 경로 가져오기
   */
  getActiveRoute(vehicle, currentTime) {
    // Validate vehicle and timeline
    if (!vehicle || !vehicle.timeline) {
      return null;
    }
    
    // Find route from routes array
    if (this.simulationData.routes && Array.isArray(this.simulationData.routes)) {
      for (const route of this.simulationData.routes) {
        if (!route) continue; // Skip null/undefined routes
        
        if (route.vehicleId === vehicle.id && 
            route.startTime <= currentTime && 
            route.endTime > currentTime) {
          
          // Return full route geometry if available and valid
          if (route.geometry && route.geometry.type && route.geometry.coordinates) {
            return {
              type: 'Feature',
              geometry: route.geometry,
              properties: {
                vehicleId: vehicle.id,
                routeId: route.id || 'unknown',
                color: this.colors.route.toPickup
              }
            };
          }
        }
      }
    }
    
    // Fallback: check timeline for moving state
    const timeline = vehicle.timeline;
    
    if (!timeline || timeline.length < 2) {
      return null; // Not enough timeline data
    }
    
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i];
      const next = timeline[i + 1];
      
      // Validate timeline events
      if (!current || !next || 
          typeof current.timestamp !== 'number' || 
          typeof next.timestamp !== 'number') {
        continue;
      }
      
      if (current.timestamp <= currentTime && next.timestamp > currentTime) {
        if (current.state === 'moving' && 
            current.location && Array.isArray(current.location) && 
            next.location && Array.isArray(next.location)) {
          return {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [current.location, next.location]
            },
            properties: {
              vehicleId: vehicle.id,
              color: this.colors.route.toPickup
            }
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * 특정 시간의 수요 상태 가져오기
   */
  getDemandStatusAt(demand, currentTime) {
    const timeline = demand.timeline;
    
    if (timeline.workCompleted && currentTime >= timeline.workCompleted) {
      return 'completed';
    }
    if (timeline.workStarted && currentTime >= timeline.workStarted) {
      return 'working';
    }
    if (timeline.arrived && currentTime >= timeline.arrived) {
      return 'arrived';
    }
    if (timeline.dispatched && currentTime >= timeline.dispatched) {
      return 'dispatched';
    }
    if (demand.status === 'rejected') {
      return 'rejected';
    }
    
    return 'pending';
  }
  
  /**
   * 상태 라벨 변환
   */
  getStateLabel(state) {
    const labels = {
      idle: '대기',
      moving: '이동중',
      working: '작업중',
      offline: '오프라인'
    };
    return labels[state] || state;
  }
  
  /**
   * 수요 상태 라벨 변환
   */
  getDemandStatusLabel(status) {
    const labels = {
      pending: '대기중',
      dispatched: '배차됨',
      arrived: '도착',
      working: '작업중',
      completed: '완료',
      rejected: '거절됨'
    };
    return labels[status] || status;
  }
  
  /**
   * 모든 레이어 클리어
   */
  clear() {
    const sources = [
      this.layers.vehicles.sourceId,
      this.layers.routes.sourceId,
      this.layers.demands.sourceId
    ];
    
    sources.forEach(sourceId => {
      const source = this.map.getSource(sourceId);
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    });
  }
  
  /**
   * Simple hash function for change detection
   * Creates a fast hash from string data to detect changes
   */
  _createSimpleHash(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
  
  /**
   * 리소스 정리
   */
  destroy() {
    this.clear();
    
    // Reset cached hashes
    this._lastVehicleHash = null;
    this._lastRouteHash = null;
    this._lastDemandHash = null;
    
    // 레이어 제거
    const layerIds = [
      this.layers.vehicles.layerId,
      this.layers.vehicles.labelId,
      this.layers.routes.layerId,
      this.layers.routes.animationId,
      this.layers.demands.layerId,
      this.layers.demands.labelId
    ];
    
    layerIds.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    
    // 소스 제거
    const sourceIds = [
      this.layers.vehicles.sourceId,
      this.layers.routes.sourceId,
      this.layers.demands.sourceId
    ];
    
    sourceIds.forEach(sourceId => {
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });
    
    this.isInitialized = false;
  }

  /**
   * Setter to enable/disable showing address labels on demand markers
   * When called, re-renders the current visualization with the new label setting
   */
  setShowAddressLabel(flag) {
    this.showAddressLabel = !!flag;
    // Re-render current time's demands with new label setting
    if (this.simulationData) {
      this.updateDemands(this.currentTime);
    }
  }
}

