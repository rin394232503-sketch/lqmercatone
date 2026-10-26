-- ============================================
-- L&Qmercatone Supabase 数据库设置
-- 在 Supabase SQL Editor 中运行以下代码
-- ============================================

-- 1. 商品表
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Abbigliamento',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  old_price DECIMAL(10,2),
  emoji TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  tag TEXT,
  on_sale BOOLEAN DEFAULT FALSE,
  stock INTEGER DEFAULT 99,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_wechat TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  customer_address TEXT NOT NULL,
  payment_method TEXT DEFAULT '微信支付',
  note TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 网站设置表
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO site_settings (key, value) VALUES
('store_name', 'L&Qmercatone'),
('store_tagline', 'Qualità selezionata per te'),
('store_description', 'Abbigliamento, elettronica, trucco e cura della pelle'),
('store_phone', ''),
('store_email', ''),
('store_address', ''),
('store_wechat', ''),
('store_whatsapp', ''),
('store_douyin', ''),
('store_tiktok', ''),
('store_instagram', ''),
('store_facebook', ''),
('store_xiaohongshu', ''),
('footer_text', '© 2026 L&Qmercatone. Tutti i diritti riservati.')
ON CONFLICT (key) DO NOTHING;

-- 4. 启用 Realtime（实时推送）
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE site_settings;

-- 4. 设置 RLS（行级安全）- 允许匿名读写
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to site_settings" ON site_settings FOR ALL USING (true) WITH CHECK (true);

-- 5. 插入默认商品数据
INSERT INTO products (name, brand, category, price, old_price, emoji, tag, on_sale) VALUES
-- 衣服
('Cappotto Classico in Cashmere', 'L&Q Collection', 'Abbigliamento', 1299, 1899, '🧥', 'hot', true),
('Abito Floreale Francese', 'Maison Belle', 'Abbigliamento', 459, NULL, '', 'new', false),
('Jeans Slim Vita Alta', 'Denim Lab', 'Abbigliamento', 329, 459, '', 'sale', true),
('Camicia di Seta Bianca', 'Silk Touch', 'Abbigliamento', 599, NULL, '', NULL, false),
('Set Sportivo Casual', 'Active Life', 'Abbigliamento', 389, NULL, '', 'new', false),
('Maglione in Lana', 'L&Q Collection', 'Abbigliamento', 459, 699, '', 'sale', true),
('Giacca in Pelle', 'Urban Style', 'Abbigliamento', 899, 1299, '🧥', 'hot', true),
('Felpa con Cappuccio', 'Active Life', 'Abbigliamento', 259, NULL, '', 'new', false),
-- 洗洁剂
('Detersivo Lavatrice 3L', 'PulitoMax', 'Detersivi', 18.99, 24.99, '', 'sale', true),
('Detersivo Piatti Limone', 'PulitoMax', 'Detersivi', 4.99, NULL, '🍋', NULL, false),
('Ammorbidente Pavimenti', 'CasaPulita', 'Detersivi', 7.99, 11.99, '', 'sale', true),
('Candeggina Classica 1.5L', 'PulitoMax', 'Detersivi', 3.49, NULL, '', 'hot', true),
('Detersivo Lavastoviglie 30pz', 'CasaPulita', 'Detersivi', 12.99, 16.99, '✨', 'sale', true),
('Sgrassatore Universale', 'CasaPulita', 'Detersivi', 5.99, NULL, '', 'new', false),
('Detersivo Vetri Spray', 'PulitoMax', 'Detersivi', 4.49, 5.99, '', 'sale', true),
('Sapone Marsiglia 2L', 'NaturaleBio', 'Detersivi', 9.99, NULL, '', 'new', false),
-- 家用品
('Set Asciugamani 6pz', 'CasaComfort', 'Casa', 39.99, 59.99, '', 'sale', true),
('Lampada LED da Tavolo', 'BrightHome', 'Casa', 29.99, NULL, '', 'new', false),
('Set Pentole 5pz', 'CucinaPro', 'Casa', 89.99, 129.99, '', 'hot', true),
('Aspirapolvere Portatile', 'CleanMax', 'Casa', 49.99, 69.99, '🧹', 'sale', true),
('Set Lenzuola Matrimoniale', 'CasaComfort', 'Casa', 59.99, NULL, '', 'new', false),
('Organizer Cucina', 'CasaSmart', 'Casa', 19.99, 29.99, '', 'sale', true),
('Diffusore Profumo Casa', 'AromaVivo', 'Casa', 24.99, NULL, '', 'new', false),
('Set Tazze Ceramica 4pz', 'CasaComfort', 'Casa', 22.99, 32.99, '☕', 'sale', true);

-- 6. 创建图片上传 Bucket
-- 在 Supabase Storage 页面手动创建名为 "product-images" 的 bucket
-- 然后运行：
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
