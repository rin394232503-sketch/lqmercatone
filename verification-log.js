/**
 * 短信验证码日志模块
 * 记录所有验证码发送、验证行为，方便排查
 */

const Database = require('better-sqlite3');
const path = require('path');

// 连接 SQLite
const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * 初始化日志表
 */
function initLogTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_code_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone VARCHAR(20) NOT NULL,
      code VARCHAR(10) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_vcl_phone ON verification_code_logs(phone);
    CREATE INDEX IF NOT EXISTS idx_vcl_created ON verification_code_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_vcl_status ON verification_code_logs(status);
  `);
}

/**
 * 记录验证码发送日志
 * @param {Object} params
 * @param {string} params.phone - 手机号
 * @param {string} params.code - 验证码
 * @param {string} params.purpose - 用途 ('login' | 'register' | 'reset_password')
 * @param {string} params.status - 状态 ('sent' | 'failed')
 * @param {string} [params.ip] - IP 地址
 * @param {string} [params.userAgent] - User-Agent
 * @param {string} [params.error] - 错误信息
 */
function logCodeSend(params) {
  try {
    initLogTable();

    const stmt = db.prepare(`
      INSERT INTO verification_code_logs
      (phone, code, purpose, status, ip_address, user_agent, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      params.phone,
      params.code,
      params.purpose || 'login',
      params.status,
      params.ip || null,
      params.userAgent || null,
      params.error || null
    );

    console.log(`📝 验证码日志: ${params.phone} | ${params.purpose} | ${params.status}`);
  } catch (error) {
    console.error('记录验证码日志失败:', error);
  }
}

/**
 * 记录验证码验证日志
 * @param {Object} params
 * @param {string} params.phone - 手机号
 * @param {string} params.code - 验证码
 * @param {string} params.purpose - 用途
 * @param {boolean} params.success - 是否验证成功
 * @param {string} [params.ip] - IP 地址
 * @param {string} [params.error] - 错误信息
 */
function logCodeVerify(params) {
  try {
    initLogTable();

    const status = params.success ? 'verified' : 'failed';

    const stmt = db.prepare(`
      INSERT INTO verification_code_logs
      (phone, code, purpose, status, ip_address, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      params.phone,
      params.code,
      params.purpose || 'login',
      status,
      params.ip || null,
      params.error || null
    );

    console.log(`📝 验证日志: ${params.phone} | ${params.purpose} | ${status}`);
  } catch (error) {
    console.error('记录验证日志失败:', error);
  }
}

/**
 * 查询某手机号的验证码日志
 * @param {string} phone - 手机号
 * @param {number} [limit=10] - 返回条数
 * @returns {Array}
 */
function getPhoneLogs(phone, limit = 10) {
  try {
    initLogTable();

    return db.prepare(`
      SELECT * FROM verification_code_logs
      WHERE phone = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(phone, limit);
  } catch (error) {
    console.error('查询验证码日志失败:', error);
    return [];
  }
}

/**
 * 查询今天的验证码发送统计
 * @returns {Object}
 */
function getTodayStats() {
  try {
    initLogTable();

    const stats = db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM verification_code_logs
      WHERE created_at >= date('now')
      GROUP BY status
    `).all();

    const result = {
      total: 0,
      sent: 0,
      verified: 0,
      failed: 0,
      expired: 0
    };

    stats.forEach(s => {
      result[s.status] = s.count;
      result.total += s.count;
    });

    return result;
  } catch (error) {
    console.error('查询统计失败:', error);
    return { total: 0, sent: 0, verified: 0, failed: 0, expired: 0 };
  }
}

/**
 * 查询今天的失败记录
 * @param {number} [limit=50]
 * @returns {Array}
 */
function getTodayFailures(limit = 50) {
  try {
    initLogTable();

    return db.prepare(`
      SELECT * FROM verification_code_logs
      WHERE status = 'failed'
        AND created_at >= date('now')
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    console.error('查询失败记录失败:', error);
    return [];
  }
}

/**
 * 清理过期日志（保留 30 天）
 */
function cleanupOldLogs() {
  try {
    initLogTable();

    const result = db.prepare(`
      DELETE FROM verification_code_logs
      WHERE created_at < date('now', '-30 days')
    `).run();

    console.log(`🧹 清理过期验证码日志: ${result.changes} 条`);
    return result.changes;
  } catch (error) {
    console.error('清理日志失败:', error);
    return 0;
  }
}

module.exports = {
  initLogTable,
  logCodeSend,
  logCodeVerify,
  getPhoneLogs,
  getTodayStats,
  getTodayFailures,
  cleanupOldLogs
};
