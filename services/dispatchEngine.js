/**
 * 배차 엔진 모듈
 * Mapbox Isochrone API를 사용하여 수요 발생 시 도달 가능 영역을 계산하고 차량 배차
 */

const axios = require('axios');
require('dotenv').config();

class DispatchEngine {
  constructor() {
    this.mapboxAccessToken = process.env.MAPBOX_TOKEN;
    
    if (!this.mapboxAccessToken) {
      console.warn('⚠️  MAPBOX_TOKEN이 .env 파일에 설정되지 않았습니다.');
    }
  }

  /**
   * 점이 폴리곤 내부에 있는지 판정 (Ray Casting Algorithm)
   * @param {Array} point - [lng, lat] 형식의 점 좌표
   * @param {Array} polygon - 폴리곤 좌표 배열 [[lng, lat], ...]
   * @returns {boolean} 폴리곤 내부에 있으면 true
   */
  isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  /**
   * 두 좌표 간의 직선 거리 계산 (Haversine formula)
   * @param {number} lng1 - 첫 번째 점의 경도
   * @param {number} lat1 - 첫 번째 점의 위도
   * @param {number} lng2 - 두 번째 점의 경도
   * @param {number} lat2 - 두 번째 점의 위도
   * @returns {number} 거리 (km)
   */
  calculateDistance(lng1, lat1, lng2, lat2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * 각도를 라디안으로 변환
   */
  toRad(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * 배차 가능한 차량 필터링 (상태 체크)
   * @param {Array} vehicles - 차량 목록
   * @returns {Array} 배차 가능한 차량 목록
   */
  filterAvailableVehicles(vehicles) {
    return vehicles.filter(vehicle => {
      // 상태가 IDLE이 아니면 제외
      if (vehicle.state && vehicle.state !== 'idle') {
        console.log(`   ✗ ${vehicle.name}: 상태 불가 (${vehicle.state})`);
        return false;
      }
      
      // 이미 배차된 수요가 있으면 제외
      if (vehicle.assigned_demand_id !== null && vehicle.assigned_demand_id !== undefined) {
        console.log(`   ✗ ${vehicle.name}: 이미 배차됨 (${vehicle.assigned_demand_id})`);
        return false;
      }
      
      console.log(`   ✓ ${vehicle.name}: 배차 가능`);
      return true;
    });
  }

  /**
   * Isochrone 폴리곤 내부에 있는 차량 필터링
   * @param {Array} vehicles - 차량 목록
   * @param {Array} polygonCoordinates - Isochrone 폴리곤 좌표
   * @returns {Array} 폴리곤 내부의 차량 목록
   */
  filterVehiclesInPolygon(vehicles, polygonCoordinates) {
    // 폴리곤은 여러 개의 링을 가질 수 있음 (첫 번째는 외부 링)
    const outerRing = polygonCoordinates[0];
    
    return vehicles.filter(vehicle => {
      // 차량 위치 가져오기 (여러 필드명 지원)
      let lng, lat;
      
      if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
        // current_lng/current_lat 사용
        lng = vehicle.current_lng;
        lat = vehicle.current_lat;
      } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
        // location 배열 사용 [lng, lat]
        lng = vehicle.location[0];
        lat = vehicle.location[1];
      } else if (vehicle.initial_lng !== undefined && vehicle.initial_lat !== undefined) {
        // initial_lng/initial_lat 사용
        lng = vehicle.initial_lng;
        lat = vehicle.initial_lat;
      } else {
        console.log(`   ✗ ${vehicle.name}: 위치 정보 없음`);
        return false;
      }
      
      const vehiclePoint = [lng, lat];
      const isInside = this.isPointInPolygon(vehiclePoint, outerRing);
      
      if (isInside) {
        console.log(`   ✓ ${vehicle.name}: 폴리곤 내부 [${lng.toFixed(6)}, ${lat.toFixed(6)}]`);
      }
      
      return isInside;
    });
  }

  /**
   * Job type이 일치하는 차량 필터링
   * @param {Array} vehicles - 차량 목록
   * @param {string} demandJobType - 수요의 job_type
   * @returns {Array} Job type이 일치하는 차량 목록
   */
  filterVehiclesByJobType(vehicles, demandJobType) {
    return vehicles.filter(vehicle => {
      const matches = vehicle.job_type === demandJobType;
      
      if (matches) {
        console.log(`   ✓ ${vehicle.name}: job_type 일치 (${demandJobType})`);
      }
      
      return matches;
    });
  }

