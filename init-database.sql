-- L&Q Mercatone v2 数据库初始化脚本
-- 在 Supabase SQL Editor 中运行
-- https://supabase.com/dashboard/project/yiyydikfpgbmtdypiggc/sql/new

-- ============================================
-- 枚举类型
-- ============================================

CREATE TYPE user_role AS ENUM ('BUYER', 'ADMIN', 'WAREHOUSE');
CREATE TYPE product_category AS ENUM ('ABBIGLIAMENTO', 'DETERSIVI', 'CASA', 'ELETTRONICA', 'TRUCCO', 'CURA_PELLE', 'FIORI', 'DECORAZIONI', 'ALTRO');
CREATE TYPE order_status AS ENUM ('PENDING_PAYMENT', 'PENDING_SHIP', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDING', 'REFUNDED');
CREATE TYPE coupon_type AS ENUM ('NO_THRESHOLD', 'FULL_REDUCTION', 'PERCENTAGE', 'SPECIFIC_PRODUCT');

-- ============================================
-- 用户表
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  name TEXT,
  avatar TEXT,
  role user_role NOT NULL DEFAULT 'BUYER',
  password_hash TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'it',
  email_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 商品表
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  name_it TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category product_category NOT NULL,
  price_cent INTEGER NOT NULL,
  old_price_cent INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  on_sale BOOLEAN NOT NULL DEFAULT false,
  barcode TEXT UNIQUE,
  sizes TEXT[] DEFAULT '{}',
  colors TEXT[] DEFAULT '{}',
  weight INTEGER,
  is_large BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_on_sale ON products(on_sale);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_price ON products(price_cent);

-- ============================================
-- 收货地址表
-- ============================================

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  detail TEXT NOT NULL,
  city TEXT,
  postcode TEXT,
  region TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================
-- 订单表
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  order_no TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  subtotal_cent INTEGER NOT NULL,
  shipping_cent INTEGER NOT NULL,
  discount_cent INTEGER NOT NULL DEFAULT 0,
  total_cent INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  status order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_deadline TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  shipping_region TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_postcode TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  buyer_note TEXT,
  admin_note TEXT,
  is_pickup BOOLEAN NOT NULL DEFAULT false,
  pickup_code TEXT,
  language TEXT NOT NULL DEFAULT 'it',
  coupon_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_no ON orders(order_no);

-- ============================================
-- 订单明细表
-- ============================================

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price_cent INTEGER NOT NULL,
  color TEXT,
  size TEXT
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================
-- 购物车表
-- ============================================

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id, color, size)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);

-- ============================================
-- 评价表
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id, product_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ============================================
-- 优惠券表
-- ============================================

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  code TEXT UNIQUE NOT NULL,
  type coupon_type NOT NULL,
  value_cent INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER,
  min_order_cent INTEGER NOT NULL DEFAULT 0,
  total_limit INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  new_user_only BOOLEAN NOT NULL DEFAULT false,
  stackable BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);

-- ============================================
-- 用户优惠券表
-- ============================================

CREATE TABLE IF NOT EXISTS user_coupons (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id),
  coupon_id TEXT NOT NULL REFERENCES coupons(id),
  used_at TIMESTAMPTZ,
  used_order_id TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, coupon_id)
);

CREATE INDEX idx_user_coupons_user ON user_coupons(user_id);
CREATE INDEX idx_user_coupons_coupon ON user_coupons(coupon_id);

-- ============================================
-- 优惠券使用日志表
-- ============================================

CREATE TABLE IF NOT EXISTS coupon_usage_logs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  coupon_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  order_id TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 收藏表
-- ============================================

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- ============================================
-- 验证码日志表
-- ============================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX idx_verification_codes_created ON verification_codes(created_at);

-- ============================================
-- 操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT,
  user_role TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operation_logs_target ON operation_logs(target_type, target_id);
CREATE INDEX idx_operation_logs_created ON operation_logs(created_at);

-- ============================================
-- 退货地址表
-- ============================================

CREATE TABLE IF NOT EXISTS return_addresses (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 邮件同意日志表
-- ============================================

CREATE TABLE IF NOT EXISTS email_consent_logs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  agreed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 插入默认管理员账号
-- ============================================

INSERT INTO users (phone, name, role, password_hash, preferred_lang)
VALUES (
  'admin',
  'Super Admin',
  'ADMIN',
  '$2b$12$EG.0Y9L0.xxTSkII8.emneM8uMb6O4PmRsXzlgjBOxp5BftVeVsV2',
  'it'
) ON CONFLICT (phone) DO NOTHING;

INSERT INTO users (phone, name, role, password_hash, preferred_lang)
VALUES (
  'warehouse_001',
  'Magazzino 001',
  'WAREHOUSE',
  '$2b$12$JkI3cRAQfj37UK60nRmn8eWuTpMzzN5khq0lBbk5xm6Jqs6QxOTgu',
  'it'
) ON CONFLICT (phone) DO NOTHING;

-- ============================================
-- 完成！
-- ============================================

-- 验证表数量
SELECT '✅ 数据库初始化完成！' AS status;
SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public';
