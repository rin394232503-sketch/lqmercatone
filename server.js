const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Database Setup =====
const dbPath = path.join(__dirname, 'data', 'shop.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT '其他',
    price REAL NOT NULL DEFAULT 0,
    old_price REAL,
    emoji TEXT DEFAULT '📦',
    image TEXT,
    tag TEXT,
    on_sale INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 99,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_wechat TEXT DEFAULT '',
    customer_email TEXT DEFAULT '',
    customer_address TEXT NOT NULL,
    payment_method TEXT DEFAULT '微信支付',
    note TEXT DEFAULT '',
    items_json TEXT NOT NULL,
    total_amount REAL NOT NULL,
    item_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    settled INTEGER DEFAULT 0,
    settled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settle_date TEXT NOT NULL UNIQUE,
    order_count INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    details_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Seed default products if empty
const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  const seed = [
    { name:'Cappotto Classico in Cashmere', brand:'L&Q Collection', category:'Abbigliamento', price:1299, oldPrice:1899, emoji:'🧥', tag:'hot', onSale:1 },
    { name:'Abito Floreale Francese', brand:'Maison Belle', category:'Abbigliamento', price:459, oldPrice:null, emoji:'👗', tag:'new', onSale:0 },
    { name:'Jeans Slim Vita Alta', brand:'Denim Lab', category:'Abbigliamento', price:329, oldPrice:459, emoji:'👖', tag:'sale', onSale:1 },
    { name:'Camicia di Seta Bianca', brand:'Silk Touch', category:'Abbigliamento', price:599, oldPrice:null, emoji:'👔', tag:null, onSale:0 },
    { name:'Set Sportivo Casual', brand:'Active Life', category:'Abbigliamento', price:389, oldPrice:null, emoji:'🏃', tag:'new', onSale:0 },
    { name:'Maglione in Lana', brand:'L&Q Collection', category:'Abbigliamento', price:459, oldPrice:699, emoji:'🧶', tag:'sale', onSale:1 },
    { name:'Cuffie Wireless Pro con Cancellazione Rumore', brand:'SoundMax', category:'Elettronica', price:899, oldPrice:1299, emoji:'🎧', tag:'hot', onSale:1 },
    { name:'Smartwatch S3', brand:'TechWear', category:'Elettronica', price:1599, oldPrice:null, emoji:'⌚', tag:'new', onSale:0 },
    { name:'Altoparlante Bluetooth Portatile', brand:'SoundMax', category:'Elettronica', price:299, oldPrice:399, emoji:'🔊', tag:'sale', onSale:1 },
    { name:'Ultrabook', brand:'PowerBook', category:'Elettronica', price:5999, oldPrice:null, emoji:'💻', tag:null, onSale:0 },
    { name:'Power Bank 20000mAh a Carica Rapida', brand:'JuicePack', category:'Elettronica', price:199, oldPrice:259, emoji:'🔋', tag:'sale', onSale:1 },
    { name:'Lampada Smart Proteggi-Vista', brand:'BrightHome', category:'Elettronica', price:249, oldPrice:null, emoji:'💡', tag:'new', onSale:0 },
    { name:'Set Rossetti Opachi in Velluto', brand:'Glow Up', category:'Trucco', price:259, oldPrice:359, emoji:'💄', tag:'hot', onSale:1 },
    { name:'Fondotinta Correttivo a Lunga Tenuta', brand:'Perfect Skin', category:'Trucco', price:329, oldPrice:null, emoji:'🎨', tag:'new', onSale:0 },
    { name:'Palette Ombretti Notte Stellata', brand:'Glow Up', category:'Trucco', price:189, oldPrice:null, emoji:'✨', tag:null, onSale:0 },
    { name:'Mascara Allungante e Volumizzante', brand:'Lash Pro', category:'Trucco', price:129, oldPrice:169, emoji:'👁️', tag:'sale', onSale:1 },
    { name:'Palette Illuminante e Fard Naturale', brand:'Glow Up', category:'Trucco', price:219, oldPrice:null, emoji:'🌸', tag:'new', onSale:0 },
    { name:'Spray Fissante a Lunga Tenuta', brand:'Perfect Skin', category:'Trucco', price:99, oldPrice:139, emoji:'💦', tag:'sale', onSale:1 },
    { name:"Siero all'Acido Ialuronico 30ml", brand:'Aqua Lab', category:'Cura della Pelle', price:299, oldPrice:459, emoji:'💧', tag:'hot', onSale:1 },
    { name:'Crema Antietà al Retinolo', brand:'Youth Glow', category:'Cura della Pelle', price:459, oldPrice:null, emoji:'🧴', tag:'new', onSale:0 },
    { name:'Detergente Viso agli Aminoacidi', brand:'Gentle Care', category:'Cura della Pelle', price:129, oldPrice:null, emoji:'🫧', tag:null, onSale:0 },
    { name:'Maschera Illuminante alla Niacinamide 5pz', brand:'Aqua Lab', category:'Cura della Pelle', price:159, oldPrice:199, emoji:'🎭', tag:'sale', onSale:1 },
    { name:'Protezione Solare SPF50+', brand:'Sun Shield', category:'Cura della Pelle', price:189, oldPrice:null, emoji:'☀️', tag:'new', onSale:0 },
    { name:'Contorno Occhi Levigante 15ml', brand:'Youth Glow', category:'Cura della Pelle', price:389, oldPrice:529, emoji:'👀', tag:'sale', onSale:1 },
  ];

  const insert = db.prepare(`
    INSERT INTO products (name, brand, category, price, old_price, emoji, tag, on_sale)
    VALUES (@name, @brand, @category, @price, @oldPrice, @emoji, @tag, @onSale)
  `);
  const tx = db.transaction(() => {
    for (const p of seed) insert.run(p);
  });
  tx();
}

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  }
});