  /**
   * 수요와 가장 가까운 차량 선택
   * @param {Array} vehicles - 차량 목록
   * @param {Object} demand - 수요 정보
   * @returns {Object|null} 가장 가까운 차량 또는 null
   */
  selectClosestVehicle(vehicles, demand) {
    if (vehicles.length === 0) {
      return null;
    }
    
    let closestVehicle = null;
    let minDistance = Infinity;
    
    vehicles.forEach(vehicle => {
      // 차량 위치 가져오기 (여러 필드명 지원)
      let lng, lat;
      
      if (vehicle.current_lng !== undefined && vehicle.current_lat !== undefined) {
        lng = vehicle.current_lng;
        lat = vehicle.current_lat;
      } else if (vehicle.location && Array.isArray(vehicle.location) && vehicle.location.length === 2) {
        lng = vehicle.location[0];
        lat = vehicle.location[1];
      } else if (vehicle.initial_lng !== undefined && vehicle.initial_lat !== undefined) {
        lng = vehicle.initial_lng;
        lat = vehicle.initial_lat;
      } else {
        console.log(`   ✗ ${vehicle.name}: 위치 정보 없음`);
        return;
      }
      
      const distance = this.calculateDistance(
        demand.origin_lng,
        demand.origin_lat,
        lng,
        lat
      );
      
      vehicle.distanceToDemand = distance;
      console.log(`   📏 ${vehicle.name}: ${distance.toFixed(3)} km`);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestVehicle = vehicle;
      }
    });
    
