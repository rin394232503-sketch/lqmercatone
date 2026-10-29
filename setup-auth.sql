-- ============================================
-- L&Qmercatone 鉴权系统 SQL
-- 版本：v1.0
-- 日期：2026-10-29
-- ============================================

-- 1. 管理员用户表（主账号 + 仓库子账号）
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'warehouse')),
  real_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- 2. 买家表（补充缺失字段）
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'it';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT false;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. 验证码日志表
CREATE TABLE IF NOT EXISTS verification_code_logs (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('login', 'register', 'reset_password', 'phone_change')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'verified', 'expired', 'failed')),
  ip_address VARCHAR(50),
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vcl_phone ON verification_code_logs(phone);
CREATE INDEX IF NOT EXISTS idx_vcl_created ON verification_code_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_vcl_status ON verification_code_logs(status);

-- 4. 插入默认管理员账号
-- 用户名: admin
-- 密码: admin123（生产环境请修改）
INSERT INTO admin_users (username, password_hash, role, real_name)
VALUES (
  'admin',
  '$2a$12$LJ3m4ys3Lf8xSLzFqQvS5.ZG6sRj7bKvMhGqLZ3r1xKj5vZ9wXy6C',
  'admin',
  'Super Admin'
)
ON CONFLICT (username) DO NOTHING;

-- 5. 插入默认仓库子账号
-- 用户名: warehouse_001
-- 密码: warehouse123（生产环境请修改）
INSERT INTO admin_users (username, password_hash, role, real_name)
VALUES (
  'warehouse_001',
  '$2a$12$LJ3m4ys3Lf8xSLzFqQvS5.ZG6sRj7bKvMhGqLZ3r1xKj5vZ9wXy6C',
  'warehouse',
  'Magazzino 001'
)
ON CONFLICT (username) DO NOTHING;

-- 6. 操作日志表（补充角色字段）
ALTER TABLE operation_logs ADD COLUMN IF NOT EXISTS user_role VARCHAR(20);

-- ============================================
-- 说明：
--
-- 管理员默认密码（均为 admin123 / warehouse123）
-- bcrypt hash: $2a$12$LJ3m4ys3Lf8xSLzFqQvS5.ZG6sRj7bKvMhGqLZ3r1xKj5vZ9wXy6C
--
-- 生产环境部署前务必修改密码！
--
-- 角色权限：
-- admin     → 全部权限（商品/订单/售后/报表/员工管理）
-- warehouse → 有限权限（查看订单/发货/库存，不能改价/删商品/看报表）
-- buyer     → 买家权限（浏览/下单/评价/查看自己订单）
-- ============================================
