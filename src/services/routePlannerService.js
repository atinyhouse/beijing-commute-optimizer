/**
 * 路线规划主服务 - Phase 2 完整实现
 * 集成: 混合方案生成 + 评分系统 + 场景识别 + 智能推荐
 */

import amapService from '../services/amapService.js';
import mixedRouteGenerator from '../algorithms/mixedRouteGenerator.js';

class RoutePlannerService {
  /**
   * 规划出行路线
   * @param {Object} params - 规划参数
   * @returns {Promise<Object>} 完整方案结果
   */
  async planRoute(params) {
    const {
      origin,
      destination,
      time = new Date(),
      preference = 'balance', // 'time' | 'cost' | 'balance'
      options = {}
    } = params;

    console.log(`\n========== 开始路线规划 ==========`);
    console.log(`起点: ${origin.name}`);
    console.log(`终点: ${destination.name}`);
    console.log(`偏好: ${preference}`);

    // 1. 场景识别
    const scenario = this._detectScenario({ origin, destination, time });
    console.log(`场景识别: ${scenario}`);

    // 2. 生成所有候选方案
    const allRoutes = await this._generateAllRoutes(origin, destination);
    console.log(`生成候选方案: ${allRoutes.length} 个`);

    // 3. 综合评分
    const scoredRoutes = this._calculateScores(allRoutes, preference, scenario);

    // 4. 智能推荐
    const recommendation = this._recommend(scoredRoutes, scenario, preference);

    console.log(`========== 规划完成 ==========\n`);

    return {
      recommended: recommendation.recommended,
      fastest: recommendation.fastest,
      cheapest: recommendation.cheapest,
      allRoutes: scoredRoutes.slice(0, 10),
      meta: {
        scenario,
        preference,
        totalCandidates: allRoutes.length,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 1. 场景识别引擎
   */
  _detectScenario(params) {
    const { origin, destination, time } = params;
    const hour = time.getHours();

    // 场景1: 机场/火车站
    if (destination.name?.includes('机场') || destination.name?.includes('火车站')) {
      return '赶路模式';
    }

    // 场景2: 深夜出行
    if (hour >= 23 || hour < 5) {
      return '深夜模式';
    }

    // 场景3: 早晚高峰
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return '高峰模式';
    }

    return '日常模式';
  }

  /**
   * 2. 生成所有候选方案
   */
  async _generateAllRoutes(origin, destination) {
    const allRoutes = [];

    try {
      // 2.1 纯地铁方案
      console.log('  - 生成纯地铁方案...');
      const subwayRoutes = await amapService.getSubwayRoutes(origin, destination);
      subwayRoutes.forEach(route => {
        route.type = 'subway';
        route.totalDuration = route.duration;
        route.totalCost = route.cost;
        route.totalDistance = route.distance;
      });
      allRoutes.push(...subwayRoutes);

      // 2.2 纯打车方案
      console.log('  - 生成纯打车方案...');
      const taxiRoute = await this._generateTaxiRoute(origin, destination);
      if (taxiRoute) {
        allRoutes.push(taxiRoute);
      }

      // 2.3 混合方案
      console.log('  - 生成混合方案...');
      const stations = await mixedRouteGenerator.getSubwayStationsAlongRoute(origin, destination);
      const mixedRoutes = await mixedRouteGenerator.generateMixedRoutes(origin, destination, stations);
      allRoutes.push(...mixedRoutes);

    } catch (error) {
      console.error('生成路线失败:', error.message);
    }

    return allRoutes;
  }

  /**
   * 生成纯打车方案
   */
  async _generateTaxiRoute(origin, destination) {
    const driving = await amapService.getDrivingRoute(origin, destination);
    if (!driving) return null;

    const cost = this._estimateTaxiCost(driving.distance, driving.duration);

    return {
      id: 'taxi_full',
      type: 'taxi',
      segments: [{
        mode: 'taxi',
        from: origin.name,
        to: destination.name,
        distance: driving.distance,
        duration: driving.duration,
        cost,
        waitTime: 5
      }],
      totalDuration: driving.duration + 5,
      totalCost: cost,
      totalDistance: driving.distance
    };
  }

  /**
   * 打车费用估算(考虑高峰/深夜加价)
   */
  _estimateTaxiCost(distance, duration, scenario = '日常模式') {
    const baseFare = 13;
    const perKm = 2.3;
    const perMin = 0.5;

    let cost = baseFare;
    cost += Math.max(0, (distance / 1000 - 3)) * perKm;
    cost += duration * perMin;

    // 高峰加价
    if (scenario === '高峰模式') {
      cost *= 1.3;
    }

    // 深夜加价
    if (scenario === '深夜模式') {
      cost *= 1.5;
    }

    return Math.round(cost * 10) / 10;
  }

  /**
   * 3. 综合评分系统
   */
  _calculateScores(routes, preference, scenario) {
    if (routes.length === 0) return [];

    // 找到最值用于归一化
    const minTime = Math.min(...routes.map(r => r.totalDuration));
    const maxTime = Math.max(...routes.map(r => r.totalDuration));
    const minCost = Math.min(...routes.map(r => r.totalCost));
    const maxCost = Math.max(...routes.map(r => r.totalCost));

    return routes.map(route => {
      // 时间得分 (0-100)
      const timeScore = maxTime === minTime ? 100 :
        100 * (1 - (route.totalDuration - minTime) / (maxTime - minTime));

      // 费用得分 (0-100)
      const costScore = maxCost === minCost ? 100 :
        100 * (1 - (route.totalCost - minCost) / (maxCost - minCost));

      // 舒适度得分 (0-100)
      const comfortScore = this._calculateComfortScore(route);

      // 根据偏好和场景调整权重
      const weights = this._getWeights(preference, scenario);

      // 综合得分
      const totalScore = (
        timeScore * weights.time +
        costScore * weights.cost +
        comfortScore * weights.comfort
      ) / 100;

      return {
        ...route,
        scores: {
          time: Math.round(timeScore),
          cost: Math.round(costScore),
          comfort: Math.round(comfortScore),
          total: Math.round(totalScore * 10) / 10
        },
        summary: this._generateSummary(route)
      };
    });
  }

  /**
   * 舒适度评分
   */
  _calculateComfortScore(route) {
    let score = 100;

    // 计算换乘次数
    const transfers = route.segments.filter((seg, i) =>
      i > 0 && seg.mode === 'subway' && route.segments[i - 1].mode === 'subway'
    ).length;

    score -= transfers * 15;

    // 计算步行距离
    const walkDistance = route.segments
      .filter(seg => seg.mode === 'walk')
      .reduce((sum, seg) => sum + seg.distance, 0);

    score -= Math.floor(walkDistance / 500) * 5;

    // 打车等待
    const taxiWait = route.segments
      .filter(seg => seg.mode === 'taxi')
      .reduce((sum, seg) => sum + (seg.waitTime || 0), 0);

    score -= taxiWait * 2;

    return Math.max(0, score);
  }

  /**
   * 获取权重(根据偏好和场景)
   */
  _getWeights(preference, scenario) {
    // 基础权重
    const baseWeights = {
      time: { time: 0.7, cost: 0.2, comfort: 0.1 },
      cost: { time: 0.2, cost: 0.7, comfort: 0.1 },
      balance: { time: 0.4, cost: 0.4, comfort: 0.2 }
    };

    let weights = baseWeights[preference] || baseWeights.balance;

    // 场景调整
    if (scenario === '赶路模式') {
      weights = { time: 0.8, cost: 0.1, comfort: 0.1 };
    } else if (scenario === '深夜模式') {
      weights = { time: 0.4, cost: 0.3, comfort: 0.3 }; // 更重视舒适
    }

    return weights;
  }

  /**
   * 4. 智能推荐
   */
  _recommend(scoredRoutes, scenario, preference) {
    if (scoredRoutes.length === 0) {
      return { recommended: null, fastest: null, cheapest: null };
    }

    // 按不同维度排序
    const byTime = [...scoredRoutes].sort((a, b) => a.totalDuration - b.totalDuration);
    const byCost = [...scoredRoutes].sort((a, b) => a.totalCost - b.totalCost);
    const byScore = [...scoredRoutes].sort((a, b) => b.scores.total - a.scores.total);

    // 添加标签
    const fastest = { ...byTime[0], tags: ['最快方案', `比最慢快${Math.round((byTime[byTime.length - 1].totalDuration - byTime[0].totalDuration))}分钟`] };
    const cheapest = { ...byCost[0], tags: ['最省钱', `比最贵省¥${Math.round((byCost[byCost.length - 1].totalCost - byCost[0].totalCost))}`] };
    const recommended = { ...byScore[0], tags: ['推荐方案', this._getRecommendReason(byScore[0], scenario)] };

    return { recommended, fastest, cheapest };
  }

  /**
   * 生成推荐理由
   */
  _getRecommendReason(route, scenario) {
    if (scenario === '高峰模式') {
      return route.type === 'subway' ? '高峰期地铁更稳定' : '省时且不堵车';
    }
    if (scenario === '深夜模式') {
      return '安全便捷';
    }
    if (scenario === '赶路模式') {
      return '最快到达';
    }
    return '综合性价比最高';
  }

  /**
   * 生成方案摘要
   */
  _generateSummary(route) {
    const taxiCount = route.segments.filter(s => s.mode === 'taxi').length;
    const subwayCount = route.segments.filter(s => s.mode === 'subway').length;

    let description = '';
    if (route.type === 'taxi') {
      description = '全程打车';
    } else if (route.type === 'subway') {
      description = '全程地铁';
    } else {
      description = `打车${taxiCount}段 + 地铁${subwayCount}段`;
    }

    return {
      description,
      totalTime: route.totalDuration,
      totalCost: route.totalCost,
      walkDistance: route.segments
        .filter(s => s.mode === 'walk')
        .reduce((sum, s) => sum + s.distance, 0)
    };
  }
}

export default new RoutePlannerService();
