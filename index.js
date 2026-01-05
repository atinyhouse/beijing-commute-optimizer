/**
 * 阿里云函数计算 3.0 入口文件
 * 支持事件触发
 */

import routePlanner from './src/services/routePlannerService.js';

/**
 * 健康检查函数
 */
export async function health(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      requestId: context.requestId
    })
  };
}

/**
 * 路线规划函数
 */
export async function planRoute(event, context) {
  try {
    // 解析请求体
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body || event;
    }

    const { start, end, time, preference, options } = body;

    // 参数验证
    if (!start || !end) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          code: 400,
          message: '缺少起点或终点参数'
        })
      };
    }

    // 转换参数格式
    const params = {
      origin: {
        lng: start.lng,
        lat: start.lat,
        name: start.name || '起点'
      },
      destination: {
        lng: end.lng,
        lat: end.lat,
        name: end.name || '终点'
      },
      time: time ? new Date(time) : new Date(),
      preference: preference || 'balance',
      options: options || {}
    };

    // 执行规划
    const result = await routePlanner.planRoute(params);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 0,
        message: 'success',
        data: result,
        requestId: context.requestId
      })
    };

  } catch (error) {
    console.error('路线规划失败:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 500,
        message: '路线规划失败: ' + error.message,
        requestId: context.requestId
      })
    };
  }
}
