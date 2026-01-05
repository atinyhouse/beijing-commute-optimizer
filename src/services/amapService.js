/**
 * 高德地图 API 服务封装
 * 文档: https://lbs.amap.com/api/webservice/summary
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const AMAP_KEY = process.env.AMAP_KEY;
const BASE_URL = 'https://restapi.amap.com/v3';

class AmapService {
  constructor() {
    this.apiKey = AMAP_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  警告: AMAP_KEY 未设置,将使用模拟数据');
    }
  }

  /**
   * 地铁路线规划
   * @param {Object} origin - 起点 {lng, lat, name}
   * @param {Object} destination - 终点 {lng, lat, name}
   * @returns {Promise<Array>} 地铁方案列表
   */
  async getSubwayRoutes(origin, destination) {
    if (!this.apiKey) {
      return this._mockSubwayRoutes(origin, destination);
    }

    try {
      const response = await axios.get(`${BASE_URL}/direction/transit/integrated`, {
        params: {
          key: this.apiKey,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`,
          city: '北京',
          cityd: '北京',
          output: 'json',
          strategy: 0 // 0-最快捷, 1-最经济, 2-最少换乘, 3-最少步行
        }
      });

      if (response.data.status === '1' && response.data.route) {
        return this._parseSubwayRoutes(response.data.route.transits);
      }

      return [];
    } catch (error) {
      console.error('地铁路线查询失败:', error.message);
      return this._mockSubwayRoutes(origin, destination);
    }
  }

  /**
   * 驾车路线规划(用于打车估算)
   * @param {Object} origin - 起点
   * @param {Object} destination - 终点
   * @returns {Promise<Object>} 驾车方案
   */
  async getDrivingRoute(origin, destination) {
    if (!this.apiKey) {
      return this._mockDrivingRoute(origin, destination);
    }

    try {
      const response = await axios.get(`${BASE_URL}/direction/driving`, {
        params: {
          key: this.apiKey,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`,
          extensions: 'all',
          strategy: 10 // 10-考虑实时路况
        }
      });

      if (response.data.status === '1' && response.data.route) {
        return this._parseDrivingRoute(response.data.route.paths[0]);
      }

      return null;
    } catch (error) {
      console.error('驾车路线查询失败:', error.message);
      return this._mockDrivingRoute(origin, destination);
    }
  }

  /**
   * 解析地铁路线数据
   */
  _parseSubwayRoutes(transits) {
    return transits.slice(0, 3).map((transit, index) => ({
      id: `subway_${index}`,
      type: 'subway',
      duration: Math.ceil(transit.duration / 60), // 秒转分钟
      distance: transit.distance,
      cost: transit.cost || 9, // 默认票价
      walkDistance: transit.walking_distance,
      segments: this._parseTransitSegments(transit.segments)
    }));
  }

  /**
   * 解析地铁换乘段
   */
  _parseTransitSegments(segments) {
    return segments.map(seg => {
      if (seg.bus && seg.bus.buslines && seg.bus.buslines[0]) {
        const line = seg.bus.buslines[0];
        return {
          mode: 'subway',
          line: line.name,
          from: line.departure_stop.name,
          to: line.arrival_stop.name,
          stations: line.via_num + 2,
          duration: Math.ceil(line.duration / 60)
        };
      } else if (seg.walking) {
        return {
          mode: 'walk',
          distance: seg.walking.distance,
          duration: Math.ceil(seg.walking.duration / 60)
        };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * 解析驾车路线数据
   */
  _parseDrivingRoute(path) {
    return {
      distance: path.distance, // 米
      duration: Math.ceil(path.duration / 60), // 秒转分钟
      traffic: path.traffic_lights || 0, // 红绿灯数
      tolls: path.tolls || 0 // 过路费
    };
  }

  /**
   * 模拟地铁数据(测试用)
   */
  _mockSubwayRoutes(origin, destination) {
    console.log('🔧 使用模拟地铁数据');
    return [
      {
        id: 'subway_mock_1',
        type: 'subway',
        duration: 65,
        distance: 45000,
        cost: 9,
        walkDistance: 800,
        segments: [
          {
            mode: 'walk',
            distance: 300,
            duration: 4
          },
          {
            mode: 'subway',
            line: '大兴机场线',
            from: '大兴机场站',
            to: '草桥站',
            stations: 3,
            duration: 20
          },
          {
            mode: 'subway',
            line: '4号线',
            from: '草桥站',
            to: '西直门站',
            stations: 18,
            duration: 35
          },
          {
            mode: 'subway',
            line: '昌平线',
            from: '西直门站',
            to: '生命科学园站',
            stations: 4,
            duration: 10
          },
          {
            mode: 'walk',
            distance: 500,
            duration: 6
          }
        ]
      }
    ];
  }

  /**
   * 模拟驾车数据(测试用)
   */
  _mockDrivingRoute(origin, destination) {
    console.log('🔧 使用模拟驾车数据');
    return {
      distance: 52000,
      duration: 78,
      traffic: 25,
      tolls: 0
    };
  }
}

export default new AmapService();