// ===== Static Files =====
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic sitemap with real products
app.get('/sitemap.xml', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  const today = new Date().toISOString().slice(0, 10);
  const host = req.protocol + '://' + req.get('host');

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Main page
  xml += `  <url><loc>${host}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority>`;
  xml += `<xhtml:link rel="alternate" hreflang="it" href="${host}/"/>`;
  xml += `</url>\n`;

  // Category pages
  const cats = ['Abbigliamento','Elettronica','Trucco','Cura della Pelle'];
  const slugs = ['abbigliamento','elettronica','trucco','cura-della-pelle'];
  cats.forEach((cat, i) => {
    xml += `  <url><loc>${host}/#${slugs[i]}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  });

  // Individual products
  products.forEach(p => {
    xml += `  <url><loc>${host}/#product-${p.id}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  });

  xml += '</urlset>';
  res.type('application/xml').send(xml);
});

// Dynamic product structured data
app.get('/api/structured-data/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE on_sale = 1 ORDER BY created_at DESC').all();
  const host = req.protocol + '://' + req.get('host');

  const schema = products.map(p => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": p.name,
    "description": `${p.name} — ${p.brand} (${p.category})`,
    "brand": { "@type": "Brand", "name": p.brand || "L&Qmercatone" },
    "category": p.category,
    "offers": {
      "@type": "Offer",
      "price": p.price,
      "priceCurrency": "EUR",
      "availability": p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "url": `${host}/#product-${p.id}`,
      ...(p.old_price ? { "priceValidUntil": new Date(Date.now() + 30*86400000).toISOString().slice(0,10) } : {})
    },
    ...(p.old_price ? {
      "additionalProperty": [{
        "@type": "PropertyValue",
        "name": "Prezzo originale",
        "value": `€${p.old_price}`
      }]
    } : {})
  }));

  res.json(schema);
});

// ===== Product API =====

