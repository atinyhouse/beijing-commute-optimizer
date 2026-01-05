/**
 * 智能混合方案生成算法
 * 核心创新:生成地铁+打车组合方案
 */

import amapService from '../services/amapService.js';

class MixedRouteGenerator {
  /**
   * 生成混合出行方案
   * @param {Object} origin - 起点
   * @param {Object} destination - 终点
   * @param {Array} subwayStations - 沿线地铁站列表
   * @returns {Promise<Array>} 混合方案列表
   */
  async generateMixedRoutes(origin, destination, subwayStations) {
    const mixedRoutes = [];

    // 策略1: 起点打车到地铁站,然后地铁到终点
    const startTaxiRoutes = await this._generateStartTaxiRoutes(
      origin,
      destination,
      subwayStations
    );
    mixedRoutes.push(...startTaxiRoutes);

    // 策略2: 起点地铁,然后打车到终点
    const endTaxiRoutes = await this._generateEndTaxiRoutes(
      origin,
      destination,
      subwayStations
    );
    mixedRoutes.push(...endTaxiRoutes);

    // 策略3: 两端都打车,中间地铁
    const bothTaxiRoutes = await this._generateBothTaxiRoutes(
      origin,
      destination,
      subwayStations
    );
    mixedRoutes.push(...bothTaxiRoutes);

    // 智能剪枝
    return this._pruneRoutes(mixedRoutes);
  }

  /**
   * 策略1: 起点打车 + 地铁
   */
  async _generateStartTaxiRoutes(origin, destination, stations) {
    const routes = [];

    // 只考虑前5个最近的地铁站
    const nearbyStations = stations.slice(0, 5);

    for (const station of nearbyStations) {
      try {
        // 打车到地铁站
        const taxiSegment = await this._calculateTaxiSegment(origin, station);

        // 地铁到终点
        const subwayRoutes = await amapService.getSubwayRoutes(station, destination);

        if (subwayRoutes.length > 0) {
          const subwaySegment = subwayRoutes[0];

          routes.push({
            id: `mixed_start_taxi_${station.name}`,
            type: 'mixed',
            segments: [
              taxiSegment,
              ...subwaySegment.segments
            ],
            totalDuration: taxiSegment.duration + subwaySegment.duration,
            totalCost: taxiSegment.cost + subwaySegment.cost,
            totalDistance: taxiSegment.distance + subwaySegment.distance
          });
        }
      } catch (error) {
        console.error(`生成起点打车方案失败(${station.name}):`, error.message);
      }
    }

    return routes;
  }

  /**
   * 策略2: 地铁 + 终点打车
   */
  async _generateEndTaxiRoutes(origin, destination, stations) {
    const routes = [];
    const nearbyStations = stations.slice(-5); // 靠近终点的站

    for (const station of nearbyStations) {
      try {
        // 起点到地铁站
        const subwayRoutes = await amapService.getSubwayRoutes(origin, station);

        if (subwayRoutes.length > 0) {
          const subwaySegment = subwayRoutes[0];

          // 地铁站打车到终点
          const taxiSegment = await this._calculateTaxiSegment(station, destination);

          routes.push({
            id: `mixed_end_taxi_${station.name}`,
            type: 'mixed',
            segments: [
              ...subwaySegment.segments,
              taxiSegment
            ],
            totalDuration: subwaySegment.duration + taxiSegment.duration,
            totalCost: subwaySegment.cost + taxiSegment.cost,
            totalDistance: subwaySegment.distance + taxiSegment.distance
          });
        }
      } catch (error) {
        console.error(`生成终点打车方案失败(${station.name}):`, error.message);
      }
    }

    return routes;
  }

  /**
   * 策略3: 打车 + 地铁 + 打车
   */
  async _generateBothTaxiRoutes(origin, destination, stations) {
    const routes = [];

    // 只生成3个代表性方案
    const startStations = stations.slice(0, 2);
    const endStations = stations.slice(-2);

    for (const startStation of startStations) {
      for (const endStation of endStations) {
        try {
          // 起点打车到地铁站
          const startTaxi = await this._calculateTaxiSegment(origin, startStation);

          // 地铁段
          const subwayRoutes = await amapService.getSubwayRoutes(startStation, endStation);

          if (subwayRoutes.length > 0) {
            const subwaySegment = subwayRoutes[0];

            // 地铁站打车到终点
            const endTaxi = await this._calculateTaxiSegment(endStation, destination);

            routes.push({
              id: `mixed_both_taxi_${startStation.name}_${endStation.name}`,
              type: 'mixed',
              segments: [
                startTaxi,
                ...subwaySegment.segments,
                endTaxi
              ],
              totalDuration: startTaxi.duration + subwaySegment.duration + endTaxi.duration,
              totalCost: startTaxi.cost + subwaySegment.cost + endTaxi.cost,
              totalDistance: startTaxi.distance + subwaySegment.distance + endTaxi.distance
            });
          }
        } catch (error) {
          console.error('生成两端打车方案失败:', error.message);
        }
      }
    }

    return routes;
  }

  /**
   * 计算打车段
   */
  async _calculateTaxiSegment(from, to) {
    const driving = await amapService.getDrivingRoute(from, to);

    // 打车费用估算(北京快车标准)
    const cost = this._estimateTaxiCost(driving.distance, driving.duration);

    return {
      mode: 'taxi',
      from: from.name,
      to: to.name,
      distance: driving.distance,
      duration: driving.duration + 3, // 加上等车时间
      cost,
      waitTime: 3
    };
  }

  /**
   * 打车费用估算
   */
  _estimateTaxiCost(distance, duration) {
    const baseFare = 13; // 起步价
    const perKm = 2.3; // 每公里
    const perMin = 0.5; // 每分钟

    const kmCost = Math.max(0, (distance / 1000 - 3)) * perKm; // 起步3公里
    const timeCost = duration * perMin;

    return Math.round((baseFare + kmCost + timeCost) * 10) / 10;
  }

  /**
   * 智能剪枝 - 只保留有价值的方案
   */
  _pruneRoutes(routes) {
    // 规则1: 打车距离太短(<2km)的删除
    let filtered = routes.filter(r => {
      const taxiSegments = r.segments.filter(s => s.mode === 'taxi');
      return taxiSegments.every(s => s.distance > 2000);
    });

    // 规则2: 按综合性价比排序,保留前10个
    filtered.sort((a, b) => {
      const scoreA = a.totalDuration + a.totalCost * 2; // 时间+费用加权
      const scoreB = b.totalDuration + b.totalCost * 2;
      return scoreA - scoreB;
    });

    return filtered.slice(0, 10);
  }

  /**
   * 获取沿线地铁站(简化版,实际需要地铁线路数据)
   */
  async getSubwayStationsAlongRoute(origin, destination) {
    // 模拟数据: 大兴机场线 + 4号线 + 昌平线
    return [
      { name: '大兴机场站', lng: 116.410742, lat: 39.509723 },
      { name: '大兴新城站', lng: 116.338611, lat: 39.728831 },
      { name: '草桥站', lng: 116.345678, lat: 39.856789 },
      { name: '西单站', lng: 116.374762, lat: 39.912289 },
      { name: '西直门站', lng: 116.347382, lat: 39.942327 },
      { name: '北京北站', lng: 116.358065, lat: 39.953039 },
      { name: '生命科学园站', lng: 116.293678, lat: 40.072345 }
    ];
  }
}

export default new MixedRouteGenerator();
