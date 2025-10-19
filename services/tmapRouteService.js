/**
 * TMAP Route Service
 * TMAP API를 사용하여 경로 탐색 및 정보 추출
 */

const axios = require('axios');

class TmapRouteService {
  constructor() {
    this.apiKey = process.env.TMAP_API_KEY;
    this.baseUrl = 'https://apis.openapi.sk.com/tmap/routes';
    
    if (!this.apiKey) {
      console.warn('⚠️  TMAP_API_KEY not found in environment variables');
    }
  }

  /**
   * 경로 탐색 (출발지 → 목적지)
   * @param {Object} params
   * @param {number[]} params.startPoint - 출발지 좌표 [경도, 위도]
   * @param {number[]} params.endPoint - 도착지 좌표 [경도, 위도]
   * @param {string} params.departureTime - 출발시간 (HH:MM:SS 형식)
   * @param {boolean} params.trafficInfo - 교통정보 사용 여부 (기본: true)
   * @returns {Promise<Object>} 경로 정보
   */
  async getRoute(params) {
    const { startPoint, endPoint, departureTime, trafficInfo = true } = params;

    if (!this.apiKey) {
      throw new Error('TMAP_API_KEY is not configured');
    }

    if (!startPoint || !endPoint) {
      throw new Error('startPoint and endPoint are required');
    }

    if (startPoint.length !== 2 || endPoint.length !== 2) {
      throw new Error('startPoint and endPoint must be [longitude, latitude]');
    }

    try {
      // TMAP 경로 안내 API 요청
      const response = await axios.post(
        `${this.baseUrl}/pedestrian`,
        {
          startX: startPoint[0].toString(),
          startY: startPoint[1].toString(),
          endX: endPoint[0].toString(),
          endY: endPoint[1].toString(),
          reqCoordType: 'WGS84GEO',
          resCoordType: 'WGS84GEO',
          startName: '출발지',
          endName: '도착지',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'appKey': this.apiKey
          }
        }
      );

      // 응답 데이터 파싱
      return this.parseRouteResponse(response.data, startPoint, endPoint, departureTime);

    } catch (error) {
      console.error('❌ TMAP API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch route: ${error.message}`);
    }
  }

  /**
   * 자동차 경로 탐색 (교통정보 포함)
   * @param {Object} params
   * @param {number[]} params.startPoint - 출발지 좌표 [경도, 위도]
   * @param {number[]} params.endPoint - 도착지 좌표 [경도, 위도]
   * @param {string} params.departureTime - 출발시간 (HH:MM:SS 형식)
   * @returns {Promise<Object>} 경로 정보
   */
  async getCarRoute(params) {
    const { startPoint, endPoint, departureTime } = params;

    if (!this.apiKey) {
      throw new Error('TMAP_API_KEY is not configured');
    }

    if (!startPoint || !endPoint) {
      throw new Error('startPoint and endPoint are required');
    }

    try {
      // TMAP 자동차 경로 안내 API 요청
      const response = await axios.post(
        `${this.baseUrl}`,
        {
          startX: startPoint[0].toString(),
          startY: startPoint[1].toString(),
          endX: endPoint[0].toString(),
          endY: endPoint[1].toString(),
          reqCoordType: 'WGS84GEO',
          resCoordType: 'WGS84GEO',
          trafficInfo: 'Y',
          searchOption: '0', // 0: 추천경로
          startName: '출발지',
          endName: '도착지',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'appKey': this.apiKey
          }
        }
      );

      // 응답 데이터 파싱
      return this.parseRouteResponse(response.data, startPoint, endPoint, departureTime);

    } catch (error) {
      console.error('❌ TMAP API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch car route: ${error.message}`);
    }
  }

