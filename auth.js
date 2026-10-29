/**
 * JWT 鉴权模块
 * 支持 3 种角色：buyer（买家）、admin（管理员）、warehouse（仓库子账号）
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT Secret（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'lqmercatone_jwt_secret_2026';
const JWT_EXPIRES_IN = '7d'; // 7 天有效期

// bcrypt 配置
const BCRYPT_ROUNDS = 12;

/**
 * 生成 JWT Token
 * @param {Object} payload - { id, role, phone?, username? }
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return jwt.sign(
    {
      sub: payload.id,
      role: payload.role,
      phone: payload.phone,
      username: payload.username,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * 验证 JWT Token
 * @param {string} token
 * @returns {Object|null} decoded payload or null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('JWT 验证失败:', error.message);
    return null;
  }
}

/**
 * 密码加密（bcrypt）
 * @param {string} password
 * @returns {Promise<string>} hash
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 验证密码
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * 角色鉴权中间件
 * @param {string|string[]} roles - 允许的角色列表
 * @returns {Function} Express middleware
 */
function requireRole(roles) {
  // 统一转为数组
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录', error_en: 'Not authenticated' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ error: 'Token 无效或已过期', error_en: 'Invalid or expired token' });
      }

      // 检查角色权限
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          error: '权限不足',
          error_en: 'Insufficient permissions',
          required_roles: allowedRoles,
          current_role: decoded.role
        });
      }

      // 将用户信息附加到 request
      req.user = {
        id: decoded.sub,
        role: decoded.role,
        phone: decoded.phone,
        username: decoded.username
      };

      next();
    } catch (error) {
      console.error('鉴权中间件错误:', error);
      res.status(500).json({ error: '鉴权失败', error_en: 'Authentication failed' });
    }
  };
}

/**
 * 买家专用中间件（快捷方式）
 */
function requireBuyer(req, res, next) {
  return requireRole('buyer')(req, res, next);
}

/**
 * 管理员专用中间件（仅主账号）
 */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/**
 * 仓库管理员中间件（主账号 + 子账号）
 */
function requireWarehouseOrAdmin(req, res, next) {
  return requireRole(['admin', 'warehouse'])(req, res, next);
}

/**
 * 可选鉴权（不强制登录，但如果有 token 则解析）
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (decoded) {
        req.user = {
          id: decoded.sub,
          role: decoded.role,
          phone: decoded.phone,
          username: decoded.username
        };
      }
    }

    next();
  } catch (error) {
    // 可选鉴权，失败也继续
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  requireRole,
  requireBuyer,
  requireAdmin,
  requireWarehouseOrAdmin,
  optionalAuth,
  JWT_SECRET
};
