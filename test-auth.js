/**
 * JWT 鉴权系统自测脚本
 * Phase 1 自测：验证 JWT 生成、角色中间件、密码加密
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 配置
const JWT_SECRET = 'lqmercatone_jwt_secret_2026';
const BCRYPT_ROUNDS = 12;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 JWT 鉴权系统自测');
  console.log('========================================\n');

  // ========== 测试 1: bcrypt 密码加密 ==========
  console.log('📋 测试 1: bcrypt 密码加密');

  const adminPassword = 'admin123';
  const adminHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  assert(adminHash.startsWith('$2b$12$'), '生成正确的 bcrypt hash 格式');
  assert(adminHash.length === 60, 'Hash 长度正确 (60 字符)');
  assert(adminHash !== adminPassword, 'Hash 不等于原始密码');

  const verifyCorrect = await bcrypt.compare('admin123', adminHash);
  assert(verifyCorrect === true, '正确密码验证通过');

  const verifyWrong = await bcrypt.compare('wrongpassword', adminHash);
  assert(verifyWrong === false, '错误密码验证失败');

  console.log('');

  // ========== 测试 2: JWT Token 生成 ==========
  console.log('📋 测试 2: JWT Token 生成');

  const buyerPayload = {
    sub: 'buyer-123',
    role: 'buyer',
    phone: '+393331234567',
    iat: Math.floor(Date.now() / 1000)
  };

  const buyerToken = jwt.sign(buyerPayload, JWT_SECRET, { expiresIn: '7d' });
  assert(typeof buyerToken === 'string', '生成 buyer token (string)');
  assert(buyerToken.split('.').length === 3, 'Token 包含 3 部分 (header.payload.signature)');

  const adminPayload = {
    sub: 'admin-456',
    role: 'admin',
    username: 'admin',
    iat: Math.floor(Date.now() / 1000)
  };

  const adminToken = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '7d' });
  assert(typeof adminToken === 'string', '生成 admin token');
  assert(buyerToken !== adminToken, '不同角色 token 不同');

  console.log('');

  // ========== 测试 3: JWT Token 验证 ==========
  console.log('📋 测试 3: JWT Token 验证');

  const decodedBuyer = jwt.verify(buyerToken, JWT_SECRET);
  assert(decodedBuyer.sub === 'buyer-123', '解析 buyer token - sub 正确');
  assert(decodedBuyer.role === 'buyer', '解析 buyer token - role 正确');
  assert(decodedBuyer.phone === '+393331234567', '解析 buyer token - phone 正确');

  const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);
  assert(decodedAdmin.sub === 'admin-456', '解析 admin token - sub 正确');
  assert(decodedAdmin.role === 'admin', '解析 admin token - role 正确');
  assert(decodedAdmin.username === 'admin', '解析 admin token - username 正确');

  console.log('');

  // ========== 测试 4: 过期 Token ==========
  console.log('📋 测试 4: 过期 Token 处理');

  const expiredPayload = {
    sub: 'buyer-789',
    role: 'buyer',
    iat: Math.floor(Date.now() / 1000) - 86400 * 8, // 8 天前签发
    exp: Math.floor(Date.now() / 1000) - 86400 // 昨天过期
  };

  // 直接签名，不再传 expiresIn（payload 已有 exp）
  const expiredToken = jwt.sign(expiredPayload, JWT_SECRET);

  let expiredResult = false;
  try {
    jwt.verify(expiredToken, JWT_SECRET);
  } catch (error) {
    expiredResult = error.name === 'TokenExpiredError';
  }
  assert(expiredResult === true, '过期 token 抛出 TokenExpiredError');

  console.log('');

  // ========== 测试 5: 非法 Token ==========
  console.log('📋 测试 5: 非法 Token 处理');

  let invalidResult = false;
  try {
    jwt.verify('invalid.token.here', JWT_SECRET);
  } catch (error) {
    invalidResult = error.name === 'JsonWebTokenError';
  }
  assert(invalidResult === true, '非法 token 抛出 JsonWebTokenError');

  let nullResult = false;
  try {
    const decoded = jwt.verify(null, JWT_SECRET);
  } catch (error) {
    nullResult = true;
  }
  assert(nullResult === true, 'null token 验证失败');

  console.log('');

  // ========== 测试 6: 角色权限检查 ==========
  console.log('📋 测试 6: 角色权限检查逻辑');

  function checkRole(token, allowedRoles) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return allowedRoles.includes(decoded.role);
    } catch {
      return false;
    }
  }

  // buyer 只能访问 buyer 接口
  assert(checkRole(buyerToken, ['buyer']) === true, 'buyer 可以访问 buyer 接口');
  assert(checkRole(buyerToken, ['admin']) === false, 'buyer 不能访问 admin 接口');
  assert(checkRole(buyerToken, ['admin', 'warehouse']) === false, 'buyer 不能访问 warehouse 接口');

  // admin 可以访问 admin 和 warehouse 接口
  assert(checkRole(adminToken, ['admin']) === true, 'admin 可以访问 admin 接口');
  assert(checkRole(adminToken, ['buyer']) === false, 'admin 不能访问 buyer 接口');
  assert(checkRole(adminToken, ['admin', 'warehouse']) === true, 'admin 可以访问 warehouse 接口（含 admin）');

  console.log('');

  // ========== 测试 7: 三种角色对比 ==========
  console.log('📋 测试 7: 三种角色对比');

  const warehousePayload = {
    sub: 'warehouse-001',
    role: 'warehouse',
    username: 'warehouse_001',
    iat: Math.floor(Date.now() / 1000)
  };

  const warehouseToken = jwt.sign(warehousePayload, JWT_SECRET, { expiresIn: '7d' });
  const decodedWarehouse = jwt.verify(warehouseToken, JWT_SECRET);

  assert(decodedWarehouse.role === 'warehouse', 'warehouse 角色正确');
  assert(decodedWarehouse.username === 'warehouse_001', 'warehouse 用户名正确');

  // warehouse 可以访问 warehouse 接口
  assert(checkRole(warehouseToken, ['admin', 'warehouse']) === true, 'warehouse 可以访问 warehouse 接口');
  // warehouse 不能访问 admin 专属接口
  assert(checkRole(warehouseToken, ['admin']) === false, 'warehouse 不能访问 admin 专属接口');

  console.log('');

  // ========== 汇总 ==========
  console.log('========================================');
  console.log(`📊 测试结果：${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('❌ 自测未通过，请检查代码\n');
    process.exit(1);
  } else {
    console.log('✅ 全部通过！Phase 1 自测完成\n');
  }
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