  /**
   * TMAP API 응답 파싱
   * @param {Object} data - TMAP API 응답 데이터
   * @param {number[]} startPoint - 출발지 좌표
   * @param {number[]} endPoint - 도착지 좌표
   * @param {string} departureTime - 출발시간
   * @returns {Object} 파싱된 경로 정보
   */
  parseRouteResponse(data, startPoint, endPoint, departureTime) {
    if (!data.features || data.features.length === 0) {
      throw new Error('No route found in response');
    }

    // 전체 경로 정보 추출
    const routeSummary = data.features[0].properties;
    const totalDistance = routeSummary.totalDistance || 0; // 미터
    const totalTime = routeSummary.totalTime || 0; // 초

    // 모든 경로 좌표 수집 (LineString)
    const coordinates = [];
    const segments = [];

    data.features.forEach((feature, index) => {
      const geom = feature.geometry;
      const props = feature.properties;

      if (geom.type === 'LineString') {
        // 좌표 추가
        geom.coordinates.forEach(coord => {
          coordinates.push(coord);
        });

        // 구간 정보 추가
        if (props.distance && props.time) {
          segments.push({
            index: index,
            name: props.name || props.facilityName || `구간 ${index}`,
            distance: props.distance, // 미터
            time: props.time, // 초
            description: props.description || '',
            turnType: props.turnType || 0,
            pointCount: geom.coordinates.length
          });
        }
      }
    });

    // 경로를 LineString 형식으로 반환
    const lineString = {
      type: 'LineString',
      coordinates: coordinates
    };

    return {
      // 요약 정보
      summary: {
        startPoint: startPoint,
        endPoint: endPoint,
        departureTime: departureTime,
        totalDistance: totalDistance, // 미터
        totalTime: totalTime, // 초
        totalDistanceKm: (totalDistance / 1000).toFixed(2), // 킬로미터
        totalTimeMinutes: (totalTime / 60).toFixed(1) // 분
      },
      // 전체 경로 (GeoJSON LineString)
      route: lineString,
      // 구간별 상세 정보
      segments: segments,
      // 전체 좌표 배열
      coordinates: coordinates,
      // 원본 데이터 (필요시)
      rawData: data
    };
  }

  /**
   * 다중 경로 탐색 (배치 처리)
   * @param {Array} routeRequests - 경로 요청 배열
   * @returns {Promise<Array>} 경로 정보 배열
   */
  async getMultipleRoutes(routeRequests) {
    const promises = routeRequests.map(request => 
      this.getCarRoute(request).catch(error => {
        console.error(`Failed to fetch route for ${request.vehicleId}:`, error.message);
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
  }

  /**
   * 경로를 timestamp 기반 이벤트로 변환
   * @param {Object} routeData - parseRouteResponse의 결과
   * @param {number} startTimestamp - 출발 시간 (초)
   * @returns {Array} timestamp 이벤트 배열
   */
  generateTimestampEvents(routeData, startTimestamp) {
    const events = [];
    let currentTime = startTimestamp;

    // 시작 이벤트
    events.push({
      timestamp: currentTime,
      type: 'route_start',
      location: routeData.summary.startPoint,
      remainingDistance: routeData.summary.totalDistance,
      remainingTime: routeData.summary.totalTime
    });

    // 구간별 이벤트
    routeData.segments.forEach((segment, index) => {
      currentTime += segment.time;
      
      events.push({
        timestamp: currentTime,
        type: 'route_segment',
        segmentIndex: index,
        segmentName: segment.name,
        location: this.getSegmentEndPoint(routeData.coordinates, segment),
        distanceTraveled: segment.distance,
        timeTaken: segment.time,
        remainingDistance: this.getRemainingDistance(routeData.segments, index),
        remainingTime: this.getRemainingTime(routeData.segments, index)
      });
    });

    // 도착 이벤트
    events.push({
      timestamp: currentTime,
      type: 'route_end',
      location: routeData.summary.endPoint,
      totalDistance: routeData.summary.totalDistance,
      totalTime: routeData.summary.totalTime
    });

    return events;
  }

  /**
   * 구간의 끝 지점 좌표 반환
   */
  getSegmentEndPoint(coordinates, segment) {
    // 간단히 구간의 마지막 좌표 반환
    const endIndex = Math.min(segment.index + segment.pointCount, coordinates.length - 1);
    return coordinates[endIndex];
  }

  /**
   * 남은 거리 계산
   */
  getRemainingDistance(segments, currentIndex) {
    return segments
      .slice(currentIndex + 1)
      .reduce((sum, seg) => sum + seg.distance, 0);
  }

  /**
   * 남은 시간 계산
   */
  getRemainingTime(segments, currentIndex) {
    return segments
      .slice(currentIndex + 1)
      .reduce((sum, seg) => sum + seg.time, 0);
  }
}

// 싱글톤 인스턴스 생성
const tmapRouteService = new TmapRouteService();

module.exports = tmapRouteService;
