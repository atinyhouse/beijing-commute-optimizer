/**
 * Express API服务器
 */

import express from 'express';
import dotenv from 'dotenv';
import routePlanner from './services/routePlannerService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * POST /api/routes/plan
 * 规划出行路线
 */
app.post('/api/routes/plan', async (req, res) => {
  try {
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

    res.json({
      code: 0,
      message: 'success',
      data: result
    });

  } catch (error) {
    console.error('路线规划失败:', error);
    res.status(500).json({
      code: 500,
      message: '路线规划失败: ' + error.message
    });
  }
});

/**
 * GET /health
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 本地开发时启动服务器
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 北京出行优化服务已启动!`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📖 API文档:`);
    console.log(`   POST /api/routes/plan - 规划路线`);
    console.log(`   GET  /health          - 健康检查\n`);
  });
}

// Vercel Serverless Functions 需要导出app
export default app;
