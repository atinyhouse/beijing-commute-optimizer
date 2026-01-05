/**
 * 测试脚本 - 验证Phase 2功能
 * 模拟: 大兴机场 → 北京人家小区(昌平)
 */

import routePlanner from './services/routePlannerService.js';

console.log('====================================');
console.log('北京出行优化服务 - Phase 2 测试');
console.log('====================================\n');

// 测试用例: 大兴机场 → 昌平北京人家小区
const testCase = {
  origin: {
    lng: 116.410742,
    lat: 39.509723,
    name: '北京大兴国际机场'
  },
  destination: {
    lng: 116.293678,
    lat: 40.072345,
    name: '北京人家小区(昌平)'
  },
  time: new Date('2025-01-06 18:00:00'), // 晚高峰
  preference: 'balance'
};

async function runTest() {
  try {
    console.log('📍 测试场景:');
    console.log(`   起点: ${testCase.origin.name}`);
    console.log(`   终点: ${testCase.destination.name}`);
    console.log(`   时间: ${testCase.time.toLocaleString('zh-CN')}`);
    console.log(`   偏好: ${testCase.preference}\n`);

    const result = await routePlanner.planRoute(testCase);

    console.log('\n====================================');
    console.log('📊 规划结果');
    console.log('====================================\n');

    // 推荐方案
    console.log('🏆 【推荐方案】');
    printRoute(result.recommended);

    // 最快方案
    console.log('\n⚡ 【最快方案】');
    printRoute(result.fastest);

    // 最便宜方案
    console.log('\n💰 【最省钱方案】');
    printRoute(result.cheapest);

    // 所有方案概览
    console.log('\n📋 【所有方案概览】');
    console.log(`共生成 ${result.allRoutes.length} 个方案\n`);
    result.allRoutes.forEach((route, index) => {
      console.log(`${index + 1}. ${route.summary.description}`);
      console.log(`   时间:${route.totalDuration}分钟 | 费用:¥${route.totalCost} | 综合得分:${route.scores.total}`);
    });

    // 元数据
    console.log('\n📌 【元数据】');
    console.log(`   场景识别: ${result.meta.scenario}`);
    console.log(`   候选方案数: ${result.meta.totalCandidates}`);
    console.log(`   计算时间: ${result.meta.calculatedAt}\n`);

    console.log('====================================');
    console.log('✅ 测试完成!');
    console.log('====================================\n');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

function printRoute(route) {
  if (!route) {
    console.log('   (无方案)');
    return;
  }

  console.log(`   类型: ${getRouteTypeText(route.type)}`);
  console.log(`   总时间: ${route.totalDuration} 分钟`);
  console.log(`   总费用: ¥${route.totalCost}`);
  console.log(`   综合得分: ${route.scores?.total || 'N/A'}/10`);

  if (route.tags && route.tags.length > 0) {
    console.log(`   标签: ${route.tags.join(' | ')}`);
  }

  console.log('\n   路线详情:');
  route.segments.forEach((seg, i) => {
    const icon = getModeIcon(seg.mode);
    if (seg.mode === 'taxi') {
      console.log(`   ${i + 1}. ${icon} 打车 ${seg.from} → ${seg.to}`);
      console.log(`      距离:${(seg.distance / 1000).toFixed(1)}km | 时长:${seg.duration}分钟 | 费用:¥${seg.cost}`);
    } else if (seg.mode === 'subway') {
      console.log(`   ${i + 1}. ${icon} ${seg.line} ${seg.from} → ${seg.to}`);
      console.log(`      ${seg.stations}站 | ${seg.duration}分钟`);
    } else if (seg.mode === 'walk') {
      console.log(`   ${i + 1}. 🚶 步行 ${seg.distance}米 | ${seg.duration}分钟`);
    }
  });
}

function getRouteTypeText(type) {
  const types = {
    'subway': '纯地铁',
    'taxi': '纯打车',
    'mixed': '混合出行'
  };
  return types[type] || type;
}

function getModeIcon(mode) {
  const icons = {
    'taxi': '🚕',
    'subway': '🚇',
    'walk': '🚶'
  };
  return icons[mode] || '📍';
}

// 运行测试
runTest();