    return closestVehicle;
  }

  /**
   * 차량 배차 로직
   * @param {Object} demand - 수요 정보
   * @param {Array} vehicles - 이용 가능한 차량 목록
   * @param {Array} polygonCoordinates - Isochrone 폴리곤 좌표
   * @returns {Object|null} 배차된 차량 또는 null
   */
  assignVehicle(demand, vehicles, polygonCoordinates) {
    console.log(`\n🔍 배차 프로세스 시작...`);
    console.log(`   총 차량 수: ${vehicles.length}`);
    
    // 0단계: 배차 가능한 차량만 먼저 필터링 (상태 체크)
    console.log(`\n0️⃣  배차 가능 차량 필터링 (상태 체크):`);
    let candidateVehicles = this.filterAvailableVehicles(vehicles);
    console.log(`   → ${candidateVehicles.length}대 가능`);
    
    if (candidateVehicles.length === 0) {
      console.log(`   ❌ 배차 가능한 차량이 없습니다. (모두 운행 중)`);
      return null;
    }
    
    // 1단계: Isochrone 폴리곤 내부의 차량 필터링
    console.log(`\n1️⃣  폴리곤 내부 차량 탐색:`);
    candidateVehicles = this.filterVehiclesInPolygon(candidateVehicles, polygonCoordinates);
    console.log(`   → ${candidateVehicles.length}대 발견`);
    
    if (candidateVehicles.length === 0) {
      console.log(`   ❌ 폴리곤 내부에 배차 가능한 차량이 없습니다.`);
      return null;
    }
    
    // 2단계: Job type이 일치하는 차량 필터링
    console.log(`\n2️⃣  Job type 매칭 (요구: ${demand.job_type}):`);
    candidateVehicles = this.filterVehiclesByJobType(candidateVehicles, demand.job_type);
    console.log(`   → ${candidateVehicles.length}대 매칭`);
    
    if (candidateVehicles.length === 0) {
      console.log(`   ❌ Job type이 일치하는 차량이 없습니다.`);
      return null;
    }
    
    // 3단계: 가장 가까운 차량 선택
    console.log(`\n3️⃣  최단 거리 차량 선택:`);
    const selectedVehicle = this.selectClosestVehicle(candidateVehicles, demand);
    
    if (selectedVehicle) {
      console.log(`\n✅ 배차 완료: ${selectedVehicle.name}`);
      console.log(`   거리: ${selectedVehicle.distanceToDemand.toFixed(3)} km`);
    }
    
    return selectedVehicle;
  }

  /**
   * Demand 발생 시 해당 위치에서 Isochrone을 계산
   * @param {Object} demand - 수요 정보
   * @param {number} demand.origin_lng - 출발지 경도
   * @param {number} demand.origin_lat - 출발지 위도
   * @param {number} waitTimeLimit - 대기 시간 제한 (분)
   * @returns {Promise<Object>} Isochrone 폴리곤 GeoJSON
   */
  async calculateIsochrone(demand, waitTimeLimit) {
    try {
      const { origin_lng, origin_lat } = demand;
      
      // 입력 검증
      if (!origin_lng || !origin_lat) {
        throw new Error('수요의 좌표값(origin_lng, origin_lat)이 필요합니다.');
      }
      
      if (!waitTimeLimit || waitTimeLimit <= 0 || waitTimeLimit > 60) {
        throw new Error('waitTimeLimit은 1~60분 사이의 값이어야 합니다.');
      }

      // Mapbox Isochrone API 호출
      const profile = 'mapbox/driving-traffic';
      const coordinates = `${origin_lng},${origin_lat}`;
      const url = `https://api.mapbox.com/isochrone/v1/${profile}/${coordinates}`;
      
      const params = {
        contours_minutes: waitTimeLimit,
        polygons: true,
        access_token: this.mapboxAccessToken
      };

      console.log(`🚗 Isochrone 계산 중... (좌표: ${coordinates}, 시간: ${waitTimeLimit}분)`);
      
      const response = await axios.get(url, { params });
      
      if (response.data && response.data.features && response.data.features.length > 0) {
        const polygon = response.data.features[0];
        
        console.log(`✅ Isochrone 계산 완료 (contour: ${polygon.properties.contour}분)`);
        
        return {
          success: true,
          demand: demand,
          waitTimeLimit: waitTimeLimit,
          isochrone: polygon,
          coordinates: polygon.geometry.coordinates,
          geojson: response.data
        };
      } else {
        throw new Error('Isochrone 계산 결과가 비어있습니다.');
      }
      
    } catch (error) {
      console.error('❌ Isochrone 계산 실패:', error.message);
      
      if (error.response) {
        console.error('API 응답 에러:', error.response.data);
      }
      
      return {
        success: false,
        error: error.message,
        demand: demand
      };
    }
  }

  /**
   * Demand 발생 이벤트 처리 (차량 배차 포함)
   * @param {Object} demand - 수요 정보
   * @param {Array} vehicles - 이용 가능한 차량 목록
   * @param {Object} projectConfig - 프로젝트 설정 (waitTimeLimit 포함)
   * @returns {Promise<Object>} 처리 결과
   */
  async onDemandOccurrence(demand, vehicles, projectConfig) {
    console.log(`\n📍 새로운 수요 발생 (ID: ${demand.call_id || demand.id || 'unknown'})`);
    console.log(`   위치: [${demand.origin_lng}, ${demand.origin_lat}]`);
    console.log(`   발생 시간: ${demand.call_datetime || demand.time || 'unknown'}`);
    console.log(`   Job Type: ${demand.job_type}`);
    
    const waitTimeLimit = projectConfig.waitTimeLimit;
    
    if (!waitTimeLimit) {
      console.error('❌ 프로젝트 설정에서 waitTimeLimit을 찾을 수 없습니다.');
      return {
        success: false,
        error: 'waitTimeLimit이 프로젝트 설정에 없습니다.'
      };
    }
    
    // Isochrone 계산
    const isochroneResult = await this.calculateIsochrone(demand, waitTimeLimit);
    
    if (!isochroneResult.success) {
      return isochroneResult;
    }
    
    // 차량 배차
    const assignedVehicle = this.assignVehicle(
      demand, 
      vehicles, 
      isochroneResult.coordinates
    );
    
    return {
      success: true,
      demand: demand,
      waitTimeLimit: waitTimeLimit,
      isochrone: isochroneResult.isochrone,
      assignedVehicle: assignedVehicle,
      dispatch: {
        status: assignedVehicle ? 'assigned' : 'no_vehicle_available',
        vehicleName: assignedVehicle ? assignedVehicle.name : null,
        distance: assignedVehicle ? assignedVehicle.distanceToDemand : null
      }
    };
  }
}

module.exports = DispatchEngine;
