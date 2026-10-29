/**
 * 验证码日志自测脚本
 * Phase 3 自测：验证日志记录、查询、统计
 */

const {
  initLogTable,
  logCodeSend,
  logCodeVerify,
  getPhoneLogs,
  getTodayStats,
  getTodayFailures,
  cleanupOldLogs
} = require('./verification-log');

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);

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

function runTests() {
  console.log('\n========================================');
  console.log('🧪 验证码日志自测');
  console.log('========================================\n');

  // 初始化
  initLogTable();

  // 清空测试数据
  db.exec('DELETE FROM verification_code_logs');

  const testPhone = '+393331234567';

  // ========== 测试 1: 记录发送成功 ==========
  console.log('📋 测试 1: 记录发送成功');

  logCodeSend({
    phone: testPhone,
    code: '123456',
    purpose: 'login',
    status: 'sent',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0'
  });

  const logs1 = getPhoneLogs(testPhone);
  assert(logs1.length === 1, '日志记录 1 条');
  assert(logs1[0].phone === testPhone, '手机号正确');
  assert(logs1[0].code === '123456', '验证码正确');
  assert(logs1[0].purpose === 'login', '用途正确');
  assert(logs1[0].status === 'sent', '状态正确');
  assert(logs1[0].ip_address === '192.168.1.1', 'IP 正确');

  console.log('');

  // ========== 测试 2: 记录验证成功 ==========
  console.log('📋 测试 2: 记录验证成功');

  logCodeVerify({
    phone: testPhone,
    code: '123456',
    purpose: 'login',
    success: true,
    ip: '192.168.1.1'
  });

  const logs2 = getPhoneLogs(testPhone);
  assert(logs2.length === 2, '日志记录 2 条');
  assert(logs2[0].status === 'verified', '验证状态正确');

  console.log('');

  // ========== 测试 3: 记录发送失败 ==========
  console.log('📋 测试 3: 记录发送失败');

  logCodeSend({
    phone: testPhone,
    code: '654321',
    purpose: 'login',
    status: 'failed',
    error: 'Twilio API error: Invalid phone number'
  });

  const logs3 = getPhoneLogs(testPhone);
  assert(logs3.length === 3, '日志记录 3 条');
  assert(logs3[0].status === 'failed', '失败状态正确');
  assert(logs3[0].error_message.includes('Twilio'), '错误信息正确');

  console.log('');

  // ========== 测试 4: 记录验证失败 ==========
  console.log('📋 测试 4: 记录验证失败');

  logCodeVerify({
    phone: testPhone,
    code: '999999',
    purpose: 'login',
    success: false,
    error: '验证码错误或已过期'
  });

  const logs4 = getPhoneLogs(testPhone);
  assert(logs4.length === 4, '日志记录 4 条');
  assert(logs4[0].code === '999999', '错误验证码记录');
  assert(logs4[0].error_message.includes('错误'), '错误信息正确');

  console.log('');

  // ========== 测试 5: 今日统计 ==========
  console.log('📋 测试 5: 今日统计');

  const stats = getTodayStats();
  assert(stats.total === 4, '总记录 4 条');
  assert(stats.sent === 1, '发送成功 1 条');
  assert(stats.verified === 1, '验证成功 1 条');
  assert(stats.failed === 2, '失败 2 条');

  console.log('');

  // ========== 测试 6: 查询失败记录 ==========
  console.log('📋 测试 6: 查询失败记录');

  const failures = getTodayFailures();
  assert(failures.length === 2, '失败记录 2 条');
  assert(failures.every(f => f.status === 'failed'), '全部是失败状态');

  console.log('');

  // ========== 测试 7: 多手机号隔离 ==========
  console.log('📋 测试 7: 多手机号隔离');

  const phone2 = '+393339876543';
  logCodeSend({
    phone: phone2,
    code: '111222',
    purpose: 'register',
    status: 'sent'
  });

  const logsPhone1 = getPhoneLogs(testPhone);
  const logsPhone2 = getPhoneLogs(phone2);

  assert(logsPhone1.length === 4, '手机号 1 有 4 条日志');
  assert(logsPhone2.length === 1, '手机号 2 有 1 条日志');
  assert(logsPhone2[0].purpose === 'register', '手机号 2 用途正确');

  console.log('');

  // ========== 测试 8: 限制返回条数 ==========
  console.log('📋 测试 8: 限制返回条数');

  const limitedLogs = getPhoneLogs(testPhone, 2);
  assert(limitedLogs.length === 2, '限制返回 2 条');

  console.log('');

  // ========== 测试 9: 清理过期日志 ==========
  console.log('📋 测试 9: 清理过期日志');

  // 插入一条 40 天前的日志
  db.prepare(`
    INSERT INTO verification_code_logs
    (phone, code, purpose, status, created_at)
    VALUES (?, ?, ?, ?, datetime('now', '-40 days'))
  `).run('+39000000000', '000000', 'login', 'sent');

  const beforeCleanup = db.prepare('SELECT COUNT(*) as c FROM verification_code_logs').get().c;
  assert(beforeCleanup === 6, '清理前有 6 条日志');

  const cleaned = cleanupOldLogs();
  assert(cleaned === 1, '清理 1 条过期日志');

  const afterCleanup = db.prepare('SELECT COUNT(*) as c FROM verification_code_logs').get().c;
  assert(afterCleanup === 5, '清理后剩 5 条日志');

  console.log('');

  // ========== 汇总 ==========
  console.log('========================================');
  console.log(`📊 测试结果：${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');

  if (failed > 0) {
    console.log('❌ 自测未通过，请检查代码\n');
    process.exit(1);
  } else {
    console.log('✅ 全部通过！Phase 3 自测完成\n');
  }
}

runTests();
