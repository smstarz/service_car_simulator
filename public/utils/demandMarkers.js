/**
 * Demand Markers Manager - GeoJSON Layer Version
 * 시뮬레이션 시간에 따라 수요 지점을 Mapbox 네이티브 레이어로 표시하는 모듈
 */

export class DemandMarkersManager {
  constructor(map) {
    this.map = map;
    this.demandData = []; // 전체 수요 데이터 { id, lat, lng, time (seconds), address }
    this.sourceId = 'demand-points';
    this.layerId = 'demand-layer';
    this.layerOutlineId = 'demand-layer-outline';
    this.isInitialized = false;
    
    // 지도가 로드될 때까지 대기
    if (this.map.loaded()) {
      this.initializeLayers();
    } else {
      this.map.on('load', () => this.initializeLayers());
    }
  }

  /**
   * Mapbox 소스 및 레이어 초기화
   */
  initializeLayers() {
    if (this.isInitialized) return;

    // GeoJSON 소스 추가
    if (!this.map.getSource(this.sourceId)) {
      this.map.addSource(this.sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }

    // 외곽선 레이어 (흰색 테두리)
    if (!this.map.getLayer(this.layerOutlineId)) {
      this.map.addLayer({
        id: this.layerOutlineId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-radius': 5.3,
          'circle-color': '#ffffff',
          'circle-opacity': 1
        }
      });
    }

    // 메인 레이어 (빨간 원)
    if (!this.map.getLayer(this.layerId)) {
      this.map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-radius': 4,
          'circle-color': '#ff4444',
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ff0000',
          'circle-stroke-opacity': 0.3
        }
      });
    }

    // 클릭 이벤트 - 팝업 표시
    this.map.on('click', this.layerId, (e) => {
      if (!e.features || !e.features.length) return;
      
      const feature = e.features[0];
      const props = feature.properties;
      const coordinates = feature.geometry.coordinates.slice();

      // 팝업 생성
      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="font-size: 12px; padding: 4px;">
            <strong>수요 ID:</strong> ${props.id}<br/>
            <strong>주소:</strong> ${props.address || 'N/A'}<br/>
            <strong>위치:</strong> ${parseFloat(props.lat).toFixed(4)}, ${parseFloat(props.lng).toFixed(4)}<br/>
            <strong>발생 시간:</strong> ${props.timeFormatted}
          </div>
        `)
        .addTo(this.map);
    });

    // 호버 시 커서 변경
    this.map.on('mouseenter', this.layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.layerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    this.isInitialized = true;
    console.log('DemandMarkersManager: Layers initialized');
  }

  /**
   * CSV 행 데이터를 로드하고 파싱
   * @param {Array} rows - CSV rows (header + data rows)
   */
  loadDemandData(rows) {
    if (!rows || rows.length < 2) {
      this.demandData = [];
      return;
    }

    const header = rows[0];
    const idIdx = header.findIndex(h => h === 'id');
    const latIdx = header.findIndex(h => h === 'latitude');
    const lngIdx = header.findIndex(h => h === 'longitude');
    const timeIdx = header.findIndex(h => h === 'time');
    const addressIdx = header.findIndex(h => h === 'address');

    if (idIdx === -1 || latIdx === -1 || lngIdx === -1 || timeIdx === -1) {
      console.warn('DemandMarkersManager: Required columns not found in CSV');
      this.demandData = [];
      return;
    }

    this.demandData = rows.slice(1).map(row => {
      const id = row[idIdx];
      const lat = parseFloat(row[latIdx]);
      const lng = parseFloat(row[lngIdx]);
      const timeStr = row[timeIdx]; // HH:MM:SS format
      const timeSec = this.parseTimeToSeconds(timeStr);
      const address = addressIdx !== -1 ? row[addressIdx] : '';

      if (!id || isNaN(lat) || isNaN(lng) || isNaN(timeSec)) {
        return null;
      }

      return { 
        id, 
        lat, 
        lng, 
        time: timeSec, 
        timeFormatted: this.formatTime(timeSec),
        address 
      };
    }).filter(d => d !== null);

    console.log(`DemandMarkersManager: Loaded ${this.demandData.length} demand points`);
  }

  /**
   * HH:MM:SS 형식의 시간을 초 단위로 변환
   */
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return NaN;
    const parts = timeStr.split(':').map(p => Number(p || 0));
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return NaN;
  }

  /**
   * 현재 시뮬레이션 시간에 따라 마커 업데이트
   * @param {number} currentSeconds - 현재 시뮬레이션 시간 (초)
   */
  update(currentSeconds) {
    if (!this.map || !this.demandData.length || !this.isInitialized) return;

    // 현재 시간까지 발생해야 할 수요 찾기
    const visibleDemands = this.demandData.filter(d => d.time <= currentSeconds);
    
    // GeoJSON FeatureCollection 생성
    const geojson = {
      type: 'FeatureCollection',
      features: visibleDemands.map(demand => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [demand.lng, demand.lat]
        },
        properties: {
          id: demand.id,
          lat: demand.lat,
          lng: demand.lng,
          time: demand.time,
          timeFormatted: demand.timeFormatted,
          address: demand.address
        }
      }))
    };

    // 소스 업데이트
    const source = this.map.getSource(this.sourceId);
    if (source) {
      source.setData(geojson);
    }
  }

  /**
   * 초를 HH:MM:SS 형식으로 변환
   */
  formatTime(seconds) {
    const secOfDay = Math.floor(seconds) % 86400;
    const h = Math.floor(secOfDay / 3600).toString().padStart(2, '0');
    const m = Math.floor((secOfDay % 3600) / 60).toString().padStart(2, '0');
    const sec = Math.floor(secOfDay % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  /**
   * 모든 마커 제거 (시뮬레이션 리셋 시)
   */
  clearAllMarkers() {
    if (!this.isInitialized) return;
    
    const source = this.map.getSource(this.sourceId);
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }

  /**
   * 데이터 클리어
   */
  clear() {
    this.clearAllMarkers();
    this.demandData = [];
  }
}