app.get('/api/products', (req, res) => {
  const { category, on_sale, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category && category !== '全部') { sql += ' AND category = ?'; params.push(category); }
  if (on_sale === '1') { sql += ' AND on_sale = 1'; params.push(1); }
  if (search) { sql += ' AND (name LIKE ? OR brand LIKE ? OR category LIKE ?)'; const q = `%${search}%`; params.push(q, q, q); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Prodotto non esistente' });
  res.json(product);
});

app.post('/api/products', (req, res) => {
  const { name, brand, category, price, old_price, emoji, tag, on_sale, stock, description } = req.body;
  if (!name || !category || price === undefined) return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  const result = db.prepare(`
    INSERT INTO products (name, brand, category, price, old_price, emoji, tag, on_sale, stock, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand || '', category, price, old_price || null, emoji || '📦', tag || null, on_sale ? 1 : 0, stock || 99, description || '');
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/products/:id', (req, res) => {
  const { name, brand, category, price, old_price, emoji, tag, on_sale, stock, description, image } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Prodotto non esistente' });
  db.prepare(`
    UPDATE products SET name=?, brand=?, category=?, price=?, old_price=?, emoji=?, tag=?, on_sale=?, stock=?, description=?,
    image=COALESCE(?,image), updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name||existing.name, brand!==undefined?brand:existing.brand, category||existing.category,
    price!==undefined?price:existing.price, old_price!==undefined?old_price:existing.old_price,
    emoji||existing.emoji, tag!==undefined?tag:existing.tag, on_sale!==undefined?(on_sale?1:0):existing.on_sale,
    stock!==undefined?stock:existing.stock, description!==undefined?description:existing.description, image||null, req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

app.post('/api/products/:id/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Carica un\'immagine' });
  const imagePath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE products SET image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(imagePath, req.params.id);
  res.json({ image: imagePath });
});

app.delete('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Prodotto non esistente' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== Order API =====

// Create order (from customer checkout)
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, customer_wechat, customer_email, customer_address, payment_method, note, items } = req.body;

  if (!customer_name || !customer_phone || !customer_address || !items || items.length === 0) {
    return res.status(400).json({ error: 'Inserisci tutti i dati di spedizione e i prodotti' });
  }

  const orderNo = 'LQ' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2,5).toUpperCase();
  const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  const result = db.prepare(`
    INSERT INTO orders (order_no, customer_name, customer_phone, customer_wechat, customer_email,
      customer_address, payment_method, note, items_json, total_amount, item_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orderNo, customer_name, customer_phone, customer_wechat||'', customer_email||'',
    customer_address, payment_method||'微信支付', note||'', JSON.stringify(items), totalAmount, itemCount);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(order);
});

// List orders (with filters)
app.get('/api/orders', (req, res) => {
  const { status, settled, date, search } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (settled !== undefined && settled !== '') { sql += ' AND settled = ?'; params.push(parseInt(settled)); }
  if (date) { sql += ' AND DATE(created_at) = ?'; params.push(date); }
  if (search) {
    sql += ' AND (order_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Get single order
app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  order.items = JSON.parse(order.items_json || '[]');
  res.json(order);
});

// Update order status
app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Stato non valido' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// Delete order
app.delete('/api/orders/:id', (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== Settlement API =====

// Get pending (unsettled) orders summary
app.get('/api/settlements/pending', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE settled = 0 ORDER BY created_at ASC').all();
  const totalAmount = orders.reduce((s, o) => s + o.total_amount, 0);
  const itemCount = orders.reduce((s, o) => s + o.item_count, 0);

  // Category breakdown
  const categoryMap = {};
  for (const order of orders) {
    const items = JSON.parse(order.items_json || '[]');
    for (const item of items) {
      const cat = item.category || '其他';
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, amount: 0 };
      categoryMap[cat].count += item.qty;
      categoryMap[cat].amount += item.price * item.qty;
    }
  }

  res.json({
    orderCount: orders.length,
    totalAmount,
    itemCount,
    categories: categoryMap,
    orders
  });
});

// Execute settlement (结单)
app.post('/api/settlements', (req, res) => {
  const { settle_date } = req.body;
  const date = settle_date || new Date().toISOString().slice(0, 10);

  // Check if already settled
  const existing = db.prepare('SELECT * FROM settlements WHERE settle_date = ?').get(date);
  if (existing) {
    return res.status(400).json({ error: `Chiusura già effettuata per ${date}, non ripetere l'operazione` });
  }

  // Get all unsettled orders
  const orders = db.prepare('SELECT * FROM orders WHERE settled = 0').all();
  if (orders.length === 0) {
    return res.status(400).json({ error: 'Nessun ordine da chiudere' });
  }

  const totalAmount = orders.reduce((s, o) => s + o.total_amount, 0);
  const itemCount = orders.reduce((s, o) => s + o.item_count, 0);

  // Build details
  const details = orders.map(o => ({
    order_no: o.order_no,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_address: o.customer_address,
    total_amount: o.total_amount,
    item_count: o.item_count,
    items: JSON.parse(o.items_json || '[]'),
    payment_method: o.payment_method,
    created_at: o.created_at,
  }));

  // Category breakdown
  const categoryMap = {};
  for (const order of orders) {
    const items = JSON.parse(order.items_json || '[]');
    for (const item of items) {
      const cat = item.category || '其他';
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, amount: 0 };
      categoryMap[cat].count += item.qty;
      categoryMap[cat].amount += item.price * item.qty;
    }
  }

  // Execute in transaction
  const tx = db.transaction(() => {
    // Insert settlement record
    db.prepare(`
      INSERT INTO settlements (settle_date, order_count, total_amount, item_count, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, orders.length, totalAmount, itemCount, JSON.stringify(details));

    // Mark orders as settled
    for (const order of orders) {
      db.prepare('UPDATE orders SET settled = 1, settled_at = CURRENT_TIMESTAMP WHERE id = ?').run(order.id);
    }
  });
  tx();

  const settlement = db.prepare('SELECT * FROM settlements WHERE settle_date = ?').get(date);
  res.json({
    ...settlement,
    details,
    categories: categoryMap,
  });
});

// List settlement history
app.get('/api/settlements', (req, res) => {
  const settlements = db.prepare('SELECT * FROM settlements ORDER BY settle_date DESC').all();
  res.json(settlements);
});

// Get single settlement detail
app.get('/api/settlements/:date', (req, res) => {
  const settlement = db.prepare('SELECT * FROM settlements WHERE settle_date = ?').get(req.params.date);
  if (!settlement) return res.status(404).json({ error: '未找到该日期的结单记录' });
  settlement.details = JSON.parse(settlement.details_json || '[]');
  res.json(settlement);
});

// ===== Stats API =====
app.get('/api/stats', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const onSale = db.prepare('SELECT COUNT(*) as c FROM products WHERE on_sale = 1').get().c;
  const categories = db.prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category').all();
  const avgPrice = db.prepare('SELECT AVG(price) as avg FROM products').get().avg;

  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pendingOrders = db.prepare('SELECT COUNT(*) as c FROM orders WHERE settled = 0').get().c;
  const todayOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = DATE('now','localtime')").get().c;
  const todayAmount = db.prepare("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE DATE(created_at) = DATE('now','localtime')").get().s;

  res.json({
    totalProducts, onSale, categories, avgPrice: Math.round(avgPrice || 0),
    totalOrders, pendingOrders, todayOrders, todayAmount,
  });
});

// ===== Start Server =====
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🛍️  L&Qmercatone è online!');
  console.log('');
  console.log(`   📦 Negozio:      http://localhost:${PORT}`);
  console.log(`   🔧 Pannello Admin: http://localhost:${PORT}/admin.html`);
  console.log(`   📡 Porta API:  ${PORT}`);
  console.log('');
});

// Vercel serverless export
module.exports = app;

// ===== 超时自动关单 API =====
app.post('/api/orders/auto-cancel-timeout', async (req, res) => {
  try {
    const timeoutHours = 24;
    const cutoffTime = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString();
    
    // 查找超时订单
    const timeoutOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE status = 'pending' 
      AND created_at < ?
    `).all(cutoffTime);
    
    console.log(`🔍 找到 ${timeoutOrders.length} 个超时订单`);
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    for (const order of timeoutOrders) {
      try {
        // 解析商品
        const items = JSON.parse(order.items_json || '[]');
        
        // 更新订单状态
        db.prepare(`
          UPDATE orders 
          SET status = 'cancelled', 
              cancelled_at = CURRENT_TIMESTAMP,
              cancel_reason = 'timeout_unpaid'
          WHERE id = ?
        `).run(order.id);
        
        // 释放库存
        for (const item of items) {
          if (item.id) {
            const qty = item.qty || 1;
            db.prepare(`
              UPDATE products 
              SET stock = stock + ? 
              WHERE id = ?
            `).run(qty, item.id);
          }
        }
        
        successCount++;
        results.push({
          order_no: order.order_no,
          customer: order.customer_name,
          status: 'cancelled',
          stock_released: items.reduce((sum, i) => sum + (i.qty || 1), 0)
        });
        
        console.log(`✅ 订单 ${order.order_no} 已关闭，库存已释放`);
      } catch (error) {
        failCount++;
        console.error(`❌ 订单 ${order.order_no} 处理失败:`, error.message);
      }
    }
    
    res.json({
      success: true,
      total: timeoutOrders.length,
      success_count: successCount,
      fail_count: failCount,
      results
    });
  } catch (error) {
    console.error('💥 自动关单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
