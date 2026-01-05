/**
 * Vercel Serverless Function 入口
 * 优化为按需加载,减少冷启动时间
 */

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;

  try {
    // 健康检查
    if (url === '/health' && method === 'GET') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    }

    // 路线规划 API
    if (url === '/api/routes/plan' && method === 'POST') {
      // 按需动态导入
      const { default: routePlanner } = await import('../src/services/routePlannerService.js');

      const { start, end, time, preference, options } = req.body;

      // 参数验证
      if (!start || !end) {
        return res.status(400).json({
          code: 400,
          message: '缺少起点或终点参数'
        });
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

      return res.status(200).json({
        code: 0,
        message: 'success',
        data: result
      });
    }

    // 404
    return res.status(404).json({
      code: 404,
      message: 'Not Found'
    });

  } catch (error) {
    console.error('请求处理失败:', error);
    return res.status(500).json({
      code: 500,
      message: '服务器错误: ' + error.message
    });
  }
}
